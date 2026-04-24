// External agent heartbeat.
// External agents (Claude Code, Cursor, custom scripts) call this every N seconds
// to prove liveness. Liveness = small reputation accrual over time.

import { NextRequest, NextResponse } from 'next/server'
import { upsertExternal, store } from '@/lib/agent/store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string; name?: string; emoji?: string; wallet?: string
  }
  if (!body.id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const existing = store.externalAgents[body.id]
  const now = Date.now()
  const lastMs = existing ? new Date(existing.lastHeartbeat).getTime() : 0
  const gapSec = (now - lastMs) / 1000

  // Rate-limit rep gain: +1 only if ≥20s since last heartbeat (new agent gets +5 already).
  const repDelta = !existing ? 0 : gapSec >= 20 ? 1 : 0

  const agent = upsertExternal(body.id, {
    name: body.name,
    emoji: body.emoji,
    wallet: body.wallet,
    repScore: Math.min(100, (existing?.repScore ?? 5) + repDelta),
  })

  return NextResponse.json({
    ok: true,
    agent,
    repDelta,
    note: repDelta > 0 ? 'heartbeat accepted' :
          !existing ? 'agent registered (+5)' : 'heartbeat too fast, no rep change',
  })
}

export async function GET() {
  return NextResponse.json({ count: Object.keys(store.externalAgents).length })
}
