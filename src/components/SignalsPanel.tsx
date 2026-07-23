import type { SignalSnapshot } from '../api';
import { dateTime } from '../format';

interface Props {
  snapshots: SignalSnapshot[];
}

const PRETTY: Record<string, string> = {
  rsi_oversold: 'RSI oversold',
  bollinger_lower: 'Bollinger lower',
  sma_dip: 'SMA dip',
  macd_bull_cross: 'MACD bull cross',
  divergence_volume: 'Bullish divergence + vol',
  reversal_candle: 'Reversal candle',
};

// Latest signal-engine output per ticker — the 5 confluence votes plus the trend-gate filter.
export default function SignalsPanel({ snapshots }: Props) {
  if (!snapshots.length) {
    return <div className="empty-table">No signal data yet (the bot populates this each cycle).</div>;
  }
  return (
    <div className="signals-grid">
      {snapshots.map(s => {
        const votingSignals = s.votes.filter(v => v.name !== 'trend_gate');
        const gate = s.votes.find(v => v.name === 'trend_gate');
        const firedCount = votingSignals.filter(v => v.vote > 0).length;
        return (
          <div key={s.ticker} className="signal-card">
            <div className="signal-head">
              <span className="signal-ticker">{s.ticker}</span>
              <span className={`badge ${s.isCandidate ? 'buy' : 'neutral'}`}>
                {s.isCandidate ? 'BUY CANDIDATE' : `${firedCount}/${s.threshold}`}
              </span>
            </div>
            <div className="signal-sub">
              {firedCount} of {votingSignals.length} signals · confidence {(s.confidence * 100).toFixed(0)}% · {dateTime(s.time)}
            </div>
            <div className="signal-votes">
              {votingSignals.map(v => (
                <div key={v.name} className={`signal-vote ${v.vote > 0 ? 'fired' : ''}`} title={v.detail}>
                  <span className="vote-dot" />
                  {PRETTY[v.name] || v.name}
                </div>
              ))}
            </div>
            <div className={`signal-gate ${s.trendGateBlocked ? 'blocked' : 'open'}`} title={gate?.detail}>
              Trend gate (filter, not scored) — {s.trendGateBlocked ? 'BLOCKING buys' : 'allowing buys'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
