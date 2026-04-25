// PancakeSwap V3 contract addresses on Base Sepolia.
// These match PancakeSwap's V3 deployments; verified by eth_getCode on Base Sepolia.

export const BASE_SEPOLIA = {
  chainId: 84532,
  rpc: 'https://sepolia.base.org',
  explorer: 'https://sepolia.basescan.org',
  pancakeV3SwapRouter: '0x1b81D678ffb9C0263b24A97847620C99d213eB14' as const,
  pancakeQuoterV2:     '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997' as const,
  pancakeV3Factory:    '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865' as const,
  weth:         '0x4200000000000000000000000000000000000006' as const,
  usdc:         '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
} as const

export const TOKENS = {
  WETH: { address: BASE_SEPOLIA.weth, symbol: 'WETH', decimals: 18 },
  USDC: { address: BASE_SEPOLIA.usdc, symbol: 'USDC', decimals: 6 },
  ETH:  { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18 },
} as const

export type TokenSymbol = keyof typeof TOKENS
export const FEE_TIER_MEDIUM = 2500 // PancakeSwap V3 0.25%
