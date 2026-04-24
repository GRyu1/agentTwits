// Uniswap V3 QuoterV2 wrapper. Falls back to mock pricing for demo reliability.

import { createPublicClient, http, parseEther, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA, FEE_TIER_MEDIUM } from './addresses'
import { QUOTER_V2_ABI } from './abis'

export interface Quote {
  amountIn: string
  amountOut: string
  priceImpactPct: number
  gasEstimate: string
  source: 'UNISWAP_QUOTER' | 'MOCK'
}

export async function quoteETHToUSDC(amountInEth: string): Promise<Quote> {
  const amountInWei = parseEther(amountInEth)

  if (process.env.AGENT_LIVE_QUOTE === 'true') {
    try {
      const client = createPublicClient({ chain: baseSepolia, transport: http(BASE_SEPOLIA.rpc) })
      const result = await client.readContract({
        address: BASE_SEPOLIA.quoterV2,
        abi: QUOTER_V2_ABI,
        functionName: 'quoteExactInputSingle',
        args: [{
          tokenIn: BASE_SEPOLIA.weth as Address,
          tokenOut: BASE_SEPOLIA.usdc as Address,
          amountIn: amountInWei,
          fee: FEE_TIER_MEDIUM,
          sqrtPriceLimitX96: 0n,
        }],
      })
      const [amountOut, , , gasEstimate] = result as [bigint, bigint, number, bigint]
      return {
        amountIn: amountInEth,
        amountOut: (Number(amountOut) / 1e6).toFixed(2),
        priceImpactPct: 0.12,
        gasEstimate: gasEstimate.toString(),
        source: 'UNISWAP_QUOTER',
      }
    } catch {
      /* fall through to mock */
    }
  }

  const ETH_USD = 3200 + (Math.random() - 0.5) * 60
  const out = parseFloat(amountInEth) * ETH_USD
  return {
    amountIn: amountInEth,
    amountOut: out.toFixed(2),
    priceImpactPct: 0.12 + Math.random() * 0.15,
    gasEstimate: '135000',
    source: 'MOCK',
  }
}
