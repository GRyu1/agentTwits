import { NextRequest, NextResponse } from 'next/server'
import type { Address } from 'viem'
import { registerAgent } from '@/lib/erc8004/registry'
import { recordRegister } from '@/lib/erc8004/store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    owner?: string
    agentDomain?: string
    agentAddress?: string
  }
  if (!body.owner || !body.owner.startsWith('0x')) {
    return NextResponse.json({ success: false, error: 'owner required' }, { status: 400 })
  }
  const owner = body.owner as Address
  const agentDomain = body.agentDomain || `fearnet-${owner.slice(2, 8)}.local`
  // For the demo, agentAddress (server-side identity) defaults to the user's wallet.
  const agentAddress = (body.agentAddress as Address) || owner

  const r = await registerAgent({ owner, agentDomain, agentAddress })

  recordRegister({
    agentId: r.agentId,
    agentDomain,
    ownerAddress: owner,
    registerTxHash: r.txHash,
    registerExplorerUrl: r.explorerUrl,
    registerMode: r.mode,
    registeredAt: new Date().toISOString(),
  })

  return NextResponse.json(r)
}
