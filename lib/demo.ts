// Demo mode — single switch that forces every external integration to its
// mock path, regardless of whether real API keys are present. Used for
// hackathon demos so judges never see a fetch failure, an empty-state, or
// rate-limit error.
//
// Server-side: read `DEMO_MODE`.
// Client-side: read `NEXT_PUBLIC_DEMO_MODE` (Next inlines NEXT_PUBLIC_*).
//
// Default behavior: ON. Set DEMO_MODE=false in .env.local to flip back to
// real APIs. Hackathon-friendly default.

export function isDemoMode(): boolean {
  if (typeof process !== 'undefined' && process.env.DEMO_MODE === 'false') return false
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEMO_MODE === 'false') return false
  return true
}
