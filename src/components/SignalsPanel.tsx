import type { BreakoutEval, DipReversalEval, SignalSnapshot } from '../api';
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
  donchian_breakout: 'Donchian breakout',
  bollinger_upper_break: 'Bollinger upper break',
  sma_breakout: 'SMA breakout',
  macd_bull_cross_above_zero: 'MACD bull cross (above zero)',
  volume_breakout_candle: 'Volume breakout candle',
  ema_fast_cross: 'EMA fast/slow cross',
};

/** Renders one archetype's votes + gates. Shared layout for dip-reversal and breakout. */
function ArchetypeCard({ title, evaluation, gates }: {
  title: string;
  evaluation: DipReversalEval | BreakoutEval;
  gates: { label: string; blocked: boolean; title?: string }[];
}) {
  const votingSignals = evaluation.votes.filter(v => v.name !== 'trend_gate');
  const firedCount = votingSignals.filter(v => v.vote > 0).length;
  return (
    <div className="signal-archetype">
      <div className="signal-archetype-head">
        <span className="signal-archetype-title">{title}</span>
        <span className={`badge ${evaluation.isCandidate ? 'buy' : 'neutral'}`}>
          {evaluation.isCandidate ? 'FIRED' : `${firedCount}/${votingSignals.length}`}
        </span>
      </div>
      <div className="signal-votes">
        {votingSignals.map(v => (
          <div key={v.name} className={`signal-vote ${v.vote > 0 ? 'fired' : ''}`} title={v.detail}>
            <span className="vote-dot" />
            {PRETTY[v.name] || v.name}
          </div>
        ))}
      </div>
      {gates.map(g => (
        <div key={g.label} className={`signal-gate ${g.blocked ? 'blocked' : 'open'}`} title={g.title}>
          {g.label} — {g.blocked ? 'BLOCKING' : 'open'}
        </div>
      ))}
    </div>
  );
}

// Latest signal-engine output per ticker: two INDEPENDENT buy archetypes, either one firing is a
// buy candidate (see signalEngine.js). Dip-reversal needs a stretched dip AND real reversal
// evidence; breakout needs a broken range AND real momentum - each its own structured AND-of-ORs,
// not a vote count, combined with OR at the top.
export default function SignalsPanel({ snapshots }: Props) {
  if (!snapshots.length) {
    return <div className="empty-table">No signal data yet (the bot populates this each cycle).</div>;
  }
  return (
    <div className="signals-grid">
      {snapshots.map(s => {
        const dr = s.dipReversal;
        const bo = s.breakout;
        const trendGateDetail = dr.votes.find(v => v.name === 'trend_gate')?.detail;
        const floorTitle = dr.floorPrice != null
          ? `floor ${dr.floorPrice.toFixed(4)}${dr.bounceConfirmPct > 0 ? ` (needs +${dr.bounceConfirmPct}% bounce)` : ''}`
          : 'insufficient candle data';
        const ceilingTitle = bo.breakoutLevel != null
          ? `level ${bo.breakoutLevel.toFixed(4)}${bo.breakoutConfirmPct > 0 ? ` (needs +${bo.breakoutConfirmPct}% confirm)` : ''}`
          : 'insufficient candle data';
        return (
          <div key={s.ticker} className="signal-card">
            <div className="signal-head">
              <span className="signal-ticker">{s.ticker}</span>
              <span className={`badge ${s.isCandidate ? 'buy' : 'neutral'}`}>
                {s.isCandidate ? 'BUY CANDIDATE' : 'waiting'}
              </span>
            </div>
            <div className="signal-sub">confidence {(s.confidence * 100).toFixed(0)}% · {dateTime(s.time)}</div>

            <ArchetypeCard
              title="Dip-reversal"
              evaluation={dr}
              gates={[
                { label: 'Dip evidence (any of 3)', blocked: !dr.dipConfirmed, title: 'RSI oversold, Bollinger lower, or SMA dip' },
                ...(dr.requireReversal ? [{ label: 'Reversal evidence (any of 3)', blocked: !!dr.reversalGateBlocked, title: 'MACD bull cross, divergence + volume, or reversal candle' }] : []),
                { label: 'Trend gate', blocked: dr.trendGateBlocked, title: trendGateDetail },
                { label: 'Floor gate', blocked: dr.floorBroken, title: floorTitle },
              ]}
            />
            <ArchetypeCard
              title="Breakout"
              evaluation={bo}
              gates={[
                { label: 'Level evidence (any of 3)', blocked: !bo.levelConfirmed, title: 'Donchian breakout, upper Bollinger break, or SMA breakout' },
                ...(bo.requireMomentum ? [{ label: 'Momentum evidence (any of 3)', blocked: !!bo.momentumGateBlocked, title: 'MACD bull cross above zero, volume breakout candle, or fast/slow EMA cross' }] : []),
                { label: 'Trend gate', blocked: bo.trendGateBlocked, title: trendGateDetail },
                { label: 'Ceiling gate', blocked: bo.breakoutFailed, title: ceilingTitle },
              ]}
            />
          </div>
        );
      })}
    </div>
  );
}
