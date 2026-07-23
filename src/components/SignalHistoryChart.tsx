import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { PricePoint, SignalHistoryPoint } from '../api';
import { usd, dateTime, shortDate } from '../format';

interface Props {
  prices: PricePoint[];
  signals: SignalHistoryPoint[];
}

const BASE_COLOR = 'var(--price-line)';
const BUY_COLOR = '#f5c518';
const SELL_COLOR = '#35c47a';

type SignalState = 'buy' | 'sell' | 'none';

/** Step-aligns each price point to the most recent signal snapshot at/before it (signals and
 * prices come from separate queries with independent bucketing, so they don't share timestamps). */
function stateAt(prices: PricePoint[], signals: SignalHistoryPoint[]) {
  let si = -1;
  return prices.map(p => {
    while (si + 1 < signals.length && signals[si + 1].time <= p.time) si++;
    const s = si >= 0 ? signals[si] : null;
    // Sell takes priority when both happen to be on at once - see file header note in signalEngine.
    const state: SignalState = !s ? 'none' : s.sellSignal ? 'sell' : s.buySignal ? 'buy' : 'none';
    return { time: p.time, price: p.price, state };
  });
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const label = p.state === 'buy' ? 'Buy signal on' : p.state === 'sell' ? 'Sell signal on' : 'No signal';
  return (
    <div className="tooltip">
      <div className="tooltip-title">{dateTime(p.time)}</div>
      <div>Price {usd(p.price)}</div>
      <div>{label}</div>
    </div>
  );
}

// Single price line, colored by whatever the buy/sell signal state was at each point: blue when
// neither is on, yellow while a buy candidate is active, green while a sell candidate is active.
// Recharts has no native per-point line color, so this renders 3 overlaid <Line>s (one per state,
// null everywhere else) - the standard workaround for a "multi-color single line" chart.
export default function SignalHistoryChart({ prices, signals }: Props) {
  if (!prices.length) {
    return <div className="empty">No price data in this range.</div>;
  }
  const merged = stateAt(prices, signals);
  const segments = merged.map((m, i) => {
    const prev = merged[i - 1];
    // Include the transition point in both the outgoing and incoming state's series, so the two
    // colored segments visually touch instead of leaving a one-point gap at each state change.
    const states = new Set<SignalState>([m.state]);
    if (prev && prev.state !== m.state) states.add(prev.state);
    return {
      time: m.time,
      price: m.price,
      state: m.state,
      base: states.has('none') ? m.price : null,
      buy: states.has('buy') ? m.price : null,
      sell: states.has('sell') ? m.price : null,
    };
  });

  const values = prices.map(p => p.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.05 || max * 0.01;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={segments} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={shortDate}
          stroke="var(--axis)"
          fontSize={12}
        />
        <YAxis
          domain={[min - pad, max + pad]}
          tickFormatter={(v) => usd(v)}
          stroke="var(--axis)"
          fontSize={12}
          width={72}
        />
        <Tooltip content={<ChartTooltip />} />
        <Line dataKey="base" type="monotone" stroke={BASE_COLOR} dot={false} strokeWidth={1.75} isAnimationActive={false} connectNulls={false} name="No signal" />
        <Line dataKey="buy" type="monotone" stroke={BUY_COLOR} dot={false} strokeWidth={1.75} isAnimationActive={false} connectNulls={false} name="Buy signal" />
        <Line dataKey="sell" type="monotone" stroke={SELL_COLOR} dot={false} strokeWidth={1.75} isAnimationActive={false} connectNulls={false} name="Sell signal" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
