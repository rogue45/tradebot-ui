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
  volume_spike: 'Volume spike',
  trend_gate: 'Trend gate',
};

// Latest signal-engine output per ticker — the confluence votes behind the last buy evaluation.
export default function SignalsPanel({ snapshots }: Props) {
  if (!snapshots.length) {
    return <div className="empty-table">No signal data yet (the bot populates this each cycle).</div>;
  }
  return (
    <div className="signals-grid">
      {snapshots.map(s => (
        <div key={s.ticker} className="signal-card">
          <div className="signal-head">
            <span className="signal-ticker">{s.ticker}</span>
            <span className={`badge ${s.isCandidate ? 'buy' : 'neutral'}`}>
              {s.isCandidate ? 'BUY CANDIDATE' : `${s.netScore}/${s.threshold}`}
            </span>
          </div>
          <div className="signal-sub">
            confidence {(s.confidence * 100).toFixed(0)}% · {dateTime(s.time)}
            {s.trendGateBlocked && <span className="signal-blocked"> · trend gate: blocked</span>}
          </div>
          <div className="signal-votes">
            {s.votes.map(v => (
              <div key={v.name} className={`signal-vote ${v.vote > 0 ? 'fired' : ''} ${v.name === 'trend_gate' ? 'gate' : ''}`} title={v.detail}>
                <span className="vote-dot" />
                {PRETTY[v.name] || v.name}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
