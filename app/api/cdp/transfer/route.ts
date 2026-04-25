// AgentKit native_transfer pass-through. The CDP wallet bound to an agent
// signs an ETH transfer to a destination — gated by 8004 token auth so only
// the agent's owner can move funds.
//
// In the FearNet flow, this is the "agent funds the proxy" or "agent
// withdraws to owner" rail that AgentKit provides for free (no AGENT_PRIVATE_KEY
// needed in env).

import { NextRequest, NextResponse } from 'next/server'
import type { Address } from 'viem'
import { getAgent } from '@/lib/erc8004/store'
import { assertAgentTokenAuth } from '@/lib/erc8004/agent-wallet'
import { cdpNativeTransfer } from '@/lib/cdp/client'
import { BASE_SEPOLIA } from '@/lib/pancakeswap/addresses'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string
    callerAddress?: string
    to?: string
    ethValue?: string
  }
  if (!body.agentId || !body.callerAddress?.startsWith('0x') || !body.to?.startsWith('0x') || !body.ethValue) {
    return NextResponse.json({ error: 'agentId + callerAddress + to + ethValue required' }, { status: 400 })
  }
  const agent = getAgent(body.agentId)
  if (!agent || !agent.cdpWalletAddress) {
    return NextResponse.json({ error: 'agent or CDP wallet not found' }, { status: 404 })
  }

  try {
    assertAgentTokenAuth({
      agentId: body.agentId,
      expectedOwner: agent.ownerAddress,
      caller: body.callerAddress as Address,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unauthorized' }, { status: 403 })
  }

  try {
    const r = await cdpNativeTransfer({
      fromAddress: agent.cdpWalletAddress,
      to: body.to as Address,
      ethValue: body.ethValue,
    })
    return NextResponse.json({
      success: true,
      txHash: r.txHash,
      explorerUrl: `${BASE_SEPOLIA.explorer}/tx/${r.txHash}`,
      from: agent.cdpWalletAddress,
      to: body.to,
      ethValue: body.ethValue,
      mode: r.mode,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? 'transfer failed' }, { status: 500 })
  }
}
