import type { Fill } from '../api';
import { usd, dateTime } from '../format';

interface Props {
  fills: Fill[];
}

// Condensed ledger of executed buys/sells, most recent first.
export default function TradesTable({ fills }: Props) {
  if (!fills.length) {
    return <div className="empty-table">No trades in this range.</div>;
  }
  const rows = [...fills].sort((a, b) => b.time - a.time);

  return (
    <div className="trades-wrap">
      <table className="trades">
        <thead>
          <tr>
            <th>Date</th>
            <th>Ticker</th>
            <th>Action</th>
            <th className="num">Price</th>
            <th className="num">Amount</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f, i) => (
            <tr key={f.orderId || `${f.time}-${i}`}>
              <td className="nowrap">{dateTime(f.time)}</td>
              <td>{f.ticker}</td>
              <td>
                <span className={`badge ${f.side === 'BUY' ? 'buy' : 'sell'}`}>{f.side}</span>
              </td>
              <td className="num">{usd(f.price)}</td>
              <td className="num">{usd(f.usdValue)}</td>
              <td className="reason" title={f.reason || ''}>{f.reason || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
