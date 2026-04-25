// Coinbase AgentKit (CDP) wallet provider wrapper.
// Docs: https://docs.cdp.coinbase.com/agent-kit/welcome
//
// Each registered ERC-8004 agent gets its own CDP-managed server wallet via
// `CdpEvmWalletProvider.configureWithWallet`. The CDP wallet's address is what
// we register in IdentityRegistry as the `agentAddress`, and what signs swap
// + native_transfer broadcasts (replacing the AGENT_PRIVATE_KEY env path).
//
// Hackathon: when CDP env vars are missing we fall back to a deterministic
// fake address derived from agentId, so local dev demos still work.

import { keccak256, toBytes, type Address, type Hex } from 'viem'

type CdpEvmWalletProviderType = {
  getAddress(): string
  getNetwork(): { networkId?: string }
  nativeTransfer(to: Address, ethValue: string): Promise<Hex>
}

type AgentKitModule = {
  CdpEvmWalletProvider: {
    configureWithWallet(opts: {
      apiKeyId: string
      apiKeySecret: string
      walletSecret: string
      networkId: string
      address?: Address
    }): Promise<CdpEvmWalletProviderType>
  }
}

async function loadAgentKit(): Promise<AgentKitModule> {
  // Keep AgentKit out of Next's build-time resolver; package exports differ
  // between its root API and internal wallet-provider files.
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<AgentKitModule>
  return dynamicImport('@coinbase/agentkit')
}

export interface CdpWalletInfo {
  agentId: string
  address: Address
  networkId: string
  source: 'cdp' | 'mock'
  createdAt: string
}

export function cdpConfigured(): boolean {
  return Boolean(
    process.env.CDP_API_KEY_ID &&
    process.env.CDP_API_KEY_SECRET &&
    process.env.CDP_WALLET_SECRET,
  )
}

const NETWORK_ID = process.env.CDP_NETWORK_ID || 'base-sepolia'

// In-process cache so we don't re-init AgentKit for every API call. Each
// agentId maps to a configured wallet provider instance.
interface CdpProviderCache {
  byAgentId: Map<string, CdpEvmWalletProviderType>
  byAddress: Map<string, CdpEvmWalletProviderType>
}
const cache: CdpProviderCache = (globalThis as any).__cdpProviderCache ?? {
  byAgentId: new Map(),
  byAddress: new Map(),
}
;(globalThis as any).__cdpProviderCache = cache

/**
 * Deterministic fake address from agentId — used only when CDP env vars are
 * absent. Lets the rest of the app render coherently without live keys.
 */
function mockAddress(agentId: string): Address {
  const h = keccak256(toBytes(`cdp:mock:${agentId}`))
  return ('0x' + h.slice(26)) as Address
}

/**
 * Create (or reuse) a CDP server wallet for a specific 8004 agentId.
 * Important: this is server-side only — never call from the browser since
 * it would expose the CDP wallet secret.
 */
export async function getOrCreateCdpWallet(agentId: string): Promise<CdpWalletInfo> {
  // Mock path — returns a stable demo address.
  if (!cdpConfigured()) {
    return {
      agentId,
      address: mockAddress(agentId),
      networkId: NETWORK_ID,
      source: 'mock',
      createdAt: new Date().toISOString(),
    }
  }

  if (cache.byAgentId.has(agentId)) {
    const wp = cache.byAgentId.get(agentId)!
    return {
      agentId,
      address: wp.getAddress() as Address,
      networkId: wp.getNetwork().networkId ?? NETWORK_ID,
      source: 'cdp',
      createdAt: new Date().toISOString(),
    }
  }

  // Lazy-import to avoid bundling AgentKit into client code paths.
  const { CdpEvmWalletProvider } = await loadAgentKit()
  const wp = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
    networkId: NETWORK_ID,
    // Note: we let CDP mint a fresh wallet per agentId. Real production
    // would persist (agentId → address) and pass `address` here on rehydrate.
  })

  const address = wp.getAddress() as Address
  cache.byAgentId.set(agentId, wp)
  cache.byAddress.set(address.toLowerCase(), wp)

  return {
    agentId,
    address,
    networkId: wp.getNetwork().networkId ?? NETWORK_ID,
    source: 'cdp',
    createdAt: new Date().toISOString(),
  }
}

/**
 * Move a cached provider entry from one agentId key to another. Used after
 * IdentityRegistry returns the real agentId so subsequent lookups don't miss
 * the wallet that was created under a provisional id.
 */
export async function rebindCdpWalletAgentId(fromAgentId: string, toAgentId: string): Promise<void> {
  if (fromAgentId === toAgentId) return
  const wp = cache.byAgentId.get(fromAgentId)
  if (!wp) return
  cache.byAgentId.set(toAgentId, wp)
  cache.byAgentId.delete(fromAgentId)
}

/**
 * Recover an existing CDP wallet by its address (e.g. on a fresh server boot
 * we have the address persisted in our 8004 store but not the in-memory
 * provider). Falls back to mock if CDP isn't configured.
 */
export async function getCdpWalletByAddress(address: Address): Promise<CdpEvmWalletProviderType | null> {
  if (!cdpConfigured()) return null
  const hit = cache.byAddress.get(address.toLowerCase())
  if (hit) return hit

  const { CdpEvmWalletProvider } = await loadAgentKit()
  const wp = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
    networkId: NETWORK_ID,
    address,
  })
  cache.byAddress.set(address.toLowerCase(), wp)
  return wp
}

/**
 * Hand-off to AgentKit native_transfer — used when the trading agent wants to
 * move ETH/USDC out of the CDP wallet (e.g. fund the EIP-1167 proxy).
 */
export async function cdpNativeTransfer(opts: {
  fromAddress: Address
  to: Address
  ethValue: string
}): Promise<{ txHash: Hex; mode: 'cdp' | 'mock' }> {
  if (!cdpConfigured()) {
    // Mock — synthesize a tx-hash-shaped value
    const h = keccak256(toBytes(`${opts.fromAddress}|${opts.to}|${opts.ethValue}|${Date.now()}`))
    return { txHash: h, mode: 'mock' }
  }
  const wp = await getCdpWalletByAddress(opts.fromAddress)
  if (!wp) throw new Error(`No CDP wallet found for ${opts.fromAddress}`)
  const hash = await wp.nativeTransfer(opts.to, opts.ethValue)
  return { txHash: hash, mode: 'cdp' }
}
