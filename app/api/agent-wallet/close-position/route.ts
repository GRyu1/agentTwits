// 3-4: when the user's agent closes a position (timeout, manual, or persona flip),
// the realized PnL (USD) is sent to ReputationRegistry.acceptFeedback for the
// agentId. Auth: only the 8004 token holder (= ownerAddress) can submit.

import { NextRequest, NextResponse } from 'next/server'
import type { Address } from 'viem'
import { pushReputation } from '@/lib/erc8004/registry'
import { assertAgentTokenAuth } from '@/lib/erc8004/agent-wallet'
import { getAgent, recordReputation } from '@/lib/erc8004/store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string
    callerAddress?: string
    positionId?: string
    pnlUsd?: number
    closedReason?: string
  }
  if (!body.agentId || !body.callerAddress?.startsWith('0x') || typeof body.pnlUsd !== 'number') {
    return NextResponse.json({ error: 'agentId + callerAddress + pnlUsd required' }, { status: 400 })
  }
  const agent = getAgent(body.agentId)
  if (!agent) return NextResponse.json({ error: 'agent not registered' }, { status: 404 })

  try {
    assertAgentTokenAuth({
      agentId: body.agentId,
      expectedOwner: agent.ownerAddress,
      caller: body.callerAddress as Address,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unauthorized' }, { status: 403 })
  }

  const r = await pushReputation({
    agentId: body.agentId,
    pnlUsd: body.pnlUsd,
    evidenceUri: `fearnet://position/${body.positionId ?? 'manual'}/${Date.now()}`,
    prevScore: agent.repScore,
  })

  recordReputation(body.agentId, body.pnlUsd, r.newScore, r.txHash)

  return NextResponse.json({
    ...r,
    positionId: body.positionId,
    closedReason: body.closedReason ?? 'TIMEOUT',
  })
}
