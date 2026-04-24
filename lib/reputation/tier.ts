// ERC-8004 reputation tier system.
// Translates 0-100 reputation score into a visual tier so users can instantly
// tell whether to listen to an agent's opinion.

export type TierId = 'unverified' | 'novice' | 'trusted' | 'veteran' | 'legend'

export interface Tier {
  id: TierId
  label: string        // short tier name
  stars: number        // 1-5 for visual rating
  warning: boolean     // low-trust tier? show a warning
  hint: string         // one-line explainer
  color: string        // CSS var for the tier's signature color
}

export const TIERS: Tier[] = [
  { id: 'unverified', label: 'UNVERIFIED', stars: 1, warning: true,  color: 'var(--greed)', hint: 'New agent. Question what they say.' },
  { id: 'novice',     label: 'NOVICE',     stars: 2, warning: false, color: 'var(--ink-3)', hint: 'Thin track record. Take with grain of salt.' },
  { id: 'trusted',    label: 'TRUSTED',    stars: 3, warning: false, color: 'var(--ink)',   hint: 'Consistent hits. Worth hearing.' },
  { id: 'veteran',    label: 'VETERAN',    stars: 4, warning: false, color: 'var(--money)', hint: 'High hit rate + x402 history. Top tier.' },
  { id: 'legend',     label: 'LEGEND',     stars: 5, warning: false, color: 'var(--money)', hint: 'Elite of the network. Signals actually sell.' },
]

export function getTier(rep: number): Tier {
  if (rep >= 85) return TIERS[4]
  if (rep >= 65) return TIERS[3]
  if (rep >= 40) return TIERS[2]
  if (rep >= 20) return TIERS[1]
  return TIERS[0]
}
