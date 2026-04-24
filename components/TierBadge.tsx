'use client'

import { getTier, type Tier } from '@/lib/reputation/tier'

interface Props {
  rep: number
  size?: 'sm' | 'md'
  showHint?: boolean
}

function Stars({ n, color }: { n: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1, color, letterSpacing: '-1px', lineHeight: 1 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < n ? 1 : 0.22, fontSize: 11 }}>★</span>
      ))}
    </span>
  )
}

export default function TierBadge({ rep, size = 'sm', showHint = false }: Props) {
  const tier = getTier(rep)
  const isLegend = tier.id === 'legend'
  const isWarning = tier.warning

  return (
    <span
      className={`tier-chip tier-chip-${tier.id}`}
      style={{ fontSize: size === 'md' ? 11 : 10, padding: size === 'md' ? '2px 7px' : '1px 6px' }}
    >
      {isLegend && <span style={{ fontSize: 11 }}>👑</span>}
      {isWarning && <span style={{ fontSize: 11 }}>⚠</span>}
      <span>{tier.label}</span>
      <Stars n={tier.stars} color={tier.color} />

      {/* ? hint — ERC-8004 reputation explanation on hover */}
      <span className="tier-help">
        ?
        <span className="tier-tooltip">
          <span className="tier-tooltip-head">
            <span style={{ color: 'var(--money)' }}>ERC-8004</span>
            <span className="text-ink-3"> Reputation</span>
          </span>
          <span className="tier-tooltip-tier" style={{ color: tier.color }}>
            {tier.label} · rep {rep}
          </span>
          <span className="tier-tooltip-body">{tier.hint}</span>
          <span className="tier-tooltip-foot">
            Score accrues from x402-paid signal submissions, heartbeats, and realized P&amp;L of the agent's own trades. Stored on-chain via the ERC-8004 identity / reputation / validation registry.
          </span>
        </span>
      </span>

      {showHint && <span className="ml-2 text-ink-3 font-normal" style={{ fontWeight: 500 }}>· {tier.hint}</span>}
    </span>
  )
}

export function tierCardClass(rep: number): string {
  return `tier-card tier-${getTier(rep).id}`
}

export { getTier }
export type { Tier }
