'use client'

/**
 * WalletPanel — drives the 4-step Base Sepolia onboarding for the user's trader:
 *   1. Connect wallet  (login)
 *   2. ERC-8004 IdentityRegistry.register()  → mints agentId (the 8004 token)
 *   3. Spawn minimal-proxy AgentWallet via factory (auth-gated by 8004 token)
 *   4. (passive) deposit pulls happen during trading via x402,
 *      reputation updates land on every position close.
 *
 * Hackathon mode: complex on-chain steps simulate when AGENT_LIVE_TX != true,
 * but ABIs / addresses / calldata are real-shape so the demo reads as authentic.
 */

import { useEffect, useState } from 'react'
import { useWallet } from '@/lib/wallet/context'
import { METAMASK_INSTALL_URL } from '@/lib/wallet/connect'

const shortAddr = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—'
const shortHash = (h?: string) => !h || h === '0x0' ? '—' : `${h.slice(0, 8)}…${h.slice(-6)}`

interface RepView {
  agentId: string
  score: number
  totalPnlUsd: number
  feedbackCount: number
  pulledDepositUsd: number
  log: Array<{
    at: string
    kind: 'register' | 'create_wallet' | 'pull_deposit' | 'reputation_update'
    agentId: string
    detail: any
  }>
}

export default function WalletPanel() {
  const {
    wallet, connecting, connectError, metamaskInstalled, connect,
    identity, registering, register,
    agentWallet, creatingAgentWallet, createAgentWallet,
  } = useWallet()

  const [rep, setRep] = useState<RepView | null>(null)
  useEffect(() => {
    if (!identity?.agentId) return
    let stop = false
    const pull = async () => {
      try {
        const r = await fetch(`/api/erc8004/reputation?agentId=${identity.agentId}`, { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json()
        if (!stop) setRep(j)
      } catch {}
    }
    pull()
    const t = setInterval(pull, 2500)
    return () => { stop = true; clearInterval(t) }
  }, [identity?.agentId])

  const onWrongChain = !!wallet && !wallet.onBaseSepolia

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="w-2 h-2" style={{ background: 'var(--money)' }} />
        🦊 MetaMask · Base Sepolia · ERC-8004 Setup
        {wallet && (
          <span className={`chip ml-auto ${onWrongChain ? 'chip-sell' : 'chip-buy'}`}>
            {onWrongChain ? `chain ${wallet.chainId}` : 'chain 84532'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ borderBottom: '2px solid var(--line-2)' }}>
        {/* Step 1 — Connect MetaMask */}
        <Step
          n={1}
          label="Connect MetaMask"
          status={wallet ? 'done' : 'pending'}
          rightBorder
        >
          {wallet ? (
            <div className="space-y-1.5">
              <Row k="Wallet" v={<span className="text-buy font-bold">🦊 MetaMask</span>} />
              <Row k="Address" v={<span className="font-mono">{shortAddr(wallet.address)}</span>} />
              <Row k="Chain" v={onWrongChain
                ? <span className="text-sell font-bold">{wallet.chainId} (switch ↗)</span>
                : <span className="text-buy font-bold">Base Sepolia</span>} />
            </div>
          ) : metamaskInstalled ? (
            <button onClick={connect} disabled={connecting} className="btn btn-money" style={{ width: '100%' }}>
              {connecting ? 'CONNECTING…' : '🦊 CONNECT METAMASK'}
            </button>
          ) : (
            <a
              href={METAMASK_INSTALL_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn-money"
              style={{ width: '100%', display: 'inline-block', textAlign: 'center' }}
            >
              🦊 INSTALL METAMASK ↗
            </a>
          )}
          {connectError && <div className="text-xs text-sell mt-2">{connectError}</div>}
        </Step>

        {/* Step 2 — Register on ERC-8004 */}
        <Step
          n={2}
          label="ERC-8004 register()"
          status={identity ? 'done' : wallet ? 'pending' : 'locked'}
          rightBorder
        >
          {identity ? (
            <div className="space-y-1.5">
              <Row k="agentId" v={<span className="font-mono text-money font-bold">#{identity.agentId}</span>} />
              <Row k="domain" v={<span className="font-mono text-xs">{identity.agentDomain}</span>} />
              <Row k="tx" v={
                <a href={identity.registerExplorerUrl} target="_blank" rel="noreferrer"
                   className="font-mono text-xs underline" style={{ color: 'var(--fear)' }}>
                  {shortHash(identity.registerTxHash)}
                </a>
              } />
              <Row k="mode" v={<span className={identity.registerMode === 'LIVE' ? 'text-buy font-bold' : 'text-money font-bold'}>{identity.registerMode}</span>} />
            </div>
          ) : (
            <button
              onClick={register}
              disabled={!wallet || registering || onWrongChain}
              className="btn"
              style={{ width: '100%' }}
            >
              {registering ? 'REGISTERING…' : 'REGISTER AGENT'}
            </button>
          )}
        </Step>

        {/* Step 3 — Spawn AgentWallet */}
        <Step
          n={3}
          label="Spawn AgentWallet (EIP-1167)"
          status={agentWallet ? 'done' : identity ? 'pending' : 'locked'}
        >
          {agentWallet ? (
            <div className="space-y-1.5">
              <Row k="wallet" v={<span className="font-mono">{shortAddr(agentWallet.walletAddress)}</span>} />
              <Row k="factory" v={<span className="font-mono text-xs">{shortAddr(agentWallet.factory)}</span>} />
              <Row k="impl" v={<span className="font-mono text-xs">{shortAddr(agentWallet.implementation)}</span>} />
              <Row k="tx" v={
                <a href={agentWallet.explorerUrl} target="_blank" rel="noreferrer"
                   className="font-mono text-xs underline" style={{ color: 'var(--fear)' }}>
                  {shortHash(agentWallet.txHash)}
                </a>
              } />
            </div>
          ) : (
            <button
              onClick={createAgentWallet}
              disabled={!identity || creatingAgentWallet}
              className="btn"
              style={{ width: '100%' }}
            >
              {creatingAgentWallet ? 'DEPLOYING…' : 'CREATE AGENT WALLET'}
            </button>
          )}
        </Step>
      </div>

      {/* Reputation + activity ledger */}
      {identity && (
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="px-4 py-3" style={{ borderRight: '2px solid var(--line-2)' }}>
            <div className="text-xs text-ink-3 uppercase tracking-wider mb-2">8004 Reputation</div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-3xl tabular-nums" style={{ color: 'var(--money)' }}>
                {rep?.score ?? 50}
              </span>
              <span className="text-xs text-ink-3">/ 100</span>
              <span className="ml-auto text-sm font-mono" style={{ color: (rep?.totalPnlUsd ?? 0) >= 0 ? 'var(--buy)' : 'var(--sell)' }}>
                ${(rep?.totalPnlUsd ?? 0).toFixed(2)} cum
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <Mini k="feedback" v={rep?.feedbackCount ?? 0} />
              <Mini k="x402 pulled" v={`$${(rep?.pulledDepositUsd ?? 0).toFixed(2)}`} />
              <Mini k="agentId" v={`#${identity.agentId}`} mono />
            </div>
          </div>
          <div className="px-4 py-3 max-h-44 overflow-y-auto">
            <div className="text-xs text-ink-3 uppercase tracking-wider mb-2">8004 Activity</div>
            {(rep?.log?.length ?? 0) === 0 ? (
              <div className="text-xs text-ink-3">no activity yet · open a position to see deposit pulls and rep updates</div>
            ) : (
              <ul className="space-y-1 text-xs font-mono">
                {rep!.log.map((l, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={`chip ${
                      l.kind === 'reputation_update' ? (l.detail.pnlUsd >= 0 ? 'chip-buy' : 'chip-sell') :
                      l.kind === 'pull_deposit' ? 'chip-money' :
                      l.kind === 'create_wallet' ? 'chip-ghost' : 'chip-ghost'
                    }`} style={{ fontSize: 9 }}>
                      {l.kind === 'reputation_update' ? 'REP' :
                       l.kind === 'pull_deposit' ? 'PULL' :
                       l.kind === 'create_wallet' ? 'WALLET' : 'REG'}
                    </span>
                    <span className="text-ink-2 flex-1 truncate">
                      {l.kind === 'reputation_update' && `pnl $${l.detail.pnlUsd.toFixed(2)} → score ${l.detail.newScore}`}
                      {l.kind === 'pull_deposit' && `$${l.detail.amountUsd.toFixed(2)} → ${shortAddr(l.detail.toOwner)}`}
                      {l.kind === 'create_wallet' && `clone ${shortAddr(l.detail.agentWalletAddress)}`}
                      {l.kind === 'register' && `owner ${shortAddr(l.detail.owner)}`}
                    </span>
                    <span className="text-ink-3">{new Date(l.at).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Step({
  n, label, status, rightBorder, children,
}: {
  n: number; label: string; status: 'locked' | 'pending' | 'done'; rightBorder?: boolean; children: any
}) {
  const tone =
    status === 'done' ? 'var(--buy)' :
    status === 'pending' ? 'var(--money)' :
    'var(--line-2)'
  return (
    <div className="px-4 py-3" style={{
      borderRight: rightBorder ? '2px solid var(--line-2)' : 'none',
      borderBottom: '2px solid var(--line-2)',
      opacity: status === 'locked' ? 0.55 : 1,
    }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono font-bold text-xs text-ink-3">0{n}</span>
        <span className="w-2 h-2" style={{ background: tone }} />
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        <span className="ml-auto text-xs" style={{ color: tone }}>
          {status === 'done' ? '✓' : status === 'pending' ? '·' : '⌧'}
        </span>
      </div>
      {children}
    </div>
  )
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-ink-3">{k}</span>
      <span className="text-ink text-right">{v}</span>
    </div>
  )
}

function Mini({ k, v, mono }: { k: string; v: any; mono?: boolean }) {
  return (
    <div style={{ border: '1.5px solid var(--line-2)' }} className="px-2 py-1.5">
      <div className="text-ink-3" style={{ fontSize: 10 }}>{k}</div>
      <div className={`font-bold tabular-nums ${mono ? 'font-mono' : ''}`}>{v}</div>
    </div>
  )
}
