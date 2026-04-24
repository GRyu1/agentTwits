'use client'

import PepeAvatar, { type AgentType } from './PepeAvatar'
import { useMyTrader } from './MyTraderProvider'
import type { Persona } from '@/lib/agent/decide'

const PERSONA_TO_TYPE: Record<Persona, AgentType> = {
  yolo: 'yolo', quant: 'quant', scared: 'kim',
}

const PERSONAS: Record<Persona, { name: string; tone: 'fear'|'greed'|'neutral'; desc: string }> = {
  yolo:   { name: 'MANIC YOLO',  tone: 'greed',   desc: 'aggressive · enters on weak signals' },
  quant:  { name: 'CALM QUANT',  tone: 'neutral', desc: 'moves only when edge is clear' },
  scared: { name: 'PANIC KIM',   tone: 'fear',    desc: 'risk-first · cuts losses early' },
}

const STEP_LABEL: Record<string, string> = {
  fetching_market: 'Fetch market',
  paying_x402:     'Pay x402 · premium signal',
  deciding:        'Decide + emote',
  swapping:        'Uniswap V3 swap',
}
const STEP_WHY: Record<string, string> = {
  fetching_market: 'Public price from CoinGecko first',
  paying_x402:     'Premium data (whale flow, funding) paid in USDC',
  deciding:        'Combine price + signal + persona → BUY/SELL/HOLD',
  swapping:        'If action needed, swap on Base Sepolia Uniswap',
}
const STEPS = ['fetching_market', 'paying_x402', 'deciding', 'swapping'] as const

const HEARTBEAT_MS = 20_000

function shortHash(h?: string) {
  if (!h || h === '0x0' || h === '0x') return '—'
  return `${h.slice(0, 8)}…${h.slice(-6)}`
}
function fmt(n: any, dp = 2) {
  if (n === null || n === undefined) return '—'
  if (typeof n === 'number') return n.toLocaleString(undefined, { maximumFractionDigits: dp })
  return String(n)
}

type Direction = 'LONG' | 'SHORT' | 'AUTO'

export default function AgentConsole() {
  const {
    persona, setPersona,
    direction, setDirection,
    heartbeat, setHeartbeat,
    info: agent, currentRun,
    thinking, liveDecision, displayDecision,
    run, running, nextBeat,
    heartbeatIntervalMs,
  } = useMyTrader()

  const current = currentRun
  const p = PERSONAS[persona]
  const stepIdx = current ? STEPS.indexOf(current.status as any) : -1
  const HB_S = heartbeatIntervalMs / 1000

  return (
    <div className="panel">
      {/* Head */}
      <div className="panel-head" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
        <div className="flex items-center w-full gap-2">
          <span className="font-display text-base">My Trader</span>
          <span className="text-ink-3 font-mono text-xs ml-2">
            {agent ? `${agent.network} · ${agent.mode}` : '—'}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setHeartbeat(v => !v)}
              className={`btn ${heartbeat ? 'btn-money' : ''}`}
              style={{ padding: '6px 10px', fontSize: 12 }}
              title={heartbeat ? `auto-run every ${HB_S}s · persists across tabs` : 'enable auto-run'}
            >
              <span className={heartbeat ? 'animate-beat inline-block mr-1' : 'mr-1'}>♥</span>
              {heartbeat ? `AUTO · ${nextBeat}s` : 'AUTO OFF'}
            </button>
            <button onClick={run} disabled={running} className="btn" style={{ padding: '6px 12px', fontSize: 12 }}>
              {running ? 'RUNNING…' : 'RUN ONCE'}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between w-full gap-4">
          <span className="text-xs text-ink-3 font-mono truncate">
            {agent?.address ? `${agent.address.slice(0, 14)}…${agent.address.slice(-8)}` : '—'}
          </span>

          {/* Direction lock — LONG / SHORT / AUTO */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-ink-3">bias</span>
            {(['LONG', 'SHORT', 'AUTO'] as Direction[]).map(d => {
              const active = direction === d
              const c = d === 'LONG' ? 'var(--buy)' : d === 'SHORT' ? 'var(--sell)' : 'var(--money)'
              return (
                <button
                  key={d}
                  disabled={running}
                  onClick={() => setDirection(d)}
                  className="font-bold"
                  style={{
                    padding: '3px 8px',
                    fontSize: 11,
                    border: `1.5px solid ${active ? c : 'var(--line-2)'}`,
                    color: active ? c : 'var(--ink-3)',
                    background: active ? 'color-mix(in srgb, ' + c + ' 14%, transparent)' : 'transparent',
                    cursor: running ? 'not-allowed' : 'pointer',
                    letterSpacing: '0.02em',
                  }}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Persona picker */}
      <div className="grid grid-cols-3 border-b-2 border-line">
        {(Object.keys(PERSONAS) as Persona[]).map((k, i) => {
          const pp = PERSONAS[k]
          const active = persona === k
          const toneColor = pp.tone === 'fear' ? 'var(--fear)' : pp.tone === 'greed' ? 'var(--greed)' : 'var(--ink-2)'
          return (
            <button
              key={k}
              disabled={running}
              onClick={() => setPersona(k)}
              className="flex items-center gap-3 px-3 py-3 text-left border-line"
              style={{
                background: active ? '#000' : 'transparent',
                borderLeft: i > 0 ? '2px solid var(--line-2)' : 'none',
                cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              <PepeAvatar type={PERSONA_TO_TYPE[k]} size={40} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm" style={{ color: active ? toneColor : 'var(--ink-2)' }}>
                  {pp.name}
                </div>
                <div className="text-xs text-ink-3 leading-tight truncate">{pp.desc}</div>
              </div>
              {active && <span className="text-ink font-bold">▸</span>}
            </button>
          )
        })}
      </div>

      {/* Pipeline strip */}
      <div className="grid grid-cols-4">
        {STEPS.map((s, i) => {
          const done = stepIdx > i || current?.status === 'done'
          const active = current?.status === s
          return (
            <div
              key={s}
              className="px-3 py-3"
              style={{
                borderRight: i < STEPS.length - 1 ? '2px solid var(--line-2)' : 'none',
                borderBottom: '2px solid var(--line-2)',
                background: active ? '#000' : 'transparent',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-ink-3">0{i + 1}</span>
                <span
                  className={`w-2 h-2 ${active ? 'animate-pulse-dot' : ''}`}
                  style={{
                    background: done ? 'var(--buy)' : active ? 'var(--money)' : 'var(--line-2)',
                  }}
                />
              </div>
              <div className="mt-1.5 text-xs font-bold" style={{ color: active ? 'var(--ink)' : done ? 'var(--ink-2)' : 'var(--ink-3)' }}>
                {STEP_LABEL[s]}
              </div>
            </div>
          )
        })}
      </div>

      {/* Result grid */}
      {current && (
        <div className="grid grid-cols-2">
          <KV title="Market">
            {current.market ? (
              <>
                <Row k="Symbol" v={current.market.symbol} />
                <Row k="Price" v={`$${fmt(current.market.price)}`} />
                <Row k="24h" v={
                  <span style={{ color: current.market.change24h >= 0 ? 'var(--buy)' : 'var(--sell)' }}>
                    {current.market.change24h >= 0 ? '+' : ''}{current.market.change24h}%
                  </span>
                }/>
                <Row k="RSI" v={fmt(current.market.rsi, 0)} />
                <Row k="Trend" v={current.market.trend} />
                <Row k="Source" v={<span className="text-money font-bold">{current.market.source}</span>} />
              </>
            ) : <Empty />}
          </KV>

          <KV title="x402 Payment" accent="money" right>
            {current.x402Payments?.[0] ? (
              <>
                <Row k="Endpoint" v={<span className="font-mono text-sm">{current.x402Payments[0].endpoint}</span>} />
                <Row k="Amount" v={<span className="text-money font-bold">{current.x402Payments[0].amount}</span>} />
                <Row k="Status" v={<span className="text-buy font-bold">{current.x402Payments[0].status}</span>} />
                <Row k="TxHash" v={<span className="font-mono text-sm text-ink-2">{shortHash(current.x402Payments[0].txHash)}</span>} />
              </>
            ) : <Empty />}
          </KV>

          <KV title="Premium Signal (paid)">
            {current.premiumSignal ? (
              <>
                <Row k="Whale" v={
                  <span style={{
                    color: current.premiumSignal.whaleActivity === 'accumulation' ? 'var(--buy)' :
                           current.premiumSignal.whaleActivity === 'distribution' ? 'var(--sell)' : 'var(--ink-2)'
                  }}>{current.premiumSignal.whaleActivity}</span>
                } />
                <Row k="Funding" v={fmt(current.premiumSignal.fundingRate, 4)} />
                <Row k="Bias" v={
                  <span style={{
                    color: current.premiumSignal.recommendation === 'LONG_BIAS' ? 'var(--buy)' :
                           current.premiumSignal.recommendation === 'SHORT_BIAS' ? 'var(--sell)' : 'var(--ink-2)'
                  }} className="font-bold">{current.premiumSignal.recommendation}</span>
                } />
                <Row k="Confidence" v={`${current.premiumSignal.confidence}%`} />
              </>
            ) : <Empty />}
          </KV>

          <KV title="Agent Decision" right>
            {thinking ? (
              <DecisionThinking persona={persona} />
            ) : displayDecision ? (
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`chip ${
                    displayDecision.action === 'BUY'  ? 'chip-buy' :
                    displayDecision.action === 'SELL' ? 'chip-sell' : 'chip-ghost'
                  }`}>{displayDecision.action}</span>
                  {displayDecision.trend && (
                    <span className={`chip ${
                      displayDecision.trend === 'bullish' ? 'chip-buy' :
                      displayDecision.trend === 'bearish' ? 'chip-sell' : 'chip-ghost'
                    }`}>
                      {displayDecision.trend === 'bullish' ? '▲ BULL' :
                       displayDecision.trend === 'bearish' ? '▼ BEAR' : '◆ SIDE'}
                      {typeof displayDecision.trendScore === 'number' && (
                        <span className="ml-1 font-mono">
                          {displayDecision.trendScore >= 0 ? '+' : ''}{displayDecision.trendScore}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="text-sm font-bold" style={{ color: p.tone === 'fear' ? 'var(--fear)' : p.tone === 'greed' ? 'var(--greed)' : 'var(--ink)' }}>
                    {displayDecision.emotion}
                  </span>
                  {liveDecision && (
                    <span className="text-xs text-money font-mono" title="re-evaluated against current persona + market">LIVE</span>
                  )}
                  <span className="ml-auto text-ink-3 font-mono text-xs">{displayDecision.confidence}%</span>
                </div>
                <div className="text-sm leading-snug text-ink flex items-start gap-2">
                  <PepeAvatar type={PERSONA_TO_TYPE[persona]} size={20} />
                  <span>"{displayDecision.message}"</span>
                </div>
                <div className="text-xs text-ink-3 leading-snug">
                  {displayDecision.reasoning}
                </div>
              </div>
            ) : <Empty />}
          </KV>

          {/* Swap — full width */}
          <div className="col-span-2" style={{ borderTop: '2px solid var(--line-2)' }}>
            <div className="panel-head" style={{ borderBottom: '2px solid var(--line-2)', color: 'var(--greed)' }}>
              Uniswap V3 Execution
              {current.swap?.mode && (
                <span className={`chip ${current.swap.mode === 'LIVE' ? 'chip-buy' : 'chip-money'} ml-auto`}>
                  {current.swap.mode}
                </span>
              )}
            </div>
            {current.swap ? (
              <div className="grid grid-cols-3 px-4 py-3 text-sm">
                <Row k="Direction" v={
                  <span className="font-bold font-display text-lg">
                    {current.swap.tokenIn} → {current.swap.tokenOut}
                  </span>
                } />
                <Row k="In" v={`${current.swap.amountIn} ${current.swap.tokenIn}`} />
                <Row k="Out (est)" v={`${current.swap.estimatedAmountOut} ${current.swap.tokenOut}`} />
                <Row k="Gas" v={fmt(Number(current.swap.gasUsed), 0)} />
                <Row k="TX" v={
                  current.swap.explorerUrl
                    ? <a href={current.swap.explorerUrl} target="_blank" rel="noreferrer"
                         className="font-mono text-sm underline" style={{ color: 'var(--fear)' }}>
                        {shortHash(current.swap.txHash)}
                      </a>
                    : <span className="font-mono">{shortHash(current.swap.txHash)}</span>
                } />
                <Row k="Result" v={
                  <span className="font-bold" style={{ color: current.swap.success ? 'var(--buy)' : 'var(--sell)' }}>
                    {current.swap.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                } />
                {current.swap.calldata && current.swap.calldata.length > 10 && (
                  <div className="col-span-3 mt-2 pt-2 hairline">
                    <div className="text-xs text-ink-3 mb-1">multicall(wrapETH, exactInputSingle) calldata</div>
                    <div className="font-mono text-xs text-ink-2 break-all line-clamp-2">
                      {current.swap.calldata.slice(0, 220)}…
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm text-ink-3">
                {current.decision?.action === 'HOLD'
                  ? 'HOLD decision — no onchain action'
                  : 'waiting…'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function KV({ title, children, accent, right }: { title: string; children: any; accent?: 'money'; right?: boolean }) {
  return (
    <div style={{
      borderRight: right ? 'none' : '2px solid var(--line-2)',
      borderBottom: '2px solid var(--line-2)',
    }}>
      <div className="panel-head" style={{
        borderBottom: '2px solid var(--line-2)',
        color: accent === 'money' ? 'var(--money)' : 'var(--ink)',
      }}>
        {title}
      </div>
      <div className="px-4 py-3 space-y-1.5 text-sm">{children}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-3">{k}</span>
      <span className="text-ink text-right">{v}</span>
    </div>
  )
}

function Empty() {
  return <div className="text-ink-3 text-sm">—</div>
}

function DecisionThinking({ persona }: { persona: Persona }) {
  const pp = PERSONAS[persona]
  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center gap-2 text-xs text-money font-bold tracking-wider">
        <span>THINKING</span>
        <span className="inline-flex gap-1">
          <span className="w-1 h-1 animate-pulse-dot" style={{ background: 'var(--money)' }} />
          <span className="w-1 h-1 animate-pulse-dot" style={{ background: 'var(--money)', animationDelay: '0.2s' }} />
          <span className="w-1 h-1 animate-pulse-dot" style={{ background: 'var(--money)', animationDelay: '0.4s' }} />
        </span>
        <span className="text-ink-3 font-normal font-mono normal-case" style={{ letterSpacing: 0 }}>
          · re-evaluating for {pp.name}
        </span>
      </div>
      <div className="flex items-start gap-2">
        <PepeAvatar type={PERSONA_TO_TYPE[persona]} size={20} className="animate-beat" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 skeleton w-4/5" />
          <div className="h-3 skeleton w-3/5" />
        </div>
      </div>
      <div className="h-2 skeleton w-2/5 mt-1" />
    </div>
  )
}
