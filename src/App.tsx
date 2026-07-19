import { useEffect, useState } from 'react';
import { fetchTickers, fetchTimeline, fetchSummary, type Timeline, type Summary } from './api';
import TimelineChart from './components/TimelineChart';
import SummaryCards from './components/SummaryCards';

const RANGE_PRESETS = [
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: 'This Year', days: 365 },
];

function rangeFor(days: number) {
  const stop = new Date();
  const start = new Date(stop.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), stop: stop.toISOString() };
}

export default function App() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [ticker, setTicker] = useState<string>('');
  const [rangeDays, setRangeDays] = useState(7);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTickers()
      .then(ts => {
        setTickers(ts);
        if (ts.length && !ticker) setTicker(ts[0]);
      })
      .catch(e => setError(e.message));
  }, []);

  useEffect(() => {
    if (!ticker) return;
    const { start, stop } = rangeFor(rangeDays);
    setLoading(true);
    setError(null);
    Promise.all([fetchTimeline(ticker, start, stop), fetchSummary(ticker, start, stop)])
      .then(([tl, sm]) => {
        setTimeline(tl);
        setSummary(sm);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker, rangeDays]);

  return (
    <div className="app">
      <header className="header">
        <h1>Tradebot</h1>
        <div className="controls">
          <select value={ticker} onChange={e => setTicker(e.target.value)} disabled={!tickers.length}>
            {tickers.length === 0 && <option>No tickers</option>}
            {tickers.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="range-tabs">
            {RANGE_PRESETS.map(p => (
              <button
                key={p.days}
                className={p.days === rangeDays ? 'active' : ''}
                onClick={() => setRangeDays(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && <div className="error">Error: {error}</div>}

      {summary && <SummaryCards summary={summary} />}

      <div className="chart-panel">
        {loading && <div className="loading">Loading…</div>}
        {timeline && !loading && (
          <>
            <div className="chart-heading">
              <span>{timeline.ticker} price</span>
              <span className="legend">
                <span className="dot buy" /> Buy
                <span className="dot sell" /> Sell
                <span className="muted">· {timeline.fills.length} trades</span>
              </span>
            </div>
            <TimelineChart prices={timeline.prices} fills={timeline.fills} />
          </>
        )}
      </div>

      <footer className="footer">
        Data from InfluxDB · transactional figures scoped to selected range · position &amp; total return are all-time
      </footer>
    </div>
  );
}
