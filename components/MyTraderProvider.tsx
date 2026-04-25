'use client'

/**
 * MyTraderProvider — single source of truth for the user's trader.
 *
 * Previously persona / direction / heartbeat / positions / polling all lived
 * inside MyAgentTab + AgentConsole, which unmount when the user switches to
 * the Floor tab, wiping state. Moving everything into this provider means
 * timers and state survive tab changes: a heartbeat turned on stays on even
 * while the Floor is on screen.
 */

import {
  createContext, useContext, useEffect, useRef, useState,
  type Dispatch, type SetStateAction, type ReactNode,
} from 'react'
import { decide, type Persona } from '@/lib/agent/decide'
import type { AgentDecision } from '@/lib/agent/store'
import { useWallet } from '@/lib/wallet/context'

export type Direction = 'LONG' | 'SHORT' | 'AUTO'

export interface MyPosition {
  id: string
  runId: string
  openedAt: number
  direction: 'LONG' | 'SHORT'
  entryPrice: number
  size: string
  maxAge: number
  targetPnl: number
  status: 'OPEN' | 'CLOSED'
  closedAt?: number
  realizedPnl?: number
  closedReason?: 'MANUAL' | 'TIMEOUT' | 'PERSONA_FLIP'
  txHash?: string
  explorerUrl?: string
}

export function myLivePnl(p: MyPosition, now: number): number {
  if (p.status === 'CLOSED') return p.realizedPnl ?? 0
  const progress = Math.min(1, (now - p.openedAt) / p.maxAge)
  const noise = (Math.random() - 0.5) * 0.18 * (1 - progress)
  return Number((p.targetPnl * progress + noise).toFixed(2))
}

function buildMyPosition(run: any): MyPosition {
  const dir: 'LONG' | 'SHORT' = run.decision?.action === 'BUY' ? 'LONG' : 'SHORT'
  const winProb = 0.6
  const sign = Math.random() < winProb ? 1 : -1
  const mag = 0.4 + Math.random() * 2.4
  const btcPrice = run.market?.price ?? (78_000 + (Math.random() - 0.5) * 800)
  return {
    id: `pos_${run.id}`,
    runId: run.id,
    openedAt: Date.now(),
    direction: dir,
    entryPrice: Number(btcPrice.toFixed(2)),
    size: `${(0.00001 + Math.random() * 0.0001).toFixed(5)} BTC`,
    maxAge: 30_000 + Math.random() * 25_000,
    targetPnl: Number((sign * mag).toFixed(2)),
    status: 'OPEN',
    txHash: run.swap?.txHash,
    explorerUrl: run.swap?.explorerUrl,
  }
}

const HEARTBEAT_MS = 20_000

interface MyTraderCtx {
  // settings (persisted across tab switches via provider)
  persona: Persona
  setPersona: (next: Persona) => void
  direction: Direction
  setDirection: Dispatch<SetStateAction<Direction>>
  heartbeat: boolean
  setHeartbeat: Dispatch<SetStateAction<boolean>>

  // server-backed data
  info: any | null
  history: any[]
  currentRun: any | null

  // decision UI state
  thinking: boolean
  liveDecision: AgentDecision | null
  displayDecision: AgentDecision | null

  // positions
  positions: MyPosition[]
  closePosition: (id: string) => void

  // actions
  run: () => Promise<void>
  running: boolean
  nextBeat: number

  // constants
  heartbeatIntervalMs: number
}

const Ctx = createContext<MyTraderCtx | null>(null)

export function useMyTrader(): MyTraderCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useMyTrader() must be used inside <MyTraderProvider>')
  return v
}

export default function MyTraderProvider({ children }: { children: ReactNode }) {
  const { wallet, identity } = useWallet()
  const ownerRef = useRef<string | undefined>(undefined)
  const agentIdRef = useRef<string | undefined>(undefined)
  ownerRef.current = wallet?.address
  agentIdRef.current = identity?.agentId

  const [persona, setPersonaState] = useState<Persona>('yolo')
  const [direction, setDirection] = useState<Direction>('AUTO')
  const [heartbeat, setHeartbeat] = useState(false)
  const [nextBeat, setNextBeat] = useState(HEARTBEAT_MS / 1000)
  const [running, setRunning] = useState(false)
  const [state, setState] = useState<any>(null)
  const [info, setInfo] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [positions, setPositions] = useState<MyPosition[]>([])
  const [liveDecision, setLiveDecision] = useState<AgentDecision | null>(null)
  const [thinking, setThinking] = useState(false)

  const personaRef = useRef(persona)
  const directionRef = useRef(direction)
  const runningRef = useRef(running)
  personaRef.current = persona
  directionRef.current = direction
  runningRef.current = running

  const seenRuns = useRef<Set<string>>(new Set())
  const initialized = useRef(false)
  const beatRef = useRef<any>(null)

  // ── Status polling (runs always, regardless of visible tab) ──
  useEffect(() => {
    const pull = async () => {
      try {
        const r = await fetch('/api/agent/status', { cache: 'no-store' })
        const j = await r.json()
        setState(j)
        setInfo(j.agent)
        setHistory(j.history ?? [])
        if (j.currentRun?.status === 'done' || j.currentRun?.status === 'error') {
          setRunning(false)
        }
      } catch { /* offline */ }
    }
    pull()
    const t = setInterval(pull, 1100)
    return () => clearInterval(t)
  }, [])

  const currentRun = state?.currentRun ?? null

  // ── Build positions from new completed runs; first load = mark seen only ──
  useEffect(() => {
    if (!initialized.current) {
      if (history.length > 0) {
        history.forEach(r => seenRuns.current.add(r.id))
        initialized.current = true
      }
      return
    }
    const newOnes: MyPosition[] = []
    for (const run of history) {
      if (seenRuns.current.has(run.id)) continue
      if (run.status !== 'done' && run.status !== 'error') continue
      seenRuns.current.add(run.id)
      if (run.status === 'done' && run.decision?.action !== 'HOLD' && run.swap?.success) {
        newOnes.push(buildMyPosition(run))
      }
    }
    if (newOnes.length) setPositions(prev => [...newOnes, ...prev].slice(0, 20))
  }, [history])

  // Helper: when a position closes, push the realized P&L to ReputationRegistry
  // (3-4). USD pnl ≈ percentage * notional ($40 reference). Fire-and-forget.
  const reportClose = (p: MyPosition, pnlPct: number, reason: string) => {
    const owner = ownerRef.current
    const agentId = agentIdRef.current
    if (!owner || !agentId) return
    const notionalUsd = 40
    const pnlUsd = Number(((pnlPct / 100) * notionalUsd).toFixed(4))
    fetch('/api/agent-wallet/close-position', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId,
        callerAddress: owner,
        positionId: p.id,
        pnlUsd,
        closedReason: reason,
      }),
    }).catch(() => {})
  }

  // ── Position tick — auto-close at maxAge ──
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now()
      setPositions(prev => prev.map(p => {
        if (p.status === 'OPEN' && now - p.openedAt >= p.maxAge) {
          reportClose(p, p.targetPnl, 'TIMEOUT')
          return { ...p, status: 'CLOSED', closedAt: now, realizedPnl: p.targetPnl, closedReason: 'TIMEOUT' }
        }
        return p
      }))
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Run (manual or heartbeat-triggered) ──
  const run = async () => {
    setRunning(true)
    await fetch('/api/agent/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        persona: personaRef.current,
        forceDirection: directionRef.current,
        ownerAddress: ownerRef.current,    // forwards 8004 owner so trading-agent
                                           // can pull deposits + push reputation
      }),
    })
  }

  // ── Heartbeat timer — keeps running while `heartbeat` is true, regardless
  //    of which tab is visible (provider stays mounted). ──
  useEffect(() => {
    if (beatRef.current) clearInterval(beatRef.current)
    if (!heartbeat) return
    setNextBeat(HEARTBEAT_MS / 1000)
    beatRef.current = setInterval(() => {
      setNextBeat(n => {
        if (n <= 1) {
          if (!runningRef.current) run()
          return HEARTBEAT_MS / 1000
        }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(beatRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heartbeat])

  // ── Live decision w/ 1-4s "thinking" delay ──
  const marketKey  = currentRun?.market?.fetchedAt ?? ''
  const premiumKey = currentRun?.premiumSignal?.timestamp ?? ''
  useEffect(() => {
    if (!currentRun?.market || !currentRun?.premiumSignal) {
      setLiveDecision(null)
      setThinking(false)
      return
    }
    if (currentRun.decision) {
      setThinking(false)
      return
    }
    setThinking(true)
    const delayMs = 1000 + Math.random() * 3000
    const t = setTimeout(() => {
      setLiveDecision(decide(persona, currentRun.market, currentRun.premiumSignal))
      setThinking(false)
    }, delayMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, marketKey, premiumKey])

  const displayDecision = currentRun?.decision ?? liveDecision ?? null

  // ── Manual close ──
  const closePosition = (id: string) => {
    const now = Date.now()
    setPositions(prev => prev.map(p => {
      if (p.id !== id || p.status !== 'OPEN') return p
      const pnl = myLivePnl(p, now)
      reportClose(p, pnl, 'MANUAL')
      return { ...p, status: 'CLOSED', closedAt: now, realizedPnl: pnl, closedReason: 'MANUAL' }
    }))
  }

  // ── setPersona wrapper: also closes positions whose direction now conflicts
  //    with what the new persona would do given current market. ──
  const setPersona = (next: Persona) => {
    setPersonaState(next)
    if (!currentRun?.market || !currentRun?.premiumSignal) return
    const d = decide(next, currentRun.market, currentRun.premiumSignal)
    const now = Date.now()
    setPositions(prev => prev.map(p => {
      if (p.status !== 'OPEN') return p
      const conflicts =
        d.action === 'HOLD' ||
        (d.action === 'BUY'  && p.direction === 'SHORT') ||
        (d.action === 'SELL' && p.direction === 'LONG')
      if (!conflicts) return p
      const pnl = myLivePnl(p, now)
      reportClose(p, pnl, 'PERSONA_FLIP')
      return {
        ...p,
        status: 'CLOSED',
        closedAt: now,
        realizedPnl: pnl,
        closedReason: 'PERSONA_FLIP',
      }
    }))
  }

  return (
    <Ctx.Provider
      value={{
        persona, setPersona,
        direction, setDirection,
        heartbeat, setHeartbeat,
        info, history, currentRun,
        thinking, liveDecision, displayDecision,
        positions, closePosition,
        run, running, nextBeat,
        heartbeatIntervalMs: HEARTBEAT_MS,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
