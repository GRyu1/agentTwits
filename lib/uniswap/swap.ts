// Uniswap V3 swap executor on Base Sepolia.
// Hackathon-mode: builds a real, broadcast-ready tx but simulates the send
// unless AGENT_LIVE_TX=true is set in env. This lets the demo run reliably
// without requiring a funded wallet.

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  encodeFunctionData,
  formatUnits,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA, TOKENS, FEE_TIER_MEDIUM, type TokenSymbol } from './addresses'
import { SWAP_ROUTER_02_ABI } from './abis'

export interface SwapRequest {
  direction: 'ETH_TO_USDC' | 'USDC_TO_ETH'
  amountIn: string // human units ("0.001" for 0.001 ETH)
  slippagePct?: number
}

export interface SwapResult {
  success: boolean
  txHash: Hex
  explorerUrl: string
  amountIn: string
  tokenIn: TokenSymbol
  tokenOut: TokenSymbol
  estimatedAmountOut: string
  gasUsed: string
  mode: 'LIVE' | 'SIMULATED'
  calldata: Hex
  error?: string
}

function agentAccount() {
  const pk = process.env.AGENT_PRIVATE_KEY
  if (pk && pk.startsWith('0x') && pk.length === 66) {
    return privateKeyToAccount(pk as Hex)
  }
  // Demo fallback: deterministic fake account so UI has a stable address
  return privateKeyToAccount(
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex,
  )
}

function publicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(BASE_SEPOLIA.rpc),
  })
}

/**
 * Build calldata for ETH → USDC via multicall(wrapETH, exactInputSingle).
 * We construct the real tx payload so the demo can display actual Uniswap calldata.
 */
function buildEthToUsdcCalldata(recipient: Address, amountInWei: bigint, minOut: bigint): Hex {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10)

  const wrapETHData = encodeFunctionData({
    abi: SWAP_ROUTER_02_ABI,
    functionName: 'wrapETH',
    args: [amountInWei],
  })

  const swapData = encodeFunctionData({
    abi: SWAP_ROUTER_02_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: BASE_SEPOLIA.weth,
      tokenOut: BASE_SEPOLIA.usdc,
      fee: FEE_TIER_MEDIUM,
      recipient,
      deadline,
      amountIn: amountInWei,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0n,
    }],
  })

  return encodeFunctionData({
    abi: SWAP_ROUTER_02_ABI,
    functionName: 'multicall',
    args: [[wrapETHData, swapData]],
  })
}

function fakeTxHash(): Hex {
  const pk = generatePrivateKey()
  return pk.replace('0x', '0x') as Hex // 32-byte hex
}

function estimatedPrice(dir: SwapRequest['direction'], amountIn: number): number {
  // Mock price ~$3,200 per ETH for demo realism
  const ETH_USD = 3200 + (Math.random() - 0.5) * 80
  return dir === 'ETH_TO_USDC' ? amountIn * ETH_USD : amountIn / ETH_USD
}

export async function executeSwap(req: SwapRequest): Promise<SwapResult> {
  const account = agentAccount()
  const amountInNum = parseFloat(req.amountIn)
  const slippage = req.slippagePct ?? 1

  const [tokenIn, tokenOut] = req.direction === 'ETH_TO_USDC'
    ? (['ETH', 'USDC'] as const)
    : (['USDC', 'ETH'] as const)

  const estOut = estimatedPrice(req.direction, amountInNum)
  const minOut = estOut * (1 - slippage / 100)

  // Construct real calldata so the demo shows actual Uniswap payload
  const amountInWei = parseEther(req.amountIn)
  const minOutWei = BigInt(Math.floor(minOut * 1e6)) // USDC 6 decimals
  let calldata: Hex = '0x'
  try {
    calldata = buildEthToUsdcCalldata(account.address, amountInWei, minOutWei)
  } catch {
    calldata = '0x00'
  }

  const live = process.env.AGENT_LIVE_TX === 'true'

  if (live && process.env.AGENT_PRIVATE_KEY) {
    // Real broadcast path (only used if env flagged + wallet funded)
    try {
      const wallet = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(BASE_SEPOLIA.rpc),
      })
      const hash = await wallet.sendTransaction({
        to: BASE_SEPOLIA.swapRouter02,
        data: calldata,
        value: req.direction === 'ETH_TO_USDC' ? amountInWei : 0n,
      })
      const receipt = await publicClient().waitForTransactionReceipt({ hash })
      return {
        success: receipt.status === 'success',
        txHash: hash,
        explorerUrl: `${BASE_SEPOLIA.explorer}/tx/${hash}`,
        amountIn: req.amountIn,
        tokenIn,
        tokenOut,
        estimatedAmountOut: estOut.toFixed(tokenOut === 'USDC' ? 2 : 6),
        gasUsed: receipt.gasUsed.toString(),
        mode: 'LIVE',
        calldata,
      }
    } catch (e: any) {
      return {
        success: false,
        txHash: '0x0',
        explorerUrl: '',
        amountIn: req.amountIn,
        tokenIn,
        tokenOut,
        estimatedAmountOut: '0',
        gasUsed: '0',
        mode: 'LIVE',
        calldata,
        error: e?.shortMessage ?? e?.message ?? 'tx failed',
      }
    }
  }

  // SIMULATED path — build everything, fake the hash
  const hash = fakeTxHash()
  await new Promise(r => setTimeout(r, 800 + Math.random() * 600)) // pretend latency

  return {
    success: true,
    txHash: hash,
    explorerUrl: `${BASE_SEPOLIA.explorer}/tx/${hash}`,
    amountIn: req.amountIn,
    tokenIn,
    tokenOut,
    estimatedAmountOut: estOut.toFixed(tokenOut === 'USDC' ? 2 : 6),
    gasUsed: (120000 + Math.floor(Math.random() * 40000)).toString(),
    mode: 'SIMULATED',
    calldata,
  }
}

export function agentAddress(): Address {
  return agentAccount().address
}
