import type { Summary, CombinedSummary } from '../api';
import { usd, pct, qty } from '../format';

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' | 'neutral' }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className={`card-value ${tone ?? ''}`}>{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}

/** Single-ticker card set. */
export function TickerSummaryCards({ summary }: { summary: Summary }) {
  const { range, position, allTime, untracked } = summary;
  const hasUntracked = untracked && untracked.disposals > 0;
  return (
    <>
      <div className="cards">
        <Card label="Money In (range)" value={usd(range.moneyIn)} sub="USD spent on buys" />
        <Card label="Fees Paid (range)" value={usd(range.fees)} sub="Maker/taker fees" />
        <Card label="Realized P&L (range)" value={usd(range.realizedPnl)} sub="Tracked sells, fees deducted" tone={range.realizedPnl >= 0 ? 'pos' : 'neg'} />
        <Card label="Current Holdings" value={usd(position.currentValue)} sub={`${qty(position.openQuantity)} @ ${usd(position.latestPrice)} · now`} />
        <Card label="Total Return" value={pct(allTime.totalReturnPct)} sub="All-time on tracked capital" tone={allTime.totalReturnPct >= 0 ? 'pos' : 'neg'} />
      </div>
      {hasUntracked && (
        <div className="notice">
          {untracked.disposals} untracked disposal{untracked.disposals > 1 ? 's' : ''} ({qty(untracked.quantity)} units sold with no recorded purchase — excluded from P&amp;L).
        </div>
      )}
    </>
  );
}

/** Combined (all-ticker) card set. */
export function CombinedSummaryCards({ combined, tickerCount }: { combined: CombinedSummary; tickerCount: number }) {
  const { range, position, allTime, untracked } = combined;
  const hasUntracked = untracked && untracked.disposals > 0;
  return (
    <>
      <div className="cards">
        <Card label="Money In (range)" value={usd(range.moneyIn)} sub={`Across ${tickerCount} tickers`} />
        <Card label="Fees Paid (range)" value={usd(range.fees)} sub="Maker/taker fees" />
        <Card label="Realized P&L (range)" value={usd(range.realizedPnl)} sub="Tracked sells, fees deducted" tone={range.realizedPnl >= 0 ? 'pos' : 'neg'} />
        <Card label="Portfolio Value" value={usd(position.currentValue)} sub={`Current holdings · now`} />
        <Card label="Total Return" value={pct(allTime.totalReturnPct)} sub="All-time on tracked capital" tone={allTime.totalReturnPct >= 0 ? 'pos' : 'neg'} />
      </div>
      {hasUntracked && (
        <div className="notice">
          {untracked.disposals} untracked disposal{untracked.disposals > 1 ? 's' : ''} across your tickers (holdings sold with no recorded purchase — excluded from P&amp;L).
        </div>
      )}
    </>
  );
}
