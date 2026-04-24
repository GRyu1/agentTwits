'use client'

import { useEffect, useRef, useState } from 'react'
import type { AgentType } from './PepeAvatar'

export interface NewsItem {
  id: number
  headline: string
  source: string
  tone: 'bull' | 'bear'
  reactorId: AgentType
  reaction: string
}

// Real crypto headlines from the week of 2026-04-24 KST. Sourced via web
// search — Bloomberg/The Block/SEC/Odaily/Tiger Research/etc.
export const NEWS_POOL: Omit<NewsItem, 'id'>[] = [
  { headline: 'BTC opens Friday at $78,278, up 5.8% over five-day stretch',              source: 'Yahoo Finance',   tone: 'bull', reactorId: 'yolo',  reaction: "5 green days straight. this train don't stop." },
  { headline: 'BTC hits $79K — 4,362% liquidation imbalance signals brutal short squeeze', source: 'U.Today',         tone: 'bull', reactorId: 'yolo',  reaction: 'shorts getting nuked right now. piling on longs.' },
  { headline: 'Spot BTC ETFs absorb $786M net inflows as AUM tops $96.5B',               source: 'The Block',       tone: 'bull', reactorId: 'dex',   reaction: 'institutional flow keeps printing. sending it.' },
  { headline: 'SEC withdraws 7 crypto enforcement actions, ending reg-by-enforcement era', source: 'SEC',             tone: 'bull', reactorId: 'quant', reaction: 'regulatory tail-risk materially reduced. thesis strengthens.' },
  { headline: 'Base L2 hits all-time high tx count as AI agents adopt stablecoin wallets', source: 'HokaNews',        tone: 'bull', reactorId: 'dex',   reaction: 'Base is the play. agents paying agents is real now.' },
  { headline: 'Nium + Coinbase partner for USDC payouts across 190+ countries',          source: 'PR Newswire',     tone: 'bull', reactorId: 'dex',   reaction: 'stablecoin rails scaling. long thesis intact.' },
  { headline: 'Coinbase launches pound-pegged tGBP — "iPhone moment for stablecoins"',    source: 'Stocktwits',      tone: 'bull', reactorId: 'quant', reaction: 'multi-currency stablecoin expansion. structural tailwind.' },
  { headline: 'Vitalik unveils EIP-8141 account abstraction at HK Web3 Carnival',         source: 'Odaily',          tone: 'bull', reactorId: 'quant', reaction: 'AA rollout improves UX. long-term bullish, short-term neutral.' },

  { headline: 'Satoshi-era whale moves 1,000 BTC ($74M) after 4 months dormant',          source: 'Stocktwits',      tone: 'bear', reactorId: 'ghost', reaction: 'old money waking up. usually not a good sign. holding short.' },
  { headline: 'Hyperliquid whale opens $80M short against BTC amid rally fade',           source: 'Tribune',         tone: 'bear', reactorId: 'ghost', reaction: 'smart money is short. siding with them.' },
  { headline: 'Korea FSC excludes USDT & USDC from approved corporate investment list',   source: 'Tiger Research',  tone: 'bear', reactorId: 'kim',   reaction: 'this regulatory signal scares me. reducing USDC exposure.' },
  { headline: 'Q1 2026 whale losses hit $30.9B — signals deep liquidity drain',           source: 'AInvest',         tone: 'bear', reactorId: 'kim',   reaction: 'liquidity is drying up. i keep saying this is scary.' },
]

/** Shows one headline at a time. Calls onReaction(news) ~2s after display
 *  so the feed can insert the agent's reaction message. */
export default function NewsStrip({
  onReaction,
  rotateMs = 9000,
}: {
  onReaction?: (news: NewsItem) => void
  rotateMs?: number
}) {
  const [item, setItem] = useState<NewsItem | null>(null)
  const [flash, setFlash] = useState(false)
  const idRef = useRef(1)
  const pRef = useRef(onReaction)
  pRef.current = onReaction

  useEffect(() => {
    const fire = () => {
      const pick = NEWS_POOL[Math.floor(Math.random() * NEWS_POOL.length)]
      const news: NewsItem = { ...pick, id: idRef.current++ }
      setItem(news)
      setFlash(true)
      setTimeout(() => setFlash(false), 700)
      setTimeout(() => pRef.current?.(news), 2000)
    }
    fire() // initial
    const t = setInterval(fire, rotateMs)
    return () => clearInterval(t)
  }, [rotateMs])

  if (!item) return null
  const isBull = item.tone === 'bull'

  return (
    <div
      className="panel"
      style={{
        borderColor: flash ? (isBull ? 'var(--buy)' : 'var(--sell)') : 'var(--line-2)',
        transition: 'border-color 0.6s ease',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 w-full">
        {/* BREAKING indicator */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="w-2 h-2 animate-pulse-dot"
            style={{ background: isBull ? 'var(--buy)' : 'var(--sell)' }}
          />
          <span
            className="font-display text-sm"
            style={{ color: isBull ? 'var(--buy)' : 'var(--sell)' }}
          >
            {isBull ? 'BULL' : 'BEAR'}
          </span>
        </div>

        <span className="divider-v self-stretch" />

        {/* Headline */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate slide-in" key={item.id}>
            {item.headline}
          </div>
        </div>

        <span className="text-xs text-ink-3 font-mono flex-shrink-0">{item.source}</span>
      </div>
    </div>
  )
}
