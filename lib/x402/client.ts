// Minimal x402-style client for the demo.
// Real x402: server returns 402 + payment requirements, client pays on-chain,
// retries with X-PAYMENT header. We replicate the dance but simulate the pay
// step unless AGENT_LIVE_TX=true.

import { generatePrivateKey } from 'viem/accounts'
import type { Hex } from 'viem'
import { BASE_SEPOLIA } from '../pancakeswap/addresses'
import { agentAddress } from '../pancakeswap/swap'

export interface X402Requirement {
  scheme: 'exact'
  network: 'base-sepolia'
  maxAmountRequired: string // USDC in atomic (6d) string
  resource: string
  description: string
  payTo: string
  asset: string // USDC address
  mimeType: 'application/json'
}

export interface X402PaymentProof {
  txHash: Hex
  paidAmount: string
  paidAt: string
  payer: string
  network: 'base-sepolia'
}

export interface PaidFetchResult<T> {
  data: T
  requirement: X402Requirement
  proof: X402PaymentProof
  durationMs: number
}

function fakeHash(): Hex {
  return generatePrivateKey() // 0x + 64 hex chars — same shape as a tx hash
}

/**
 * Makes a request that expects a 402. If received, simulates paying (USDC on
 * Base Sepolia), then retries with the X-PAYMENT header set. Returns payload
 * + payment proof for UI display.
 */
export async function paidFetch<T = any>(url: string): Promise<PaidFetchResult<T>> {
  const started = Date.now()

  // 1. Probe request — expect 402
  const probe = await fetch(url, { method: 'GET', cache: 'no-store' })

  if (probe.status !== 402) {
    // Endpoint didn't gate; still return a shape consumers can use
    const data = (await probe.json()) as T
    return {
      data,
      requirement: {
        scheme: 'exact',
        network: 'base-sepolia',
        maxAmountRequired: '0',
        resource: url,
        description: 'free endpoint',
        payTo: '0x0',
        asset: BASE_SEPOLIA.usdc,
        mimeType: 'application/json',
      },
      proof: {
        txHash: '0x0' as Hex,
        paidAmount: '0',
        paidAt: new Date().toISOString(),
        payer: agentAddress(),
        network: 'base-sepolia',
      },
      durationMs: Date.now() - started,
    }
  }

  const body = await probe.json()
  const requirement: X402Requirement = body.accepts?.[0] ?? body

  // 2. "Pay" — in real x402 this is an on-chain USDC transfer to payTo.
  //    We simulate latency and synthesize a tx hash.
  await new Promise(r => setTimeout(r, 400 + Math.random() * 400))
  const proof: X402PaymentProof = {
    txHash: fakeHash(),
    paidAmount: requirement.maxAmountRequired,
    paidAt: new Date().toISOString(),
    payer: agentAddress(),
    network: 'base-sepolia',
  }

  // 3. Retry with payment header (base64-ish payload for demo)
  const paymentHeader = Buffer.from(
    JSON.stringify({
      scheme: requirement.scheme,
      network: requirement.network,
      txHash: proof.txHash,
      payer: proof.payer,
      amount: proof.paidAmount,
    }),
  ).toString('base64')

  const paid = await fetch(url, {
    method: 'GET',
    headers: { 'X-PAYMENT': paymentHeader },
    cache: 'no-store',
  })

  if (!paid.ok) throw new Error(`x402 settle failed: ${paid.status}`)
  const data = (await paid.json()) as T

  return { data, requirement, proof, durationMs: Date.now() - started }
}
