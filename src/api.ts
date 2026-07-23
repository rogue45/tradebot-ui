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
  cashUsd: number;
}

// Base URL of the backend API (served by the tradebot bot process). Injected at runtime via
// public/config.js -> window.__API_BASE__ (empty string = same-origin, used in dev via the Vite proxy).
const API_BASE: string = ((window as unknown as { __API_BASE__?: string }).__API_BASE__ ?? '').replace(/\/$/, '');

export interface EditableConfig {
  trade_cooldown_minutes: number;
  trade_allocation_usd: number;
  bounce_confirm_pct: number;
  target_profit_pct: number;
  trailing_stop_pct: number;
}

export interface SignalVote {
  name: string;
  vote: number;
  detail: string;
}

// Two independent buy archetypes (see signalEngine.js): either one firing is a buy candidate.
export interface DipReversalEval {
  isCandidate: boolean;
  netScore: number;
  confidence: number;
  dipConfirmed: boolean;
  reversalConfirmed: boolean;
  requireReversal?: boolean;
  reversalGateBlocked?: boolean;
  trendGateBlocked: boolean;
  floorPrice: number | null;
  floorBroken: boolean;
  bounceConfirmPct: number;
  bounceConfirmed: boolean;
  votes: SignalVote[];
}

export interface BreakoutEval {
  isCandidate: boolean;
  netScore: number;
  confidence: number;
  levelConfirmed: boolean;
  momentumConfirmed: boolean;
  requireMomentum?: boolean;
  momentumGateBlocked?: boolean;
  trendGateBlocked: boolean;
  breakoutLevel: number | null;
  breakoutFailed: boolean;
  breakoutConfirmPct: number;
  breakoutConfirmed: boolean;
  votes: SignalVote[];
}

export interface SignalSnapshot {
  ticker: string;
  currentPrice: number;
  confidence: number;
  isCandidate: boolean;
  dipReversal: DipReversalEval;
  breakout: BreakoutEval;
  time: number;
}

// Historical buy/sell on/off state (see influxClient.writeSignalSnapshot), not the same as
// SignalSnapshot above - that's an in-memory cache of only the latest tick.
export interface SignalHistoryPoint {
  time: number;
  buySignal: boolean;
  dipReversalSignal: boolean;
  breakoutSignal: boolean;
  sellSignal: boolean;
}

export interface SignalHistory {
  ticker: string;
  start: string;
  stop: string;
  points: SignalHistoryPoint[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function sendJson<T>(url: string, method: string, payload: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
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

export const fetchConfig = () => getJson<EditableConfig>('/api/config');

export const updateConfig = (patch: Partial<EditableConfig>) =>
  sendJson<{ applied: Partial<EditableConfig>; persisted: boolean }>('/api/config', 'PATCH', patch);

export const fetchSignals = () =>
  getJson<{ signals: Record<string, SignalSnapshot> }>('/api/signals').then(r => r.signals);

export const fetchSignalHistory = (ticker: string, start: string, stop: string) =>
  getJson<SignalHistory>(`/api/signal-history?ticker=${encodeURIComponent(ticker)}&start=${start}&stop=${stop}`);
