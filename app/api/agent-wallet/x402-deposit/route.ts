// x402-gated deposit pull endpoint (3-3).
//
// Behaviour:
//   - First call (no X-PAYMENT) → 402 + paymentRequirements (USDC amount, payTo = 8004 owner)
//   - Second call (with X-PAYMENT) → executes AgentWallet.pullDeposit, transferring
//     amountUsd from the agent wallet to the 8004 token owner, and returns the receipt.
//
// This is the "deposits to the agent wallet are routed to the 8004 token owner"
// behaviour from the spec, gated through x402 so any caller (including the agent
// itself or an external operator) must produce a payment proof.

import { NextRequest, NextResponse } from 'next/server'
import type { Address } from 'viem'
import { BASE_SEPOLIA } from '@/lib/uniswap/addresses'
import {
  assertAgentTokenAuth,
  pullDepositToOwner,
} from '@/lib/erc8004/agent-wallet'
import { getAgent, recordDepositPull } from '@/lib/erc8004/store'

export const dynamic = 'force-dynamic'

function paymentRequirements(pathname: string, agentId: string, amountUsd: number, payTo: Address) {
  const atomic = Math.round(amountUsd * 1_000_000).toString()
  return {
    x402Version: 1,
    error: 'Payment required',
    accepts: [
      {
        scheme: 'exact',
        network: 'base-sepolia',
        maxAmountRequired: atomic,
        resource: `${pathname}?agentId=${agentId}`,
        description: `AgentWallet deposit pull → 8004 owner (agentId=${agentId})`,
        mimeType: 'application/json',
        payTo,
        maxTimeoutSeconds: 60,
        asset: BASE_SEPOLIA.usdc,
        extra: { name: 'USD Coin', version: '2', purpose: 'agent-wallet-deposit-pull' },
      },
    ],
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    agentId?: string
    callerAddress?: string
    amountUsd?: number
    reason?: string
  }
  if (!body.agentId || !body.callerAddress?.startsWith('0x') || !body.amountUsd) {
    return NextResponse.json({ error: 'agentId + callerAddress + amountUsd required' }, { status: 400 })
  }

  const agent = getAgent(body.agentId)
  if (!agent || !agent.agentWalletAddress) {
    return NextResponse.json({ error: 'agent or agent wallet not found' }, { status: 404 })
  }

  // 8004-token gate — only the registered owner can trigger a pull.
  try {
    assertAgentTokenAuth({
      agentId: body.agentId,
      expectedOwner: agent.ownerAddress,
      caller: body.callerAddress as Address,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unauthorized' }, { status: 403 })
  }

  // x402 dance — first call returns 402 unless X-PAYMENT is present.
  const payment = req.headers.get('x-payment')
  if (!payment) {
    return NextResponse.json(
      paymentRequirements(req.nextUrl.pathname, body.agentId, body.amountUsd, agent.ownerAddress),
      { status: 402, headers: { 'x-payment-required': 'true' } },
    )
  }

  let proof: any = null
  try {
    proof = JSON.parse(Buffer.from(payment, 'base64').toString('utf8'))
    if (!proof.txHash) throw new Error('missing txHash')
  } catch (e: any) {
    return NextResponse.json({ error: 'invalid x-payment header', detail: e?.message }, { status: 402 })
  }

  const result = await pullDepositToOwner({
    agentId: body.agentId,
    agentWallet: agent.agentWalletAddress,
    ownerAddress: agent.ownerAddress,
    amountUsd: body.amountUsd,
    reason: body.reason ?? 'deposit-pull',
  })

  recordDepositPull(body.agentId, body.amountUsd, result.txHash)

  return NextResponse.json({
    ...result,
    settlement: { status: 'VERIFIED', proof },
  })
}
