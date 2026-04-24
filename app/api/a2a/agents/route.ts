import { NextResponse } from 'next/server'
import { listExternals } from '@/lib/agent/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const agents = listExternals().map(a => ({
    ...a,
    // Mark stale if no heartbeat in last 45s.
    alive: Date.now() - new Date(a.lastHeartbeat).getTime() < 45_000,
  }))
  return NextResponse.json({ agents })
}
