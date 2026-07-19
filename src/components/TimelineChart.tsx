import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ZAxis,
} from 'recharts';
import type { Fill, PricePoint } from '../api';
import { usd, dateTime, shortDate } from '../format';

interface Props {
  prices: PricePoint[];
  fills: Fill[];
}

const BUY_COLOR = '#16a34a';
const SELL_COLOR = '#dc2626';

// Triangle marker: up (green) for buys, down (red) for sells, plotted at the fill price.
function TradeMarker(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const isBuy = payload.side === 'BUY';
  const color = isBuy ? BUY_COLOR : SELL_COLOR;
  const d = isBuy
    ? `M ${cx} ${cy - 7} L ${cx - 6} ${cy + 4} L ${cx + 6} ${cy + 4} Z`
    : `M ${cx} ${cy + 7} L ${cx - 6} ${cy - 4} L ${cx + 6} ${cy - 4} Z`;
  return <path d={d} fill={color} stroke="#fff" strokeWidth={1} />;
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (p.side) {
    // Trade marker point
    const f = p as Fill;
    return (
      <div className="tooltip">
        <div className="tooltip-title" style={{ color: f.side === 'BUY' ? BUY_COLOR : SELL_COLOR }}>
          {f.side} · {dateTime(f.time)}
        </div>
        <div>{f.quantity} @ {usd(f.price)}</div>
        <div>Value {usd(f.usdValue)} · Fees {usd(f.fees)}</div>
        {f.realizedPnl != null && <div>Realized P&L {usd(f.realizedPnl)}</div>}
        {f.reason && <div className="tooltip-reason">{f.reason}</div>}
      </div>
    );
  }
  return (
    <div className="tooltip">
      <div className="tooltip-title">{dateTime(p.time)}</div>
      <div>Price {usd(p.price)}</div>
    </div>
  );
}

export default function TimelineChart({ prices, fills }: Props) {
  if (!prices.length) {
    return <div className="empty">No price data in this range.</div>;
  }
  const times = prices.map(p => p.price);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const pad = (max - min) * 0.05 || max * 0.01;

  return (
    <ResponsiveContainer width="100%" height={420}>
      <ComposedChart margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
        <XAxis
          dataKey="time"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={shortDate}
          stroke="var(--axis)"
          fontSize={12}
        />
        <YAxis
          domain={[min - pad, max + pad]}
          tickFormatter={(v) => usd(v)}
          stroke="var(--axis)"
          fontSize={12}
          width={72}
        />
        <ZAxis range={[80, 80]} />
        <Tooltip content={<ChartTooltip />} />
        {fills.map((f, i) => (
          <ReferenceLine
            key={`ref-${i}`}
            x={f.time}
            stroke={f.side === 'BUY' ? BUY_COLOR : SELL_COLOR}
            strokeOpacity={0.25}
          />
        ))}
        <Line
          data={prices}
          dataKey="price"
          type="monotone"
          stroke="var(--price-line)"
          dot={false}
          strokeWidth={1.75}
          isAnimationActive={false}
          name="Price"
        />
        <Scatter
          data={fills.map(f => ({ ...f }))}
          dataKey="price"
          shape={<TradeMarker />}
          isAnimationActive={false}
          name="Trades"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
