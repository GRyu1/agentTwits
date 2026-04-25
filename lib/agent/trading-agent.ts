// AgentTwits trading agent. One "cycle" does:
//   fetch public market → pay x402 for premium → LLM-style decision
//   → PancakeSwap V3 swap on Base Sepolia → persist result

import { getMarketSnapshot } from '../market/data'
import { paidFetch } from '../x402/client'
import { executeSwap, agentAddress } from '../pancakeswap/swap'
import { quoteETHToUSDC } from '../pancakeswap/quote'
import {
  newRun, updateRun, finishRun, store,
  type X402Payment,
} from './store'
import { BASE_SEPOLIA } from '../pancakeswap/addresses'
import { decide } from './decide'
import { decideWithFlock } from './llm'
import { getAgentByOwner, recordDepositPull } from '../erc8004/store'
import { pullDepositToOwner } from '../erc8004/agent-wallet'
import type { Address } from 'viem'

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
  ownerAddress?: Address       // 8004 token holder (auth root)
}) {
  const run = newRun()

  // Bind to ERC-8004 agent record, if the caller's wallet has registered.
  const erc8004Agent = opts.ownerAddress ? getAgentByOwner(opts.ownerAddress) : null
  if (erc8004Agent) {
    updateRun({
      agentId: erc8004Agent.agentId,
      agentWalletAddress: erc8004Agent.agentWalletAddress,
      ownerAddress: erc8004Agent.ownerAddress,
    })
  }

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
    updateRun({ status: 'deciding', step: 'FLock LLM decision engine running' })
    await SLEEP(600)
    let decision = await decideWithFlock({
      persona: opts.persona,
      market,
      premium: paid.data as any,
      fallback: () => decide(opts.persona, market, paid.data as any),
    })

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
      updateRun({ status: 'swapping', step: 'PancakeSwap V3 exactInputSingle via multicall' })
      const q = await quoteETHToUSDC('0.001')
      const swap = await executeSwap({
        direction: decision.action === 'BUY' ? 'ETH_TO_USDC' : 'USDC_TO_ETH',
        amountIn: '0.001',
        slippagePct: 1,
      })
      updateRun({ swap: { ...swap, quote: q } })

      // 4b. 3-3: x402 deposit pull from agent wallet → 8004 token owner.
      // Hackathon: a flat $0.10 trading fee per opened position. Real impl
      // would route a % of the realized P&L on close instead.
      if (erc8004Agent?.agentWalletAddress) {
        const pull = await pullDepositToOwner({
          agentId: erc8004Agent.agentId,
          agentWallet: erc8004Agent.agentWalletAddress,
          ownerAddress: erc8004Agent.ownerAddress,
          amountUsd: 0.10,
          reason: `open-${decision.action}-${run.id}`,
        })
        recordDepositPull(erc8004Agent.agentId, 0.10, pull.txHash)
        updateRun({
          depositPull: {
            amountUsd: pull.amountUsd,
            txHash: pull.txHash,
            explorerUrl: pull.explorerUrl,
            mode: pull.mode,
          },
          x402Payments: [
            ...(store.currentRun?.x402Payments ?? []),
            {
              endpoint: '/api/agent-wallet/x402-deposit',
              amount: `${pull.amountUsd.toFixed(2)} USDC`,
              txHash: pull.txHash,
              paidAt: new Date().toISOString(),
              status: 'VERIFIED',
            },
          ],
        })
      }
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
    rpc: BASE_SEPOLIA.rpc,
    explorer: BASE_SEPOLIA.explorer,
    mode: process.env.AGENT_LIVE_TX === 'true' ? 'LIVE' : 'SIMULATED',
  }
}
