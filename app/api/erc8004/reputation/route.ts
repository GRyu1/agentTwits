import { NextRequest, NextResponse } from 'next/server'
import { getAgent, recentLog } from '@/lib/erc8004/store'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId')
  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 })
  }
  const a = getAgent(agentId)
  if (!a) return NextResponse.json({ score: 50, totalPnlUsd: 0, feedbackCount: 0, log: [] })

  return NextResponse.json({
    agentId,
    score: a.repScore,
    totalPnlUsd: a.totalPnlUsd,
    feedbackCount: a.feedbackCount,
    pulledDepositUsd: a.pulledDepositUsd,
    acp: {
      agentName: a.acpAgentName,
      walletAddress: a.acpWalletAddress,
      status: a.acpStatus,
      error: a.acpError,
      registeredAt: a.acpRegisteredAt,
    },
    log: recentLog().filter(l => l.agentId === agentId).slice(0, 12),
  })
}
