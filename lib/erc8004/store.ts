// Server-side mirror of the on-chain ERC-8004 + AgentWallet state.
// Hackathon: in-memory; survives within a process. Real impl reads from chain.

import type { Address, Hex } from 'viem'

export interface AgentRecord {
  agentId: string
  agentDomain: string
  ownerAddress: Address          // 8004 token holder — also auth root
  registerTxHash: Hex
  registerExplorerUrl: string
  registerMode: 'LIVE' | 'SIMULATED'
  registeredAt: string
  // Per-agent reputation, updated by ReputationRegistry.acceptFeedback.
  repScore: number               // 0-100
  totalPnlUsd: number            // cumulative realized P&L (USD)
  feedbackCount: number
  // Minimal-proxy wallet (3-1)
  agentWalletAddress?: Address
  agentWalletTxHash?: Hex
  agentWalletExplorerUrl?: string
  agentWalletMode?: 'LIVE' | 'SIMULATED'
  // Cumulative deposit pulled to owner via x402 (3-3)
  pulledDepositUsd: number
}

interface ERC8004Store {
  agentsById: Record<string, AgentRecord>
  agentIdByOwner: Record<string, string>     // lowercased owner -> agentId
  // Audit trail (3-3 + 3-4) — surfaced in My Trader UI for the demo
  log: Array<{
    at: string
    kind: 'register' | 'create_wallet' | 'pull_deposit' | 'reputation_update'
    agentId: string
    detail: any
  }>
}

const g = globalThis as unknown as { __fearNet8004?: ERC8004Store }
if (!g.__fearNet8004) g.__fearNet8004 = { agentsById: {}, agentIdByOwner: {}, log: [] }
export const erc8004Store = g.__fearNet8004!

export function recordRegister(rec: Omit<AgentRecord, 'repScore' | 'totalPnlUsd' | 'feedbackCount' | 'pulledDepositUsd'>) {
  const full: AgentRecord = {
    ...rec,
    repScore: 50,
    totalPnlUsd: 0,
    feedbackCount: 0,
    pulledDepositUsd: 0,
  }
  erc8004Store.agentsById[rec.agentId] = full
  erc8004Store.agentIdByOwner[rec.ownerAddress.toLowerCase()] = rec.agentId
  erc8004Store.log.unshift({
    at: new Date().toISOString(), kind: 'register', agentId: rec.agentId,
    detail: { owner: rec.ownerAddress, txHash: rec.registerTxHash, mode: rec.registerMode },
  })
  erc8004Store.log = erc8004Store.log.slice(0, 50)
  return full
}

export function recordAgentWallet(agentId: string, patch: {
  agentWalletAddress: Address
  agentWalletTxHash: Hex
  agentWalletExplorerUrl: string
  agentWalletMode: 'LIVE' | 'SIMULATED'
}) {
  const a = erc8004Store.agentsById[agentId]
  if (!a) return null
  Object.assign(a, patch)
  erc8004Store.log.unshift({
    at: new Date().toISOString(), kind: 'create_wallet', agentId,
    detail: patch,
  })
  erc8004Store.log = erc8004Store.log.slice(0, 50)
  return a
}

export function recordDepositPull(agentId: string, amountUsd: number, txHash: Hex) {
  const a = erc8004Store.agentsById[agentId]
  if (!a) return null
  a.pulledDepositUsd = Number((a.pulledDepositUsd + amountUsd).toFixed(2))
  erc8004Store.log.unshift({
    at: new Date().toISOString(), kind: 'pull_deposit', agentId,
    detail: { amountUsd, txHash, toOwner: a.ownerAddress },
  })
  erc8004Store.log = erc8004Store.log.slice(0, 50)
  return a
}

export function recordReputation(agentId: string, pnlUsd: number, newScore: number, txHash: Hex) {
  const a = erc8004Store.agentsById[agentId]
  if (!a) return null
  a.repScore = newScore
  a.totalPnlUsd = Number((a.totalPnlUsd + pnlUsd).toFixed(2))
  a.feedbackCount += 1
  erc8004Store.log.unshift({
    at: new Date().toISOString(), kind: 'reputation_update', agentId,
    detail: { pnlUsd, newScore, txHash },
  })
  erc8004Store.log = erc8004Store.log.slice(0, 50)
  return a
}

export function getAgent(agentId: string): AgentRecord | null {
  return erc8004Store.agentsById[agentId] ?? null
}

export function getAgentByOwner(owner: Address): AgentRecord | null {
  const id = erc8004Store.agentIdByOwner[owner.toLowerCase()]
  return id ? (erc8004Store.agentsById[id] ?? null) : null
}

export function recentLog(limit = 20) {
  return erc8004Store.log.slice(0, limit)
}
