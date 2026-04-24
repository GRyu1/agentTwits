// In-memory agent state for the demo. One process = one state.
// Good enough for a hackathon — swap for Redis/DB for production.

export type AgentStatus = 'idle' | 'fetching_market' | 'paying_x402' | 'deciding' | 'swapping' | 'done' | 'error'

export interface X402Payment {
  endpoint: string
  amount: string    // e.g. "0.001 ETH" or "$0.001"
  txHash: string
  paidAt: string
  status: 'PAID' | 'VERIFIED' | 'FAILED'
}

export interface AgentDecision {
  action: 'BUY' | 'SELL' | 'HOLD'
  emotion: 'Aggressive' | 'Optimistic' | 'Neutral' | 'Cautious' | 'Defensive'
  confidence: number
  message: string
  reasoning: string
  trend?: 'bullish' | 'bearish' | 'sideways'
  trendScore?: number
}

export interface AgentRun {
  id: string
  startedAt: string
  finishedAt?: string
  status: AgentStatus
  step: string
  market?: any
  premiumSignal?: any
  x402Payments: X402Payment[]
  decision?: AgentDecision
  swap?: any
  error?: string
}

export interface ExternalAgent {
  id: string             // agent self-declared id (slug)
  name: string
  emoji: string
  wallet?: string
  repScore: number
  signalsSubmitted: number
  x402Paid: number
  lastHeartbeat: string
  joinedAt: string
  recentSignals: Array<{
    at: string
    asset: string
    bias: 'LONG' | 'SHORT' | 'NEUTRAL'
    note: string
  }>
}

interface Store {
  currentRun: AgentRun | null
  history: AgentRun[]
  externalAgents: Record<string, ExternalAgent>
}

const g = globalThis as unknown as { __fearNetStore?: Store }
if (!g.__fearNetStore) g.__fearNetStore = { currentRun: null, history: [], externalAgents: {} }
export const store = g.__fearNetStore!

export function upsertExternal(
  id: string,
  patch: Partial<ExternalAgent> & { name?: string; emoji?: string },
): ExternalAgent {
  const now = new Date().toISOString()
  const existing = store.externalAgents[id]
  const next: ExternalAgent = existing
    ? { ...existing, ...patch, lastHeartbeat: now }
    : {
        id,
        name: patch.name ?? id,
        emoji: patch.emoji ?? '🛰️',
        wallet: patch.wallet,
        repScore: 5,
        signalsSubmitted: 0,
        x402Paid: 0,
        lastHeartbeat: now,
        joinedAt: now,
        recentSignals: [],
        ...patch,
      }
  store.externalAgents[id] = next
  return next
}

export function listExternals(): ExternalAgent[] {
  return Object.values(store.externalAgents).sort((a, b) => b.repScore - a.repScore)
}

export function newRun(): AgentRun {
  const run: AgentRun = {
    id: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    startedAt: new Date().toISOString(),
    status: 'idle',
    step: 'initialized',
    x402Payments: [],
  }
  store.currentRun = run
  return run
}

export function updateRun(patch: Partial<AgentRun>) {
  if (!store.currentRun) return
  Object.assign(store.currentRun, patch)
}

export function finishRun(patch: Partial<AgentRun>) {
  if (!store.currentRun) return
  Object.assign(store.currentRun, patch, { finishedAt: new Date().toISOString() })
  store.history.unshift(store.currentRun)
  store.history = store.history.slice(0, 20)
}

export function getState() {
  return { currentRun: store.currentRun, history: store.history }
}
