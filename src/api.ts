// Typed client for the tradebot-ui backend API.

export interface PricePoint {
  time: number; // epoch ms
  price: number;
}

export interface Fill {
  time: number;
  ticker: string;
  side: 'BUY' | 'SELL';
  orderId: string;
  quantity: number;
  price: number;
  usdValue: number;
  fees: number;
  realizedPnl: number | null;
  reason?: string;
}

export interface Timeline {
  ticker: string;
  start: string;
  stop: string;
  prices: PricePoint[];
  fills: Fill[];
}

export interface Summary {
  ticker: string;
  range: { moneyIn: number; fees: number; realizedPnl: number };
  position: {
    openQuantity: number;
    costBasis: number;
    latestPrice: number | null;
    currentValue: number;
    unrealizedPnl: number;
  };
  allTime: { moneyIn: number; realizedPnl: number; totalReturnPct: number };
  untracked: { disposals: number; quantity: number };
}

export interface CombinedSummary {
  range: { moneyIn: number; fees: number; realizedPnl: number };
  position: { currentValue: number; unrealizedPnl: number };
  allTime: { moneyIn: number; realizedPnl: number; totalReturnPct: number };
  untracked: { disposals: number };
}

export interface Overview {
  start: string;
  stop: string;
  tickers: { ticker: string; prices: PricePoint[]; fills: Fill[]; summary: Summary }[];
  combined: CombinedSummary;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const fetchTickers = () =>
  getJson<{ tickers: string[] }>('/api/tickers').then(r => r.tickers);

export const fetchTimeline = (ticker: string, start: string, stop: string) =>
  getJson<Timeline>(`/api/timeline?ticker=${encodeURIComponent(ticker)}&start=${start}&stop=${stop}`);

export const fetchSummary = (ticker: string, start: string, stop: string) =>
  getJson<Summary>(`/api/summary?ticker=${encodeURIComponent(ticker)}&start=${start}&stop=${stop}`);

export const fetchOverview = (start: string, stop: string) =>
  getJson<Overview>(`/api/overview?start=${start}&stop=${stop}`);
