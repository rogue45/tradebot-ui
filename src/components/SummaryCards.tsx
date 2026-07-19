import type { Summary } from '../api';
import { usd, pct, qty } from '../format';

interface Props {
  summary: Summary;
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' | 'neutral' }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className={`card-value ${tone ?? ''}`}>{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}

export default function SummaryCards({ summary }: Props) {
  const { range, position, allTime } = summary;
  const returnTone = allTime.totalReturnPct >= 0 ? 'pos' : 'neg';
  const realizedTone = range.realizedPnl >= 0 ? 'pos' : 'neg';

  return (
    <div className="cards">
      <Card label="Money In (range)" value={usd(range.moneyIn)} sub="USD spent on buys" />
      <Card label="Fees Paid (range)" value={usd(range.fees)} sub="Maker/taker fees" />
      <Card
        label="Realized P&L (range)"
        value={usd(range.realizedPnl)}
        sub="From sells, fees deducted"
        tone={realizedTone}
      />
      <Card
        label="Current Holdings"
        value={usd(position.currentValue)}
        sub={`${qty(position.openQuantity)} @ ${usd(position.latestPrice)} · now`}
      />
      <Card
        label="Total Return"
        value={pct(allTime.totalReturnPct)}
        sub="All-time, realized + unrealized"
        tone={returnTone}
      />
    </div>
  );
}
