// ERC-8004 IdentityRegistry + ReputationRegistry helpers.
// Hackathon-mode: builds real calldata against the configured registry
// addresses on Base Sepolia, but simulates the broadcast unless
// AGENT_LIVE_TX=true + AGENT_PRIVATE_KEY are present.

import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { BASE_SEPOLIA } from '../uniswap/addresses'
import { ERC8004 } from './addresses'
import {
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
} from './abi'

export interface RegisterResult {
  success: boolean
  agentId: string         // uint256 stringified
  owner: Address
  agentDomain: string
  txHash: Hex
  explorerUrl: string
  mode: 'LIVE' | 'SIMULATED'
  calldata: Hex
}

export interface ReputationUpdateResult {
  success: boolean
  agentId: string
  pnlUsdE6: string         // signed int as string (USDC e6)
  pnlUsd: number           // human-readable
  newScore: number         // 0-100 client-side projected score
  txHash: Hex
  explorerUrl: string
  mode: 'LIVE' | 'SIMULATED'
  calldata: Hex
}

function fakeTxHash(): Hex {
  return generatePrivateKey()
}

function fakeAddress(seed: string): Address {
  // Deterministic-ish "address" derived from seed — purely for demo display.
  const h = keccak256(toBytes(seed))
  return ('0x' + h.slice(26)) as Address
}

function isLiveBroadcast() {
  return process.env.AGENT_LIVE_TX === 'true' && !!process.env.AGENT_PRIVATE_KEY
}

function ownerAccount() {
  const pk = process.env.AGENT_PRIVATE_KEY
  if (pk && pk.startsWith('0x') && pk.length === 66) {
    return privateKeyToAccount(pk as Hex)
  }
  return null
}

/**
 * IdentityRegistry.register(agentDomain, agentAddress) → agentId.
 * agentId is the 8004 token id used everywhere downstream (auth + reputation).
 */
export async function registerAgent(opts: {
  owner: Address
  agentDomain: string
  agentAddress: Address
}): Promise<RegisterResult> {
  const calldata = encodeFunctionData({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: 'register',
    args: [opts.agentDomain, opts.agentAddress],
  })

  if (isLiveBroadcast()) {
    const acct = ownerAccount()!
    try {
      const wallet = createWalletClient({
        account: acct,
        chain: baseSepolia,
        transport: http(BASE_SEPOLIA.rpc),
      })
      const hash = await wallet.sendTransaction({
        to: ERC8004.identityRegistry,
        data: calldata,
      })
      const pub = createPublicClient({ chain: baseSepolia, transport: http(BASE_SEPOLIA.rpc) })
      const receipt = await pub.waitForTransactionReceipt({ hash })
      // Real impl: parse AgentRegistered event for agentId. For demo we still
      // synthesize a stable id from the tx hash.
      const agentId = BigInt(keccak256(hash)).toString().slice(0, 6)
      return {
        success: receipt.status === 'success',
        agentId,
        owner: opts.owner,
        agentDomain: opts.agentDomain,
        txHash: hash,
        explorerUrl: `${BASE_SEPOLIA.explorer}/tx/${hash}`,
        mode: 'LIVE',
        calldata,
      }
    } catch (e) {
      // Fall through to simulated path on any RPC error
    }
  }

  // SIMULATED path — synthesize an agentId so downstream UI works.
  await new Promise(r => setTimeout(r, 500 + Math.random() * 500))
  const seed = `${opts.owner}|${opts.agentDomain}|${Date.now()}`
  const agentId = (BigInt(keccak256(toBytes(seed))) % 1_000_000n).toString()
  const txHash = fakeTxHash()

  return {
    success: true,
    agentId,
    owner: opts.owner,
    agentDomain: opts.agentDomain,
    txHash,
    explorerUrl: `${BASE_SEPOLIA.explorer}/tx/${txHash}`,
    mode: 'SIMULATED',
    calldata,
  }
}

/**
 * ReputationRegistry.acceptFeedback(agentId, pnlUsdE6, evidenceUri).
 * Called after each closed position. pnlUsd can be negative.
 */
export async function pushReputation(opts: {
  agentId: string
  pnlUsd: number
  evidenceUri: string
  prevScore: number
}): Promise<ReputationUpdateResult> {
  const pnlE6Bigint = BigInt(Math.round(opts.pnlUsd * 1_000_000))
  const calldata = encodeFunctionData({
    abi: REPUTATION_REGISTRY_ABI,
    functionName: 'acceptFeedback',
    args: [BigInt(opts.agentId), pnlE6Bigint, opts.evidenceUri],
  })

  // Project new score client-side: bounded 0-100, $1 PnL ≈ 1.5 rep points.
  const delta = Math.round(opts.pnlUsd * 1.5)
  const newScore = Math.max(0, Math.min(100, opts.prevScore + delta))

  if (isLiveBroadcast()) {
    const acct = ownerAccount()!
    try {
      const wallet = createWalletClient({
        account: acct,
        chain: baseSepolia,
        transport: http(BASE_SEPOLIA.rpc),
      })
      const hash = await wallet.sendTransaction({
        to: ERC8004.reputationRegistry,
        data: calldata,
      })
      const pub = createPublicClient({ chain: baseSepolia, transport: http(BASE_SEPOLIA.rpc) })
      const receipt = await pub.waitForTransactionReceipt({ hash })
      return {
        success: receipt.status === 'success',
        agentId: opts.agentId,
        pnlUsdE6: pnlE6Bigint.toString(),
        pnlUsd: opts.pnlUsd,
        newScore,
        txHash: hash,
        explorerUrl: `${BASE_SEPOLIA.explorer}/tx/${hash}`,
        mode: 'LIVE',
        calldata,
      }
    } catch {
      /* fall through */
    }
  }

  await new Promise(r => setTimeout(r, 350 + Math.random() * 250))
  const txHash = fakeTxHash()
  return {
    success: true,
    agentId: opts.agentId,
    pnlUsdE6: pnlE6Bigint.toString(),
    pnlUsd: opts.pnlUsd,
    newScore,
    txHash,
    explorerUrl: `${BASE_SEPOLIA.explorer}/tx/${txHash}`,
    mode: 'SIMULATED',
    calldata,
  }
}

export { fakeAddress }
