// AgentTwits trading agent. One "cycle" does:
//   fetch public market → pay x402 for premium → LLM-style decision
//   → Uniswap V3 swap on Base Sepolia → persist result

import { getMarketSnapshot } from '../market/data'
import { paidFetch } from '../x402/client'
import { executeSwap, agentAddress } from '../uniswap/swap'
import { quoteETHToUSDC } from '../uniswap/quote'
import {
  newRun, updateRun, finishRun, store,
  type X402Payment,
} from './store'
import { BASE_SEPOLIA } from '../uniswap/addresses'
import { decide } from './decide'

const SLEEP = (ms: number) => new Promise(r => setTimeout(r, ms))

interface PremiumSignal {
  whaleActivity: 'accumulation' | 'distribution' | 'neutral'
  fundingRate: number
  recommendation: 'LONG_BIAS' | 'SHORT_BIAS' | 'NEUTRAL'
  confidence: number
  liquidationZones: { below: number; above: number }
}


export async function runAgentCycle(opts: {
  persona: 'yolo' | 'quant' | 'scared'
  baseUrl: string
  forceDirection?: 'LONG' | 'SHORT' | 'AUTO'
}) {
  const run = newRun()

  try {
    // 1. Public market data
    updateRun({ status: 'fetching_market', step: 'fetching CoinGecko market snapshot' })
    await SLEEP(500)
    const market = await getMarketSnapshot()
    updateRun({ market })

    // 2. x402-gated premium signal
    updateRun({ status: 'paying_x402', step: 'requesting premium signals (402 expected)' })
    const paid = await paidFetch<PremiumSignal>(`${opts.baseUrl}/api/market/signals`)
    const x402Entry: X402Payment = {
      endpoint: '/api/market/signals',
      amount: `${(Number(paid.requirement.maxAmountRequired) / 1e6).toFixed(4)} USDC`,
      txHash: paid.proof.txHash,
      paidAt: paid.proof.paidAt,
      status: 'VERIFIED',
    }
    updateRun({
      premiumSignal: paid.data,
      x402Payments: [...(store.currentRun?.x402Payments ?? []), x402Entry],
    })

    // 3. Decide
    updateRun({ status: 'deciding', step: 'persona decision engine running' })
    await SLEEP(600)
    let decision = decide(opts.persona, market, paid.data as any)

    // Direction override — if user locked LONG/SHORT, rewrite the decision so
    // the agent always opens a position in the chosen side (no HOLD either).
    if (opts.forceDirection && opts.forceDirection !== 'AUTO') {
      const forced = opts.forceDirection === 'LONG' ? 'BUY' : 'SELL'
      decision = {
        ...decision,
        action: forced,
        message: `${forced} forced by user direction lock. ${decision.message}`,
        reasoning: `[forced=${opts.forceDirection}] ${decision.reasoning}`,
      }
    }
    updateRun({ decision })

    // 4. Execute if needed
    if (decision.action !== 'HOLD') {
      updateRun({ status: 'swapping', step: 'Uniswap V3 exactInputSingle via multicall' })
      const q = await quoteETHToUSDC('0.001')
      const swap = await executeSwap({
        direction: decision.action === 'BUY' ? 'ETH_TO_USDC' : 'USDC_TO_ETH',
        amountIn: '0.001',
        slippagePct: 1,
      })
      updateRun({ swap: { ...swap, quote: q } })
    }

    finishRun({ status: 'done', step: 'cycle complete' })
  } catch (e: any) {
    finishRun({ status: 'error', step: 'cycle failed', error: e?.message ?? String(e) })
  }

  return store.currentRun
}

export function agentInfo() {
  return {
    address: agentAddress(),
    network: 'Base Sepolia',
    chainId: BASE_SEPOLIA.chainId,
    mode: process.env.AGENT_LIVE_TX === 'true' ? 'LIVE' : 'SIMULATED',
  }
}
