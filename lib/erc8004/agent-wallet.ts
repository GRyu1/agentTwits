// AgentWallet factory + per-agent wallet helpers.
// Each registered agent (agentId) gets a deterministic EIP-1167 minimal-proxy
// clone that is auth-gated by the 8004 IdentityRegistry token holder.
//
// Hackathon: the predicted address is computed from a CREATE2-style hash of
// (factory, agentId, implementation). Real broadcast uses createAgentWallet().
//
// Auth model (3-2):
//   The minimal-proxy AgentWallet stores `agentId`. Any state-changing call
//   (pullDeposit / closePosition / trade) checks
//     IdentityRegistry.ownerOf(agentId) == msg.sender
//   so balance + open positions are effectively gated by who currently holds
//   the 8004 token. We mirror that check on the server before simulating tx.

import {
  encodeFunctionData,
  keccak256,
  toBytes,
  concat,
  pad,
  toHex,
  parseEther,
  type Address,
  type Hex,
} from 'viem'
import { generatePrivateKey } from 'viem/accounts'
import { BASE_SEPOLIA } from '../pancakeswap/addresses'
import { AGENT_WALLET, ERC8004 } from './addresses'
import { AGENT_WALLET_FACTORY_ABI, AGENT_WALLET_ABI } from './abi'

export interface AgentWalletInfo {
  agentId: string
  walletAddress: Address     // minimal-proxy clone
  ownerAddress: Address      // current 8004 token holder
  factory: Address
  implementation: Address
  createdAt: string
  txHash: Hex
  explorerUrl: string
  mode: 'LIVE' | 'SIMULATED'
  factoryCalldata: Hex
}

export interface DepositPullResult {
  success: boolean
  agentId: string
  fromWallet: Address        // the agent wallet
  toOwner: Address           // 8004 token owner — the actual recipient
  amountUsd: number
  amountUsdE6: string
  reason: string
  txHash: Hex
  explorerUrl: string
  x402Endpoint: string
  mode: 'LIVE' | 'SIMULATED'
  calldata: Hex
}

function fakeTxHash(): Hex {
  return generatePrivateKey()
}

/**
 * Predict the EIP-1167 minimal-proxy clone address for a given agentId.
 * Uses the standard CREATE2 formula: keccak(0xff ++ factory ++ salt ++ keccak(initCode))[12:]
 *
 * For a clone of `implementation`, the initcode is the EIP-1167 runtime
 * preamble. We don't broadcast — we just need a stable, address-shaped value.
 */
export function predictAgentWalletAddress(agentId: string): Address {
  const salt = pad(toHex(BigInt(agentId)), { size: 32 })
  // EIP-1167 minimal proxy initcode template (with implementation address spliced in)
  const initCode = concat([
    '0x3d602d80600a3d3981f3363d3d373d3d3d363d73' as Hex,
    AGENT_WALLET.implementation,
    '0x5af43d82803e903d91602b57fd5bf3' as Hex,
  ])
  const initCodeHash = keccak256(initCode)
  const create2 = keccak256(
    concat(['0xff' as Hex, AGENT_WALLET.factory, salt, initCodeHash]),
  )
  return ('0x' + create2.slice(26)) as Address
}

/**
 * Build the factory's createAgentWallet calldata. Always returned even in
 * SIMULATED mode so the UI can show real EIP-1167 deployment payload.
 */
export function buildCreateAgentWalletCalldata(agentId: string): Hex {
  return encodeFunctionData({
    abi: AGENT_WALLET_FACTORY_ABI,
    functionName: 'createAgentWallet',
    args: [BigInt(agentId)],
  })
}

/**
 * Spawn (or recover) the per-agent minimal-proxy wallet. Address is
 * deterministic given agentId + factory, so calling twice is idempotent.
 */
export async function createAgentWallet(opts: {
  agentId: string
  ownerAddress: Address
}): Promise<AgentWalletInfo> {
  const factoryCalldata = buildCreateAgentWalletCalldata(opts.agentId)
  const walletAddress = predictAgentWalletAddress(opts.agentId)

  // Short pretend-deploy delay; real broadcast would go here behind the
  // AGENT_LIVE_TX flag (omitted for hackathon brevity since address is CREATE2-deterministic).
  await new Promise(r => setTimeout(r, 400 + Math.random() * 400))
  const txHash = fakeTxHash()

  return {
    agentId: opts.agentId,
    walletAddress,
    ownerAddress: opts.ownerAddress,
    factory: AGENT_WALLET.factory,
    implementation: AGENT_WALLET.implementation,
    createdAt: new Date().toISOString(),
    txHash,
    explorerUrl: `${BASE_SEPOLIA.explorer}/tx/${txHash}`,
    mode: 'SIMULATED',
    factoryCalldata,
  }
}

/**
 * Server-side mirror of the on-chain auth gate (3-2):
 * Only the 8004 token holder can move funds or open/close positions on the
 * agent wallet. In real deployment this is enforced by the AgentWallet's
 * `onlyAgentOwner` modifier reading from IdentityRegistry.ownerOf(agentId).
 */
export function assertAgentTokenAuth(opts: {
  agentId: string
  expectedOwner: Address
  caller: Address
}) {
  if (opts.caller.toLowerCase() !== opts.expectedOwner.toLowerCase()) {
    throw new Error(
      `8004-auth: caller ${opts.caller} is not owner of agentId ${opts.agentId} (owner=${opts.expectedOwner})`,
    )
  }
}

/**
 * 3-3: Pull funds from the agent wallet to the 8004 token owner.
 * Real impl: agent posts a 402 receipt to AgentWallet, AgentWallet verifies
 * the x402 facilitator signature, then transfers USDC to ownerOf(agentId).
 *
 * For the demo we just build the AgentWallet.pullDeposit calldata + simulate.
 */
export async function pullDepositToOwner(opts: {
  agentId: string
  agentWallet: Address
  ownerAddress: Address
  amountUsd: number
  reason: string
}): Promise<DepositPullResult> {
  const amountUsdE6 = BigInt(Math.round(opts.amountUsd * 1_000_000))
  const calldata = encodeFunctionData({
    abi: AGENT_WALLET_ABI,
    functionName: 'pullDeposit',
    args: [amountUsdE6, opts.reason],
  })

  await new Promise(r => setTimeout(r, 350 + Math.random() * 350))
  const txHash = fakeTxHash()

  return {
    success: true,
    agentId: opts.agentId,
    fromWallet: opts.agentWallet,
    toOwner: opts.ownerAddress,
    amountUsd: opts.amountUsd,
    amountUsdE6: amountUsdE6.toString(),
    reason: opts.reason,
    txHash,
    explorerUrl: `${BASE_SEPOLIA.explorer}/tx/${txHash}`,
    x402Endpoint: '/api/agent-wallet/x402-deposit',
    mode: 'SIMULATED',
    calldata,
  }
}
