import { usd, qty } from '../format';

export interface Holding {
  ticker: string;
  color: string;
  value: number;
  quantity: number;
  isCash?: boolean;
}

interface Props {
  holdings: Holding[];
}

// Current portfolio composition (tracked open positions × latest price), range-independent.
export default function HoldingsBreakdown({ holdings }: Props) {
  const active = holdings.filter(h => h.value > 0.01).sort((a, b) => b.value - a.value);
  const total = active.reduce((s, h) => s + h.value, 0);

  return (
    <div className="holdings">
      <div className="holdings-head">
        <span className="holdings-label">Current Holdings</span>
        <span className="holdings-total">{usd(total)}</span>
      </div>
      {active.length === 0 ? (
        <div className="holdings-empty">No current holdings.</div>
      ) : (
        <>
          <div className="holdings-bar">
            {active.map(h => (
              <div
                key={h.ticker}
                className="holdings-seg"
                style={{ width: `${(h.value / total) * 100}%`, background: h.color }}
                title={`${h.ticker}: ${usd(h.value)}`}
              />
            ))}
          </div>
          <div className="holdings-legend">
            {active.map(h => (
              <div key={h.ticker} className="holding-item">
                <span className="chip-dot" style={{ background: h.color }} />
                <span className="holding-ticker">{h.ticker}</span>
                <span className="holding-value">{usd(h.value)}</span>
                <span className="holding-pct">{((h.value / total) * 100).toFixed(0)}%</span>
                {!h.isCash && <span className="holding-qty">{qty(h.quantity)}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
