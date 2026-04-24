// Uniswap V3 contract addresses on Base Sepolia testnet
// Source: https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments

export const BASE_SEPOLIA = {
  chainId: 84532,
  rpc: 'https://sepolia.base.org',
  explorer: 'https://sepolia.basescan.org',
  swapRouter02: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4' as const,
  quoterV2:     '0xC5290058841028F1614F3A6F0F5816cAd0df5E27' as const,
  factory:      '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24' as const,
  weth:         '0x4200000000000000000000000000000000000006' as const,
  usdc:         '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const,
} as const

export const TOKENS = {
  WETH: { address: BASE_SEPOLIA.weth, symbol: 'WETH', decimals: 18 },
  USDC: { address: BASE_SEPOLIA.usdc, symbol: 'USDC', decimals: 6 },
  ETH:  { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', decimals: 18 },
} as const

export type TokenSymbol = keyof typeof TOKENS
export const FEE_TIER_MEDIUM = 3000 // 0.3%
