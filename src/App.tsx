import { useEffect, useState } from 'react';
import { fetchOverview, fetchSignals, type Overview, type SignalSnapshot } from './api';
import TimelineChart from './components/TimelineChart';
import GlobalChart from './components/GlobalChart';
import TradesTable from './components/TradesTable';
import HoldingsBreakdown from './components/HoldingsBreakdown';
import SignalsPanel from './components/SignalsPanel';
import ConfigEditor from './components/ConfigEditor';
import { TickerSummaryCards, CombinedSummaryCards } from './components/SummaryCards';

const RANGE_PRESETS = [
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: 'This Year', days: 365 },
];

// Distinct line colors assigned per ticker (stable by sorted order).
const TICKER_COLORS = ['#6ea8fe', '#f5a524', '#c07cf0', '#35c47a', '#f0616d', '#4dd0e1'];

function rangeFor(days: number) {
  const stop = new Date();
  const start = new Date(stop.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), stop: stop.toISOString() };
}

export default function App() {
  const [rangeDays, setRangeDays] = useState(7);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [signals, setSignals] = useState<Record<string, SignalSnapshot>>({});
  const [selected, setSelected] = useState<string | null>(null); // null = All
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { start, stop } = rangeFor(rangeDays);
    setLoading(true);
    setError(null);
    fetchOverview(start, stop)
      .then(setOverview)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [rangeDays]);

  // Latest signal snapshots (live, range-independent) — refresh on mount and every 60s.
  useEffect(() => {
    const load = () => fetchSignals().then(setSignals).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const colorFor = (ticker: string) => {
    const idx = overview ? overview.tickers.findIndex(t => t.ticker === ticker) : 0;
    return TICKER_COLORS[idx % TICKER_COLORS.length];
  };

  const selectedEntry = selected && overview ? overview.tickers.find(t => t.ticker === selected) : null;
  const tableFills = selectedEntry
    ? selectedEntry.fills
    : (overview ? overview.tickers.flatMap(t => t.fills) : []);

  return (
    <div className="app">
      <header className="header">
        <h1>Tradebot</h1>
      </header>

      {overview && (
        <HoldingsBreakdown
          holdings={[
            ...overview.tickers.map(t => ({
              ticker: t.ticker,
              color: colorFor(t.ticker),
              value: t.summary.position.currentValue,
              quantity: t.summary.position.openQuantity,
            })),
            { ticker: 'Cash (USD)', color: '#35c47a', value: overview.cashUsd, quantity: overview.cashUsd, isCash: true },
          ]}
        />
      )}

      <div className="range-tabs range-row">
        {RANGE_PRESETS.map(p => (
          <button key={p.days} className={p.days === rangeDays ? 'active' : ''} onClick={() => setRangeDays(p.days)}>
            {p.label}
          </button>
        ))}
      </div>

      {error && <div className="error">Error: {error}</div>}

      {/* Legend / filter: All + one chip per ticker */}
      {overview && (
        <div className="legend-filter">
          <button className={`chip ${selected === null ? 'active' : ''}`} onClick={() => setSelected(null)}>
            <span className="chip-dot" style={{ background: 'var(--muted)' }} /> All
          </button>
          {overview.tickers.map(t => (
            <button
              key={t.ticker}
              className={`chip ${selected === t.ticker ? 'active' : ''}`}
              onClick={() => setSelected(selected === t.ticker ? null : t.ticker)}
            >
              <span className="chip-dot" style={{ background: colorFor(t.ticker) }} /> {t.ticker}
            </button>
          ))}
        </div>
      )}

      {overview && (selectedEntry
        ? <TickerSummaryCards summary={selectedEntry.summary} />
        : <CombinedSummaryCards combined={overview.combined} tickerCount={overview.tickers.length} />
      )}

      <div className="chart-panel">
        {loading && <div className="loading">Loading…</div>}
        {overview && !loading && (selectedEntry ? (
          <>
            <div className="chart-heading">
              <span>{selectedEntry.ticker} price</span>
              <span className="legend">
                <span className="dot buy" /> Buy
                <span className="dot sell" /> Sell
                <span className="muted">· {selectedEntry.fills.length} trades</span>
              </span>
            </div>
            <TimelineChart prices={selectedEntry.prices} fills={selectedEntry.fills} />
          </>
        ) : (
          <>
            <div className="chart-heading">
              <span>All tickers · % change from range start</span>
              <span className="legend">
                <span className="dot buy" /> Buy
                <span className="dot sell" /> Sell
              </span>
            </div>
            <GlobalChart series={overview.tickers.map(t => ({ ticker: t.ticker, color: colorFor(t.ticker), prices: t.prices, fills: t.fills }))} />
          </>
        ))}
      </div>

      {overview && !loading && (
        <div className="table-panel">
          <div className="chart-heading">
            <span>Latest signals</span>
            <span className="muted">last bot cycle</span>
          </div>
          <SignalsPanel
            snapshots={
              (selected ? [signals[selected]] : Object.values(signals))
                .filter(Boolean)
                .sort((a, b) => a.ticker.localeCompare(b.ticker))
            }
          />
        </div>
      )}

      {overview && !loading && (
        <div className="table-panel">
          <div className="chart-heading">
            <span>{selectedEntry ? `${selectedEntry.ticker} trades` : 'All trades'}</span>
            <span className="muted">{tableFills.length} total</span>
          </div>
          <TradesTable fills={tableFills} />
        </div>
      )}

      <ConfigEditor />

      <footer className="footer">
        Data from InfluxDB · transactional figures scoped to selected range · position &amp; total return are all-time on tracked capital
      </footer>
    </div>
  );
}
