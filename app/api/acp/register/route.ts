import { NextRequest, NextResponse } from 'next/server'
import type { Address } from 'viem'
import { registerAgentOnAcp } from '@/lib/acp/register'
import { getAgent, recordAcpRegistration } from '@/lib/erc8004/store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string
    ownerAddress?: string
    agentWalletAddress?: string
    cdpWalletAddress?: string
  }
  if (!body.agentId || !body.ownerAddress?.startsWith('0x')) {
    return NextResponse.json({ error: 'agentId + ownerAddress required' }, { status: 400 })
  }

  const agent = getAgent(body.agentId)
  const acp = await registerAgentOnAcp({
    agentId: body.agentId,
    ownerAddress: body.ownerAddress as Address,
    agentWalletAddress: (body.agentWalletAddress || agent?.agentWalletAddress) as Address | undefined,
    cdpWalletAddress: (body.cdpWalletAddress || agent?.cdpWalletAddress) as Address | undefined,
    agentDomain: agent?.agentDomain,
  })

  if (agent) {
    recordAcpRegistration(body.agentId, {
      acpAgentName: acp.agentName,
      acpWalletAddress: acp.walletAddress,
      acpStatus: acp.status,
      acpError: acp.error,
      acpRegisteredAt: acp.status === 'REGISTERED' ? new Date().toISOString() : undefined,
    })
  }

  return NextResponse.json(acp)
}
