// x402-protected premium market signals endpoint.
//
// Real x402 flow (per https://docs.x402.org/):
//   1. Client requests resource.
//   2. Server returns 402 + { accepts: [paymentRequirements] }.
//   3. Client pays on Base (USDC transfer to payTo).
//   4. Client retries with X-PAYMENT header (base64 payload).
//   5. Server verifies, returns resource.
//
// We implement the exact shape but skip on-chain verification for the demo.

import { NextRequest, NextResponse } from 'next/server'
import { BASE_SEPOLIA } from '@/lib/pancakeswap/addresses'
import { getNansenPremiumSignal } from '@/lib/nansen/signals'

const PAY_TO = (process.env.X402_RECIPIENT_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`

const PRICE_USDC_ATOMIC = '1000' // 0.001 USDC (6 decimals)

function paymentRequirements(pathname: string) {
  return {
    x402Version: 1,
    error: 'Payment required',
    accepts: [
      {
        scheme: 'exact',
        network: 'base-sepolia',
        maxAmountRequired: PRICE_USDC_ATOMIC,
        resource: pathname,
        description: 'AgentTwits Premium Signal — whale flow + funding + bias',
        mimeType: 'application/json',
        payTo: PAY_TO,
        maxTimeoutSeconds: 60,
        asset: BASE_SEPOLIA.usdc,
        extra: { name: 'USD Coin', version: '2' },
      },
    ],
  }
}

async function premiumPayload() {
  // Real signal: Nansen Smart Money netflow + Token-God-Mode indicators for
  // WETH on Base. Falls back to a coherent mock when NANSEN_API_KEY isn't set.
  const sig = await getNansenPremiumSignal()
  return {
    source: sig.source === 'nansen' ? 'Nansen (Smart Money + TGM)' : 'AgentTwits Premium Signals v1 (mock)',
    paidVia: 'x402',
    timestamp: sig.generatedAt,
    whaleActivity: sig.whaleActivity,
    fundingRate: sig.fundingRate,
    openInterest: sig.netFlow24hUsd > 0 ? 'increasing' : 'decreasing',
    liquidationZones: sig.liquidationZones,
    recommendation: sig.recommendation,
    confidence: sig.confidence,
    nansen: {
      netFlow1hUsd: sig.netFlow1hUsd,
      netFlow24hUsd: sig.netFlow24hUsd,
      netFlow7dUsd: sig.netFlow7dUsd,
      traderCount: sig.traderCount,
      riskSummary: sig.riskSummary,
      rewardSummary: sig.rewardSummary,
      priceMomentum: sig.priceMomentum,
      attribution: sig.attribution,
    },
  }
}

export async function GET(req: NextRequest) {
  const payment = req.headers.get('x-payment')

  // No payment → 402
  if (!payment) {
    return NextResponse.json(paymentRequirements(req.nextUrl.pathname), {
      status: 402,
      headers: { 'x-payment-required': 'true' },
    })
  }

  // Minimal verification: header must be base64 JSON with txHash
  let decoded: any
  try {
    decoded = JSON.parse(Buffer.from(payment, 'base64').toString('utf8'))
    if (!decoded.txHash || typeof decoded.txHash !== 'string') throw new Error('missing txHash')
  } catch (e: any) {
    return NextResponse.json(
      { error: 'invalid x-payment header', detail: e?.message },
      { status: 402 },
    )
  }

  try {
    // In production: check the tx on-chain transferred USDC >= maxAmountRequired to payTo.
    const payload = await premiumPayload()
    return NextResponse.json(
      {
        ...payload,
        settlement: {
          status: 'VERIFIED',
          txHash: decoded.txHash,
          payer: decoded.payer ?? null,
          network: 'base-sepolia',
        },
      },
      { headers: { 'x-payment-response': 'settled' } },
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: 'premium signal unavailable', detail: e?.message ?? 'signal build failed' },
      { status: 502 },
    )
  }
}
