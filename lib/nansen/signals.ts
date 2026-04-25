// Higher-level Nansen helpers — combine raw endpoints into the shapes our UI +
// trading agent actually consume.
//
// Nansen supports Base mainnet but not Base Sepolia. We trade on Sepolia and
// pull *intel* from mainnet — same pattern most agents use during testnet demos.

import { nansenConfigured, nansenPost, type NansenResult } from './client'

const ETH_ON_BASE = '0x4200000000000000000000000000000000000006' // WETH on Base mainnet (same address on Sepolia coincidentally — but mainnet data is what Nansen returns)

export interface NansenPremiumSignal {
  source: 'nansen' | 'mock'
  generatedAt: string
  // Aggregate smart-money flow (USD) on the asset over multiple windows.
  netFlow1hUsd: number
  netFlow24hUsd: number
  netFlow7dUsd: number
  // Trader counts feeding the flow.
  traderCount: number
  // Token-God-Mode indicators.
  riskSummary: 'low' | 'medium' | 'high'
  rewardSummary: 'bearish' | 'neutral' | 'bullish'
  fundingRate: number
  priceMomentum: 'bullish' | 'neutral' | 'bearish'
  // Convenience derived fields the existing trading-agent expects.
  whaleActivity: 'accumulation' | 'distribution' | 'neutral'
  recommendation: 'LONG_BIAS' | 'SHORT_BIAS' | 'NEUTRAL'
  confidence: number          // 0-100
  liquidationZones: { below: number; above: number }
  // For UI attribution.
  attribution?: string
}

interface NetflowRow {
  token_address: string
  token_symbol: string
  net_flow_1h_usd: number
  net_flow_24h_usd: number
  net_flow_7d_usd: number
  net_flow_30d_usd: number
  chain: string
  trader_count: number
  market_cap_usd: number
}

interface IndicatorBlock {
  type: string
  summary: 'low' | 'medium' | 'high' | 'bearish' | 'neutral' | 'bullish'
  value?: number
}

interface IndicatorsResponse {
  token_address: string
  chain: string
  token_info: { market_cap_usd: number }
  risk_indicators: IndicatorBlock[]
  reward_indicators: IndicatorBlock[]
}

function pickIndicator(blocks: IndicatorBlock[] | undefined, type: string): IndicatorBlock | undefined {
  return blocks?.find(b => (
    typeof b?.type === 'string' && b.type.toLowerCase().includes(type.toLowerCase())
  ))
}

function mockPremium(): NansenPremiumSignal {
  const r = Math.random()
  return {
    source: 'mock',
    generatedAt: new Date().toISOString(),
    netFlow1hUsd:  Math.round((Math.random() - 0.4) * 2_000_000),
    netFlow24hUsd: Math.round((Math.random() - 0.4) * 25_000_000),
    netFlow7dUsd:  Math.round((Math.random() - 0.4) * 120_000_000),
    traderCount: 45 + Math.round(Math.random() * 80),
    riskSummary: r > 0.66 ? 'high' : r > 0.33 ? 'medium' : 'low',
    rewardSummary: r > 0.6 ? 'bullish' : r < 0.35 ? 'bearish' : 'neutral',
    fundingRate: Number(((Math.random() - 0.4) * 0.05).toFixed(4)),
    priceMomentum: r > 0.6 ? 'bullish' : r < 0.35 ? 'bearish' : 'neutral',
    whaleActivity: r > 0.6 ? 'accumulation' : r < 0.35 ? 'distribution' : 'neutral',
    recommendation: r > 0.6 ? 'LONG_BIAS' : r < 0.35 ? 'SHORT_BIAS' : 'NEUTRAL',
    confidence: 55 + Math.round(Math.random() * 40),
    liquidationZones: {
      below: Math.round(2800 + Math.random() * 100),
      above: Math.round(3250 + Math.random() * 120),
    },
    attribution: 'mock signal — set NANSEN_API_KEY to use live Nansen data',
  }
}

/**
 * Build the premium signal we hand to the x402-paid endpoint by combining:
 *   - smart-money/netflow for ETH on Base (whale flow direction + magnitude)
 *   - tgm/indicators for ETH on Base (risk/reward summary)
 *
 * Falls back to a coherent mock signal when NANSEN_API_KEY isn't present so
 * local dev demos still work.
 */
export async function getNansenPremiumSignal(): Promise<NansenPremiumSignal> {
  if (!nansenConfigured()) return mockPremium()

  // Pull the two sources in parallel.
  const [netflow, indicators] = await Promise.all([
    nansenPost<{ data: NetflowRow[] }>(
      '/smart-money/netflow',
      {
        chains: ['base'],
        filters: { token_address: [ETH_ON_BASE], include_native_tokens: true },
        order_by: [{ field: 'net_flow_24h_usd', direction: 'DESC' }],
        pagination: { page: 1, per_page: 5 },
      },
      () => ({ data: [] as NetflowRow[] }),
      { ttlMs: 45_000, cacheKey: 'nansen:netflow:eth:base' },
    ),
    nansenPost<IndicatorsResponse>(
      '/tgm/indicators',
      { chain: 'base', token_address: ETH_ON_BASE },
      () => ({
        token_address: ETH_ON_BASE, chain: 'base',
        token_info: { market_cap_usd: 0 },
        risk_indicators: [], reward_indicators: [],
      }),
      { ttlMs: 60_000, cacheKey: 'nansen:indicators:eth:base' },
    ),
  ])

  const row: NetflowRow | undefined = (netflow as NansenResult<{ data: NetflowRow[] }>).ok
    ? ((netflow as any).data?.data?.[0])
    : undefined

  const ind = (indicators as NansenResult<IndicatorsResponse>).ok
    ? (indicators as any).data
    : undefined

  // If both calls failed (e.g. invalid key), return mock so UI still renders.
  if (!row && !ind) return mockPremium()

  const flow1h  = Number(row?.net_flow_1h_usd ?? 0)
  const flow24h = Number(row?.net_flow_24h_usd ?? 0)
  const flow7d  = Number(row?.net_flow_7d_usd ?? 0)

  const risk = (pickIndicator(ind?.risk_indicators, 'liquidity')?.summary
    ?? pickIndicator(ind?.risk_indicators, 'concentration')?.summary
    ?? 'medium') as 'low' | 'medium' | 'high'

  const momentum = (pickIndicator(ind?.reward_indicators, 'price-momentum')?.summary
    ?? pickIndicator(ind?.reward_indicators, 'momentum')?.summary
    ?? 'neutral') as 'bearish' | 'neutral' | 'bullish'

  const reward = (pickIndicator(ind?.reward_indicators, 'cex-flows')?.summary
    ?? momentum) as 'bearish' | 'neutral' | 'bullish'

  const fundingBlock = pickIndicator(ind?.reward_indicators, 'funding-rate')
  const fundingRate = typeof fundingBlock?.value === 'number'
    ? Number(fundingBlock.value.toFixed(4))
    : 0

  // Derive trader-friendly fields from the Nansen signal cluster.
  const whaleActivity: NansenPremiumSignal['whaleActivity'] =
    flow24h > 1_000_000 ? 'accumulation' :
    flow24h < -1_000_000 ? 'distribution' : 'neutral'

  const recommendation: NansenPremiumSignal['recommendation'] =
    momentum === 'bullish' && whaleActivity === 'accumulation' ? 'LONG_BIAS' :
    momentum === 'bearish' && whaleActivity === 'distribution' ? 'SHORT_BIAS' :
    'NEUTRAL'

  // Confidence: stronger with concordant signals; risk lowers it.
  const concord =
    (momentum === 'bullish' && whaleActivity === 'accumulation') ||
    (momentum === 'bearish' && whaleActivity === 'distribution') ? 1 : 0
  const riskPenalty = risk === 'high' ? 25 : risk === 'medium' ? 10 : 0
  const confidence = Math.max(45, Math.min(95, 60 + concord * 25 - riskPenalty))

  return {
    source: 'nansen',
    generatedAt: new Date().toISOString(),
    netFlow1hUsd: flow1h,
    netFlow24hUsd: flow24h,
    netFlow7dUsd: flow7d,
    traderCount: Number(row?.trader_count ?? 0),
    riskSummary: risk,
    rewardSummary: reward,
    fundingRate,
    priceMomentum: momentum,
    whaleActivity,
    recommendation,
    confidence,
    liquidationZones: { below: 2900, above: 3300 }, // Nansen doesn't expose this directly; keep reasonable static zones
    attribution: `Nansen Smart Money + TGM Indicators · WETH/base · trader_count=${row?.trader_count ?? '?'}`,
  }
}

export interface SmartMoneyInflowRow {
  tokenAddress: string
  tokenSymbol: string
  chain: string
  netFlow24hUsd: number
  netFlow7dUsd: number
  traderCount: number
  marketCapUsd: number
}

/**
 * Top tokens that Nansen smart money is accumulating right now (24h).
 * Used by the Smart Money inflow strip in the My Trader tab.
 */
export async function getSmartMoneyInflows(opts: {
  chains?: string[]
  limit?: number
} = {}): Promise<{ source: 'nansen' | 'mock'; rows: SmartMoneyInflowRow[] }> {
  const chains = opts.chains ?? ['ethereum', 'base', 'solana']
  const limit = opts.limit ?? 8

  const mockInflows = () => ({
    source: 'mock' as const,
    rows: Array.from({ length: limit }).map((_, i) => ({
      tokenAddress: `0xmock${i.toString(16).padStart(38, '0')}`,
      tokenSymbol: ['ETH', 'PEPE', 'WIF', 'BONK', 'AERO', 'BRETT', 'TOSHI', 'DEGEN'][i % 8],
      chain: chains[i % chains.length],
      netFlow24hUsd: Math.round((Math.random() - 0.2) * 5_000_000),
      netFlow7dUsd:  Math.round((Math.random() - 0.2) * 30_000_000),
      traderCount: 30 + Math.round(Math.random() * 80),
      marketCapUsd: Math.round(Math.random() * 2_000_000_000),
    })),
  })

  if (!nansenConfigured()) {
    return mockInflows()
  }

  const r = await nansenPost<{ data: NetflowRow[] }>(
    '/smart-money/netflow',
    {
      chains,
      filters: { include_stablecoins: false, include_native_tokens: true },
      order_by: [{ field: 'net_flow_24h_usd', direction: 'DESC' }],
      pagination: { page: 1, per_page: limit },
    },
    () => ({ data: [] }),
    { ttlMs: 60_000, cacheKey: `nansen:smartmoney:inflows:${chains.join(',')}:${limit}` },
  )

  if (!r.ok || r.source === 'mock') {
    return mockInflows()
  }

  const rows: SmartMoneyInflowRow[] = (r.data?.data ?? []).map((d: NetflowRow) => ({
    tokenAddress: d.token_address,
    tokenSymbol: d.token_symbol,
    chain: d.chain,
    netFlow24hUsd: d.net_flow_24h_usd,
    netFlow7dUsd: d.net_flow_7d_usd,
    traderCount: d.trader_count,
    marketCapUsd: d.market_cap_usd,
  }))
  return { source: 'nansen', rows }
}

export interface NansenLabel { label: string; category: string }

/**
 * Pull Nansen labels (Smart Trader, Fund, DeFi power user, ENS, etc.) for an
 * address. Used to badge the connected MetaMask wallet in the WalletPanel.
 */
export async function getAddressLabels(address: string, chain = 'base'): Promise<{
  source: 'nansen' | 'mock'
  labels: NansenLabel[]
}> {
  if (!nansenConfigured()) {
    // Stable mock based on address — same address always maps to same labels.
    const seed = parseInt(address.slice(2, 10), 16) || 0
    const allMock: NansenLabel[] = [
      { label: 'Smart Trader (mock)', category: 'smart_money' },
      { label: 'DeFi Power User (mock)', category: 'defi' },
      { label: 'Active on PancakeSwap (mock)', category: 'behavioral' },
      { label: 'Base Native (mock)', category: 'behavioral' },
    ]
    return { source: 'mock', labels: allMock.slice(0, (seed % 3) + 1) }
  }

  const r = await nansenPost<{ data: NansenLabel[] }>(
    '/profiler/address/labels',
    { address, chain, pagination: { page: 1, per_page: 25 } },
    () => ({ data: [] }),
    { ttlMs: 5 * 60_000, cacheKey: `nansen:labels:${chain}:${address.toLowerCase()}` },
  )
  if (!r.ok) return { source: 'nansen', labels: [] }
  return { source: r.source, labels: (r.data?.data ?? []) }
}
