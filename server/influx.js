/**
 * @fileoverview InfluxDB query layer for tradebot-ui.
 * Reads the same market_data bucket the tradebot writes to: spot_price (price ticks),
 * trade_fill (executed fills with fees + realized P&L), trade_decision (Gemini's reasons).
 * All queries are read-only.
 */

import { InfluxDB } from '@influxdata/influxdb-client';

const URL = process.env.INFLUX_URL || 'http://192.168.1.53:8086';
const TOKEN = process.env.INFLUX_DB_TOKEN;
const ORG = process.env.INFLUX_ORG || 'deremworks';
// Price ticks live in the ephemeral market-data bucket; trade records live in their own
// permanent bucket (separate retention). Fall back to INFLUX_BUCKET for older single-bucket setups.
const PRICE_BUCKET = process.env.INFLUX_PRICE_BUCKET || process.env.INFLUX_BUCKET || 'market_data';
const TRADE_BUCKET = process.env.INFLUX_TRADE_BUCKET || 'trade_history';
const PRICE_MEASUREMENT = process.env.INFLUX_PRICE_MEASUREMENT || 'spot_price';
const FILL_MEASUREMENT = process.env.INFLUX_FILL_MEASUREMENT || 'trade_fill';
const DECISION_MEASUREMENT = process.env.INFLUX_DECISION_MEASUREMENT || 'trade_decision';
// Optional ISO date (e.g. "2026-07-19"). Trades before this are ignored everywhere - a clean
// "tracking starts here" line so pre-bot holdings with unreliable cost basis don't pollute P&L.
const TRACKING_START = process.env.INFLUX_TRACKING_START || null;
const ALL_TIME_START = TRACKING_START || '-5y';

if (!TOKEN) {
   console.error('FATAL: INFLUX_DB_TOKEN is not set.');
   process.exit(1);
}
if (TRACKING_START) {
   console.log(`Tracking start set to ${TRACKING_START} - trades before this are excluded from all metrics.`);
}

const queryApi = new InfluxDB({ url: URL, token: TOKEN }).getQueryApi(ORG);

/** Returns the later of the requested start and the tracking-start cutoff (if configured). */
function effectiveStart(requestedIso) {
   if (!TRACKING_START) return requestedIso;
   return new Date(requestedIso) > new Date(TRACKING_START) ? requestedIso : TRACKING_START;
}

/** Runs a Flux query and returns an array of row objects. */
async function query(flux) {
   const rows = [];
   for await (const { values, tableMeta } of queryApi.iterateRows(flux)) {
      rows.push(tableMeta.toObject(values));
   }
   return rows;
}

/** RFC3339 timestamps are valid Flux range literals as-is. */
function fluxRange(startIso, stopIso) {
   return `range(start: ${startIso}, stop: ${stopIso})`;
}

/** Distinct tickers that have any executed fills. */
export async function getTickers() {
   const flux = `import "influxdata/influxdb/schema"
schema.tagValues(
  bucket: "${TRADE_BUCKET}",
  tag: "ticker",
  predicate: (r) => r._measurement == "${FILL_MEASUREMENT}",
  start: ${ALL_TIME_START}
)`;
   const rows = await query(flux);
   return rows.map(r => r._value).filter(Boolean).sort();
}

/** Downsampled price series for a ticker over a range. Targets ~400 points. */
export async function getPriceSeries(ticker, startIso, stopIso) {
   const rangeSeconds = Math.max(60, (new Date(stopIso) - new Date(startIso)) / 1000);
   const windowSeconds = Math.max(60, Math.ceil(rangeSeconds / 400));
   const flux = `from(bucket: "${PRICE_BUCKET}")
  |> ${fluxRange(startIso, stopIso)}
  |> filter(fn: (r) => r._measurement == "${PRICE_MEASUREMENT}")
  |> filter(fn: (r) => r._field == "price")
  |> filter(fn: (r) => r.ticker == "${ticker}")
  |> aggregateWindow(every: ${windowSeconds}s, fn: mean, createEmpty: false)
  |> keep(columns: ["_time", "_value"])`;
   const rows = await query(flux);
   return rows.map(r => ({ time: new Date(r._time).getTime(), price: r._value }));
}

/** Executed fills for a ticker over a range, joined to decision reasons by order_id. */
export async function getFills(ticker, startIso, stopIso) {
   const flux = `from(bucket: "${TRADE_BUCKET}")
  |> ${fluxRange(effectiveStart(startIso), stopIso)}
  |> filter(fn: (r) => r._measurement == "${FILL_MEASUREMENT}")
  |> filter(fn: (r) => r.ticker == "${ticker}")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")`;
   const rows = await query(flux);
   const fills = rows.map(normalizeFillRow);

   // Attach Gemini's reason where an order_id match exists
   const reasons = await getDecisionReasons(ticker, startIso, stopIso);
   for (const f of fills) {
      if (f.orderId && reasons[f.orderId]) f.reason = reasons[f.orderId];
   }
   return fills.sort((a, b) => a.time - b.time);
}

/** All fills for a ticker (all-time), for position/return math. */
export async function getAllFills(ticker) {
   const flux = `from(bucket: "${TRADE_BUCKET}")
  |> range(start: ${ALL_TIME_START})
  |> filter(fn: (r) => r._measurement == "${FILL_MEASUREMENT}")
  |> filter(fn: (r) => r.ticker == "${ticker}")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")`;
   const rows = await query(flux);
   return rows.map(normalizeFillRow).sort((a, b) => a.time - b.time);
}

function normalizeFillRow(r) {
   return {
      time: new Date(r._time).getTime(),
      ticker: r.ticker,
      side: String(r.side || '').toUpperCase(),
      orderId: r.order_id || '',
      quantity: Number(r.quantity ?? 0),
      price: Number(r.price ?? 0),
      usdValue: Number(r.usd_value ?? 0),
      fees: Number(r.fees ?? 0),
      realizedPnl: r.realized_pnl != null ? Number(r.realized_pnl) : null,
   };
}

/** Map of order_id -> decision reason for a ticker over a range. */
async function getDecisionReasons(ticker, startIso, stopIso) {
   const flux = `from(bucket: "${TRADE_BUCKET}")
  |> ${fluxRange(effectiveStart(startIso), stopIso)}
  |> filter(fn: (r) => r._measurement == "${DECISION_MEASUREMENT}")
  |> filter(fn: (r) => r.ticker == "${ticker}")
  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")`;
   const rows = await query(flux);
   const map = {};
   for (const r of rows) {
      if (r.order_id) map[r.order_id] = r.reason || '';
   }
   return map;
}

/** Latest spot price for a ticker (looks back 1h). */
export async function getLatestPrice(ticker) {
   const flux = `from(bucket: "${PRICE_BUCKET}")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "${PRICE_MEASUREMENT}")
  |> filter(fn: (r) => r.ticker == "${ticker}")
  |> filter(fn: (r) => r._field == "price")
  |> last()`;
   const rows = await query(flux);
   return rows.length ? Number(rows[0]._value) : null;
}

/**
 * Summary metrics. Transactional figures (moneyIn, fees, realized) are scoped to the
 * selected range; position value and total return are all-time (a position is cumulative).
 * Open-position cost basis is walked FIFO to match the bot's accounting.
 */
export async function getSummary(ticker, startIso, stopIso) {
   const [rangeFills, allFills, latestPrice] = await Promise.all([
      getFills(ticker, startIso, stopIso),
      getAllFills(ticker),
      getLatestPrice(ticker),
   ]);

   const moneyInRange = sum(rangeFills.filter(f => f.side === 'BUY').map(f => f.usdValue));
   const feesRange = sum(rangeFills.map(f => f.fees));
   const rangeStartMs = new Date(startIso).getTime();
   const rangeStopMs = new Date(stopIso).getTime();

   // FIFO walk over all tracked fills. Realized P&L is computed here (not read from the stored
   // field) so we can correctly handle sells that dispose of MORE than we have tracked lots for:
   // that excess is an "untracked disposal" (a pre-tracking/transferred-in holding) and is
   // excluded from P&L entirely rather than booked as phantom profit/loss.
   const lots = [];
   let realizedAll = 0;
   let realizedRange = 0;
   let moneyInAll = 0;
   let untrackedDisposals = 0;
   let untrackedQty = 0;
   for (const f of allFills) {
      if (f.side === 'BUY') {
         lots.push({ qty: f.quantity, cost: f.usdValue + f.fees });
         moneyInAll += f.usdValue;
      } else if (f.side === 'SELL') {
         const sellFeePerUnit = f.quantity > 0 ? f.fees / f.quantity : 0;
         const sellValuePerUnit = f.quantity > 0 ? f.usdValue / f.quantity : 0;
         let remaining = f.quantity;
         let coveredQty = 0;
         let consumedCost = 0;
         while (remaining > 1e-12 && lots.length > 0) {
            const lot = lots[0];
            const consumed = Math.min(lot.qty, remaining);
            consumedCost += lot.cost * (consumed / lot.qty);
            lot.cost *= (lot.qty - consumed) / lot.qty;
            lot.qty -= consumed;
            remaining -= consumed;
            coveredQty += consumed;
            if (lot.qty <= 1e-12) lots.shift();
         }
         // P&L only on the portion backed by tracked lots
         const coveredProceeds = coveredQty * sellValuePerUnit;
         const coveredFees = coveredQty * sellFeePerUnit;
         const sellRealized = coveredProceeds - coveredFees - consumedCost;
         realizedAll += sellRealized;
         if (f.time >= rangeStartMs && f.time <= rangeStopMs) realizedRange += sellRealized;
         if (remaining > 1e-9) { // sold more than we ever tracked buying -> untracked disposal
            untrackedDisposals += 1;
            untrackedQty += remaining;
         }
      }
   }
   const openQty = sum(lots.map(l => l.qty));
   const openCostBasis = sum(lots.map(l => l.cost));
   const currentValue = latestPrice != null ? openQty * latestPrice : 0;
   const unrealized = currentValue - openCostBasis;
   const totalReturnPct = moneyInAll > 0 ? ((realizedAll + unrealized) / moneyInAll) * 100 : 0;

   return {
      ticker,
      range: { moneyIn: moneyInRange, fees: feesRange, realizedPnl: realizedRange },
      position: {
         openQuantity: openQty,
         costBasis: openCostBasis,
         latestPrice,
         currentValue,
         unrealizedPnl: unrealized,
      },
      allTime: { moneyIn: moneyInAll, realizedPnl: realizedAll, totalReturnPct },
      untracked: { disposals: untrackedDisposals, quantity: untrackedQty },
   };
}

function sum(arr) {
   return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}
