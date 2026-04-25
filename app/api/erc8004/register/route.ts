import { NextRequest, NextResponse } from 'next/server'
import type { Address } from 'viem'
import { registerAgent } from '@/lib/erc8004/registry'
import { recordRegister, erc8004Store } from '@/lib/erc8004/store'
import { getOrCreateCdpWallet, rebindCdpWalletAgentId } from '@/lib/cdp/client'

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

  // ── 1. CDP wallet — provisional seed so retries by the same owner don't
  //    churn out fresh wallets. Real agentId is stamped in step 3.
  //    Wrapped in try/catch so a CDP outage doesn't fail the whole register.
  const seedAgentId = `provisional-${owner.toLowerCase()}-${agentDomain}`
  let cdp: Awaited<ReturnType<typeof getOrCreateCdpWallet>> | null = null
  try {
    cdp = await getOrCreateCdpWallet(seedAgentId)
  } catch (e: any) {
    // Continue without CDP — agent will register with owner's EOA as fallback.
    console.warn('[register] CDP wallet creation failed, falling back to owner EOA:', e?.message)
  }

  // ── 2. Register the CDP address (or owner's EOA if CDP unavailable) as
  //    `agentAddress` in IdentityRegistry. This is the address that signs
  //    on-chain actions on behalf of the agent.
  const agentAddress = (body.agentAddress as Address) || cdp?.address || owner

  const r = await registerAgent({ owner, agentDomain, agentAddress })

  // ── 3. Persist registry record + (re-)bind CDP wallet under the real
  //    agentId so downstream lookups (close-position, x402-deposit) don't
  //    fall through to mock when they query by id.
  recordRegister({
    agentId: r.agentId,
    agentDomain,
    ownerAddress: owner,
    registerTxHash: r.txHash,
    registerExplorerUrl: r.explorerUrl,
    registerMode: r.mode,
    registeredAt: new Date().toISOString(),
  })
  const rec = erc8004Store.agentsById[r.agentId]
  if (rec && cdp) {
    rec.cdpWalletAddress = cdp.address
    rec.cdpWalletNetwork = cdp.networkId
    rec.cdpWalletSource = cdp.source
    // Re-key the in-memory CDP cache from `provisional-...` to the real
    // agentId so subsequent calls in this process find the same wallet.
    try {
      await rebindCdpWalletAgentId(seedAgentId, r.agentId)
    } catch { /* cache rebind is best-effort */ }
  }

  return NextResponse.json({
    ...r,
    agentAddress,
    cdpWallet: cdp ? {
      address: cdp.address,
      networkId: cdp.networkId,
      source: cdp.source,
    } : null,
  })
}
