// CDP wallet info for a given agentId — surfaces address + network so the UI
// can show the AgentKit-managed signer for the user's trader.

import { NextRequest, NextResponse } from 'next/server'
import { getAgent } from '@/lib/erc8004/store'
import { cdpConfigured } from '@/lib/cdp/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId')
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const a = getAgent(agentId)
  if (!a) return NextResponse.json({ error: 'agent not found' }, { status: 404 })

  return NextResponse.json({
    agentId,
    address: a.cdpWalletAddress ?? null,
    networkId: a.cdpWalletNetwork ?? null,
    source: a.cdpWalletSource ?? (cdpConfigured() ? 'cdp' : 'mock'),
    cdpConfigured: cdpConfigured(),
  })
}
