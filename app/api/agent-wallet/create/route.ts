import { NextRequest, NextResponse } from 'next/server'
import type { Address } from 'viem'
import {
  assertAgentTokenAuth,
  createAgentWallet,
} from '@/lib/erc8004/agent-wallet'
import { registerAgentOnAcp } from '@/lib/acp/register'
import { getAgent, recordAcpRegistration, recordAgentWallet } from '@/lib/erc8004/store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string
    ownerAddress?: string
  }
  if (!body.agentId || !body.ownerAddress?.startsWith('0x')) {
    return NextResponse.json({ error: 'agentId + ownerAddress required' }, { status: 400 })
  }

  const agent = getAgent(body.agentId)
  if (!agent) {
    return NextResponse.json({ error: 'agent not registered' }, { status: 404 })
  }

  // 8004-token gated: only the registered owner can deploy/own this agent's wallet.
  try {
    assertAgentTokenAuth({
      agentId: body.agentId,
      expectedOwner: agent.ownerAddress,
      caller: body.ownerAddress as Address,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unauthorized' }, { status: 403 })
  }

  const info = await createAgentWallet({
    agentId: body.agentId,
    ownerAddress: body.ownerAddress as Address,
  })

  recordAgentWallet(body.agentId, {
    agentWalletAddress: info.walletAddress,
    agentWalletTxHash: info.txHash,
    agentWalletExplorerUrl: info.explorerUrl,
    agentWalletMode: info.mode,
  })

  const acp = await registerAgentOnAcp({
    agentId: body.agentId,
    ownerAddress: body.ownerAddress as Address,
    agentWalletAddress: info.walletAddress,
    cdpWalletAddress: agent.cdpWalletAddress,
    agentDomain: agent.agentDomain,
  })
  recordAcpRegistration(body.agentId, {
    acpAgentName: acp.agentName,
    acpWalletAddress: acp.walletAddress,
    acpStatus: acp.status,
    acpError: acp.error,
    acpRegisteredAt: acp.status === 'REGISTERED' ? new Date().toISOString() : undefined,
  })

  return NextResponse.json({ ...info, acp })
}
