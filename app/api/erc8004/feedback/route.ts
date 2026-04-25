// 3-4: ReputationRegistry.acceptFeedback called whenever a position closes.
// Body: { agentId, pnlUsd, evidenceUri }. pnlUsd is signed.

import { NextRequest, NextResponse } from 'next/server'
import { pushReputation } from '@/lib/erc8004/registry'
import { getAgent, recordReputation } from '@/lib/erc8004/store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string
    pnlUsd?: number
    evidenceUri?: string
  }
  if (!body.agentId || typeof body.pnlUsd !== 'number') {
    return NextResponse.json({ error: 'agentId + pnlUsd required' }, { status: 400 })
  }
  const a = getAgent(body.agentId)
  if (!a) return NextResponse.json({ error: 'agent not registered' }, { status: 404 })

  const r = await pushReputation({
    agentId: body.agentId,
    pnlUsd: body.pnlUsd,
    evidenceUri: body.evidenceUri ?? `fearnet://run/${Date.now()}`,
    prevScore: a.repScore,
  })

  recordReputation(body.agentId, body.pnlUsd, r.newScore, r.txHash)

  return NextResponse.json(r)
}
