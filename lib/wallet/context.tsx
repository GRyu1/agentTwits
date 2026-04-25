'use client'

/**
 * WalletProvider — top-level state for:
 *   - browser wallet connection (Base Sepolia chain enforced)
 *   - 8004 agentId after IdentityRegistry.register()
 *   - per-agent minimal-proxy wallet info (factory deploy receipt)
 *
 * This sits above MyTraderProvider so the trading agent can read wallet
 * state from server APIs (which look it up by owner address).
 */

import {
  createContext, useCallback, useContext, useEffect, useState,
  type ReactNode,
} from 'react'
import type { Address, Hex } from 'viem'
import {
  connectWallet,
  ensureBaseSepolia,
  hasMetaMask,
  onAccountChange,
  onChainChange,
  type WalletState,
} from './connect'

interface AgentIdentity {
  agentId: string
  agentDomain: string
  registerTxHash: Hex
  registerExplorerUrl: string
  registerMode: 'LIVE' | 'SIMULATED'
  // Coinbase AgentKit (CDP) wallet — the agent's on-chain signer.
  cdpWalletAddress?: Address
  cdpNetworkId?: string
  cdpSource?: 'cdp' | 'mock'
}

interface AgentWalletSummary {
  walletAddress: Address
  factory: Address
  implementation: Address
  txHash: Hex
  explorerUrl: string
  mode: 'LIVE' | 'SIMULATED'
}

interface WalletCtx {
  // browser wallet
  wallet: WalletState | null
  connecting: boolean
  connectError: string | null
  metamaskInstalled: boolean
  connect: () => Promise<void>
  ensureChain: () => Promise<void>

  // ERC-8004 identity
  identity: AgentIdentity | null
  registering: boolean
  register: () => Promise<void>

  // minimal-proxy agent wallet
  agentWallet: AgentWalletSummary | null
  creatingAgentWallet: boolean
  createAgentWallet: () => Promise<void>

  // reputation snapshot synced from server
  repScore: number
}

const Ctx = createContext<WalletCtx | null>(null)

export function useWallet(): WalletCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWallet() must be used inside <WalletProvider>')
  return v
}

const LS_KEY = 'fearnet:wallet:v1'

interface Persisted {
  wallet?: WalletState
  identity?: AgentIdentity
  agentWallet?: AgentWalletSummary
}

function loadPersisted(): Persisted {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function savePersisted(p: Persisted) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)) } catch {}
}

export default function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [metamaskInstalled, setMetamaskInstalled] = useState(false)

  const [identity, setIdentity] = useState<AgentIdentity | null>(null)
  const [registering, setRegistering] = useState(false)

  const [agentWallet, setAgentWallet] = useState<AgentWalletSummary | null>(null)
  const [creatingAgentWallet, setCreating] = useState(false)

  const [repScore, setRepScore] = useState(50)

  // ── Hydrate from localStorage on mount ──
  useEffect(() => {
    const p = loadPersisted()
    if (p.wallet) setWallet(p.wallet)
    if (p.identity) setIdentity(p.identity)
    if (p.agentWallet) setAgentWallet(p.agentWallet)
    setMetamaskInstalled(hasMetaMask())
    // re-check after a tick in case the EIP-6963 announce hasn't fired yet
    const t = setTimeout(() => setMetamaskInstalled(hasMetaMask()), 400)
    return () => clearTimeout(t)
  }, [])

  // ── Persist on changes ──
  useEffect(() => {
    savePersisted({
      wallet: wallet ?? undefined,
      identity: identity ?? undefined,
      agentWallet: agentWallet ?? undefined,
    })
  }, [wallet, identity, agentWallet])

  // ── Listen for wallet account/chain changes ──
  useEffect(() => {
    if (!hasMetaMask()) return
    const offAcc = onAccountChange(async accs => {
      if (!accs[0]) {
        setWallet(null)
        return
      }
      setWallet(w => w ? { ...w, address: accs[0] } : w)
    })
    const offChain = onChainChange(async id => {
      setWallet(w => w ? { ...w, chainIdHex: id, chainId: parseInt(id, 16), onBaseSepolia: parseInt(id, 16) === 84532 } : w)
    })
    return () => { offAcc(); offChain() }
  }, [])

  // ── Reputation polling — pulls latest 8004 score for connected agentId ──
  useEffect(() => {
    if (!identity?.agentId) return
    let stop = false
    const pull = async () => {
      try {
        const r = await fetch(`/api/erc8004/reputation?agentId=${identity.agentId}`, { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json()
        if (!stop && typeof j.score === 'number') setRepScore(j.score)
      } catch {}
    }
    pull()
    const t = setInterval(pull, 2500)
    return () => { stop = true; clearInterval(t) }
  }, [identity?.agentId])

  const connect = useCallback(async () => {
    setConnectError(null)
    setConnecting(true)
    try {
      const s = await connectWallet()
      setWallet(s)
    } catch (e: any) {
      setConnectError(e?.message ?? 'wallet connect failed')
    } finally {
      setConnecting(false)
    }
  }, [])

  const ensureChain = useCallback(async () => {
    await ensureBaseSepolia()
  }, [])

  const register = useCallback(async () => {
    if (!wallet?.address) throw new Error('Connect wallet first')
    setRegistering(true)
    try {
      const r = await fetch('/api/erc8004/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          owner: wallet.address,
          agentDomain: `fearnet-${wallet.address.slice(2, 8)}.local`,
        }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j?.error ?? 'register failed')
      setIdentity({
        agentId: j.agentId,
        agentDomain: j.agentDomain,
        registerTxHash: j.txHash,
        registerExplorerUrl: j.explorerUrl,
        registerMode: j.mode,
        cdpWalletAddress: j.cdpWallet?.address,
        cdpNetworkId: j.cdpWallet?.networkId,
        cdpSource: j.cdpWallet?.source,
      })
    } finally {
      setRegistering(false)
    }
  }, [wallet?.address])

  const createAgentWallet = useCallback(async () => {
    if (!wallet?.address) throw new Error('Connect wallet first')
    if (!identity?.agentId) throw new Error('Register agent (ERC-8004) first')
    setCreating(true)
    try {
      const r = await fetch('/api/agent-wallet/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          agentId: identity.agentId,
          ownerAddress: wallet.address,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error ?? 'create wallet failed')
      setAgentWallet({
        walletAddress: j.walletAddress,
        factory: j.factory,
        implementation: j.implementation,
        txHash: j.txHash,
        explorerUrl: j.explorerUrl,
        mode: j.mode,
      })
    } finally {
      setCreating(false)
    }
  }, [wallet?.address, identity?.agentId])

  return (
    <Ctx.Provider
      value={{
        wallet, connecting, connectError, metamaskInstalled, connect, ensureChain,
        identity, registering, register,
        agentWallet, creatingAgentWallet, createAgentWallet,
        repScore,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
