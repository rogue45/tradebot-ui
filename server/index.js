/**
 * @fileoverview Express server for tradebot-ui: exposes read-only JSON endpoints backed by
 * InfluxDB and serves the built React app. The InfluxDB token lives here, never in the browser.
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTickers, getPriceSeries, getFills, getSummary } from './influx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8473;

const asyncRoute = (handler) => (req, res) => {
   handler(req, res).catch(err => {
      console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} failed:`, err.message);
      res.status(500).json({ error: err.message });
   });
};

/** Resolves start/stop ISO strings from query params, defaulting to the last 7 days. */
function resolveRange(req) {
   const stop = req.query.stop ? new Date(req.query.stop) : new Date();
   const start = req.query.start
      ? new Date(req.query.start)
      : new Date(stop.getTime() - 7 * 24 * 60 * 60 * 1000);
   return { startIso: start.toISOString(), stopIso: stop.toISOString() };
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/tickers', asyncRoute(async (req, res) => {
   res.json({ tickers: await getTickers() });
}));

app.get('/api/timeline', asyncRoute(async (req, res) => {
   const ticker = req.query.ticker;
   if (!ticker) return res.status(400).json({ error: 'ticker is required' });
   const { startIso, stopIso } = resolveRange(req);
   const [prices, fills] = await Promise.all([
      getPriceSeries(ticker, startIso, stopIso),
      getFills(ticker, startIso, stopIso),
   ]);
   res.json({ ticker, start: startIso, stop: stopIso, prices, fills });
}));

app.get('/api/summary', asyncRoute(async (req, res) => {
   const ticker = req.query.ticker;
   if (!ticker) return res.status(400).json({ error: 'ticker is required' });
   const { startIso, stopIso } = resolveRange(req);
   res.json(await getSummary(ticker, startIso, stopIso));
}));

// Serve the built frontend (production). In dev, Vite serves the frontend and proxies /api here.
const distDir = path.join(__dirname, '..', 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));

app.listen(PORT, () => {
   console.log(`[${new Date().toISOString()}] tradebot-ui listening on :${PORT}`);
});
