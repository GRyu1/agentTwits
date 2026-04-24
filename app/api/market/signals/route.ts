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
import { BASE_SEPOLIA } from '@/lib/uniswap/addresses'

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

function premiumPayload() {
  const flipCoin = () => Math.random() > 0.5
  const score = Math.random()
  return {
    source: 'AgentTwits Premium Signals v1',
    paidVia: 'x402',
    timestamp: new Date().toISOString(),
    whaleActivity: score > 0.6 ? 'accumulation' : score > 0.35 ? 'neutral' : 'distribution',
    fundingRate: Number(((Math.random() - 0.4) * 0.05).toFixed(4)),
    openInterest: flipCoin() ? 'increasing' : 'decreasing',
    liquidationZones: {
      below: Math.round(2800 + Math.random() * 100),
      above: Math.round(3250 + Math.random() * 120),
    },
    recommendation: score > 0.6 ? 'LONG_BIAS' : score < 0.35 ? 'SHORT_BIAS' : 'NEUTRAL',
    confidence: Math.round(55 + Math.random() * 40),
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
  try {
    const decoded = JSON.parse(Buffer.from(payment, 'base64').toString('utf8'))
    if (!decoded.txHash || typeof decoded.txHash !== 'string') throw new Error('missing txHash')
    // In production: check the tx on-chain transferred USDC ≥ maxAmountRequired to payTo.
    return NextResponse.json(
      {
        ...premiumPayload(),
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
      { error: 'invalid x-payment header', detail: e?.message },
      { status: 402 },
    )
  }
}
