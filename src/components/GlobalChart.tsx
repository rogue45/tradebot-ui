import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis,
} from 'recharts';
import type { Fill, PricePoint } from '../api';
import { usd, dateTime, shortDate } from '../format';

export interface TickerSeries {
  ticker: string;
  color: string;
  prices: PricePoint[];
  fills: Fill[];
}

interface Props {
  series: TickerSeries[];
}

const BUY_COLOR = '#16a34a';
const SELL_COLOR = '#dc2626';

// Each ticker is normalized to % change from its first price in range, so BTC (~$66k),
// ETH (~$1.9k) and XRP (~$1.10) are comparable on one axis.
function normalize(points: { time: number; price: number }[], base: number) {
  return points.map(p => ({ time: p.time, pct: base ? ((p.price / base) - 1) * 100 : 0 }));
}

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
    const f = p as Fill & { pct: number };
    return (
      <div className="tooltip">
        <div className="tooltip-title" style={{ color: f.side === 'BUY' ? BUY_COLOR : SELL_COLOR }}>
          {f.ticker} · {f.side} · {dateTime(f.time)}
        </div>
        <div>{f.quantity} @ {usd(f.price)} ({f.pct >= 0 ? '+' : ''}{f.pct.toFixed(1)}%)</div>
        <div>Value {usd(f.usdValue)} · Fees {usd(f.fees)}</div>
        {f.reason && <div className="tooltip-reason">{f.reason}</div>}
      </div>
    );
  }
  return (
    <div className="tooltip">
      <div className="tooltip-title">{dateTime(p.time)}</div>
      <div>{p.ticker}: {p.pct >= 0 ? '+' : ''}{p.pct.toFixed(2)}%</div>
    </div>
  );
}

export default function GlobalChart({ series }: Props) {
  const withData = series.filter(s => s.prices.length > 0);
  if (!withData.length) {
    return <div className="empty">No price data in this range.</div>;
  }

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
          allowDuplicatedCategory={false}
        />
        <YAxis
          tickFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
          stroke="var(--axis)"
          fontSize={12}
          width={56}
        />
        <ZAxis range={[80, 80]} />
        <Tooltip content={<ChartTooltip />} />
        {withData.map(s => {
          const base = s.prices[0].price;
          const line = normalize(s.prices, base).map(p => ({ ...p, ticker: s.ticker }));
          return (
            <Line
              key={`line-${s.ticker}`}
              data={line}
              dataKey="pct"
              type="monotone"
              stroke={s.color}
              dot={false}
              strokeWidth={1.75}
              isAnimationActive={false}
              name={s.ticker}
            />
          );
        })}
        {withData.map(s => {
          const base = s.prices[0].price;
          const markers = s.fills.map(f => ({
            ...f,
            time: f.time,
            pct: base ? ((f.price / base) - 1) * 100 : 0,
          }));
          return (
            <Scatter
              key={`markers-${s.ticker}`}
              data={markers}
              dataKey="pct"
              shape={<TradeMarker />}
              isAnimationActive={false}
              name={`${s.ticker} trades`}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
