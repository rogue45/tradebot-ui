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

/** One-line "what's currently missing" for an archetype that hasn't fired - the single most
 * relevant blocker, in the order a reader would actually want to know about it. */
function dipReversalStatus(dr: DipReversalEval): string {
  if (dr.isCandidate) return 'confirmed';
  if (dr.trendGateBlocked) return 'downtrend blocking buys';
  if (!dr.dipConfirmed) return 'no dip yet';
  if (dr.reversalGateBlocked) return 'no reversal evidence yet';
  if (dr.floorBroken) return 'floor broken - invalidated';
  if (!dr.bounceConfirmed) return 'awaiting bounce confirmation';
  return 'waiting';
}

function breakoutStatus(bo: BreakoutEval): string {
  if (bo.isCandidate) return 'confirmed';
  if (bo.trendGateBlocked) return 'downtrend blocking buys';
  if (!bo.levelConfirmed) return 'no breakout level broken yet';
  if (bo.momentumGateBlocked) return 'no momentum evidence yet';
  if (bo.breakoutFailed) return 'ceiling reclaimed - invalidated';
  if (!bo.breakoutConfirmed) return 'awaiting confirmation bounce';
  return 'waiting';
}

/** One archetype: a single always-visible status line, with the gate/vote breakdown ("what would
 * flip it") tucked behind a native <details> disclosure so it stays out of the way until wanted.
 * Each gate renders its own member signals nested directly beneath it (a signal can appear under
 * more than one gate if it's ever shared - none currently are, each maps to exactly one gate). */
function ArchetypeRow({ title, status, evaluation, gates }: {
  title: string;
  status: string;
  evaluation: DipReversalEval | BreakoutEval;
  gates: { label: string; blocked: boolean; title?: string; voteNames?: string[] }[];
}) {
  const voteByName = new Map(evaluation.votes.map(v => [v.name, v]));
  return (
    <details className="archetype-row">
      <summary className="archetype-summary">
        <span className="archetype-title">{title}</span>
        <span className={`archetype-status ${evaluation.isCandidate ? 'fired' : ''}`}>
          {evaluation.isCandidate ? 'FIRED' : status}
        </span>
      </summary>
      <div className="archetype-body">
        {gates.map(g => (
          <div key={g.label} className="gate-group">
            <div className={`signal-gate ${g.blocked ? 'blocked' : 'open'}`} title={g.title}>
              {g.label} — {g.blocked ? 'BLOCKING' : 'open'}
            </div>
            {g.voteNames && (
              <div className="signal-votes nested">
                {g.voteNames.map(name => {
                  const v = voteByName.get(name);
                  if (!v) return null;
                  return (
                    <div key={name} className={`signal-vote ${v.vote > 0 ? 'fired' : ''}`} title={v.detail}>
                      <span className="vote-dot" />
                      {PRETTY[name] || name}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

// Latest signal-engine output per ticker: two INDEPENDENT buy archetypes, either one firing is a
// buy candidate (see signalEngine.js). Minimal by default - one status line per archetype - with
// the full vote/gate breakdown collapsed behind a disclosure for anyone who wants "what would flip it".
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

            <ArchetypeRow
              title="Dip-reversal"
              status={dipReversalStatus(dr)}
              evaluation={dr}
              gates={[
                { label: 'Dip evidence (any of 3)', blocked: !dr.dipConfirmed, title: 'RSI oversold, Bollinger lower, or SMA dip', voteNames: ['rsi_oversold', 'bollinger_lower', 'sma_dip'] },
                ...(dr.requireReversal ? [{ label: 'Reversal evidence (any of 3)', blocked: !!dr.reversalGateBlocked, title: 'MACD bull cross, divergence + volume, or reversal candle', voteNames: ['macd_bull_cross', 'divergence_volume', 'reversal_candle'] }] : []),
                { label: 'Trend gate', blocked: dr.trendGateBlocked, title: trendGateDetail },
                { label: 'Floor gate', blocked: dr.floorBroken, title: floorTitle },
              ]}
            />
            <ArchetypeRow
              title="Breakout"
              status={breakoutStatus(bo)}
              evaluation={bo}
              gates={[
                { label: 'Level evidence (any of 3)', blocked: !bo.levelConfirmed, title: 'Donchian breakout, upper Bollinger break, or SMA breakout', voteNames: ['donchian_breakout', 'bollinger_upper_break', 'sma_breakout'] },
                ...(bo.requireMomentum ? [{ label: 'Momentum evidence (any of 3)', blocked: !!bo.momentumGateBlocked, title: 'MACD bull cross above zero, volume breakout candle, or fast/slow EMA cross', voteNames: ['macd_bull_cross_above_zero', 'volume_breakout_candle', 'ema_fast_cross'] }] : []),
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
