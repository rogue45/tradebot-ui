# tradebot-ui

A lightweight **static** dashboard for the [quant-trader](../quant-trader) bot. It renders the
trading record — a price timeline with buy/sell markers, per-ticker filtering, a portfolio
holdings breakdown (incl. cash), a trades table, and summary metrics.

## Architecture

This project is **pure frontend**. All data access lives in the bot: the `quant-trader` process
serves the read-only REST API (`/api/tickers`, `/api/overview`, `/api/timeline`, `/api/summary`)
with CORS enabled, holding the `INFLUX_DB_TOKEN` and querying InfluxDB. This container just serves
the built React app via nginx and calls that API cross-origin.

- **`src/`** — React SPA (Recharts). Fetches from `window.__API_BASE__` (the bot's API).
- **`public/config.js`** — sets `window.__API_BASE__`. Overwritten at container start from the
  `API_BASE_URL` env var, so one static image can point at any backend.
- No Node at runtime — nginx serves static files only.

## Local development

Run the bot's API (`quant-trader`, `node tradebot.js` or just its API) on :8473, then:

```bash
npm install
npm run dev     # Vite on :5173, proxies /api -> http://localhost:8473 (VITE_API_TARGET to override)
```

Open http://localhost:5173.

## Build & deploy

```bash
./build-push.sh   # builds linux/amd64 (nginx static image), version-tags, pushes to the registry
```

Run the container, pointing it at the bot's API:

```yaml
tradebot-ui:
  image: 192.168.1.53:5000/tradebot-ui:latest
  environment:
    # Base URL of the bot's dashboard API (served by quant-trader). Blank = same-origin.
    - API_BASE_URL=http://192.168.1.53:8473
  ports:
    - "8080:80"
  restart: unless-stopped
```

The InfluxDB token and all query logic now live in the bot, not here — this container needs no
database credentials.

## Metric definitions

- **Money In / Fees / Realized P&L** — scoped to the selected date range.
- **Current Holdings** — open position quantity × latest price (plus USD cash from the bot's
  holdings snapshot), a "right now" value.
- **Total Return %** — all-time: `(realized P&L + unrealized) / all-time money in`, tracked capital only.

Realized P&L is walked FIFO server-side (in the bot's API), so a sell disposing of more than the
tracked lots is booked as an **untracked disposal** and excluded from P&L rather than showing
phantom profit/loss. The bot's `dashboard_api.tracking_start` config sets a hard floor on which
fills count at all.

Note: this is a monitoring view, not a tax document — for taxes use Coinbase's own reports.
