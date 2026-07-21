# tradebot-ui

A lightweight dashboard for the [quant-trader](../quant-trader) bot. Reads the same InfluxDB
`market_data` bucket the bot writes to and visualizes the trading record: a price timeline with
buy/sell markers, per-ticker filtering, and summary metrics (money in, fees, realized P&L,
current holdings value, total return %).

## Architecture

A browser can't safely query InfluxDB directly (the token would be exposed), so this is a small
Express backend + a Vite/React frontend, shipped as a single container:

- **`server/`** — Express holds `INFLUX_DB_TOKEN`, queries InfluxDB (read-only), exposes JSON at
  `/api/tickers`, `/api/timeline`, `/api/summary`. In production it also serves the built frontend.
- **`src/`** — React SPA (Recharts). In dev, Vite serves it and proxies `/api` to the backend.

Data sources (all from InfluxDB): `spot_price` from the `market_data` bucket (price line),
`trade_fill` (markers, fees, realized P&L) and `trade_decision` (Gemini's reason, shown on
marker hover, joined by `order_id`) from the permanent `trade_history` bucket.

## Local development

```bash
npm install
cp .env.example .env      # fill in INFLUX_DB_TOKEN
npm run dev               # Vite on :5173, API on :8473
```

Open http://localhost:5173.

## Build & deploy

```bash
./build-push.sh           # builds linux/amd64, version-tags, pushes to the registry
```

Run the container with the InfluxDB read token in the environment:

```yaml
tradebot-ui:
  image: 192.168.1.53:5000/tradebot-ui:latest
  environment:
    - INFLUX_URL=http://192.168.1.53:8086
    - INFLUX_DB_TOKEN=${INFLUX_DB_TOKEN}
    - INFLUX_ORG=deremworks
    - INFLUX_PRICE_BUCKET=market_data
    - INFLUX_TRADE_BUCKET=trade_history
    # Optional: ignore trades before this date so pre-bot holdings with unreliable
    # cost basis don't pollute P&L. Omit to include all history.
    - INFLUX_TRACKING_START=2026-07-19
  ports:
    - "8473:8473"
  restart: unless-stopped
```

## Metric definitions

- **Money In / Fees / Realized P&L** — scoped to the selected date range.
- **Current Holdings** — open position quantity (all-time, FIFO) × latest price, a "right now" value.
- **Total Return %** — all-time: `(realized P&L + unrealized on open position) / all-time money in`, computed over tracked capital only.

Realized P&L is computed here via FIFO over the fill history rather than trusting the reconciler's
stored value, so a sell that disposes of more than the tracked lots (a pre-tracking or transferred-in
holding) is booked as an **untracked disposal** and excluded from P&L instead of showing phantom
profit/loss. `INFLUX_TRACKING_START` sets a hard floor on which fills count at all.

Note: this is a monitoring view, not a tax document — for taxes use Coinbase's own reports.
