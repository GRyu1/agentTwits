// ERC-8004 registry deployment on Base Sepolia.
// Hackathon: addresses are placeholders — swap to real deployments when live.
// IdentityRegistry mints a soul-bound agent token (agentId) and tracks identity.
// ReputationRegistry receives feedback (PnL deltas, USD-denominated).
// ValidationRegistry stores third-party validation receipts (not used in MVP).

export const ERC8004 = {
  chainId: 84532,
  identityRegistry:    '0x8004A100000000000000000000000000000A1DD1' as const,
  reputationRegistry:  '0x8004B200000000000000000000000000000B1DD2' as const,
  validationRegistry:  '0x8004C300000000000000000000000000000C1DD3' as const,
  // ERC-8004 token transfer rail — for hackathon we treat the agentId itself
  // as a non-transferable ERC-721 minted by IdentityRegistry.
  agentTokenSymbol: 'A8004',
} as const

// AgentWallet (minimal-proxy clones) — implementation + factory.
// Each agent gets its own clone; owner = holder of agentId on IdentityRegistry.
export const AGENT_WALLET = {
  factory:        '0xA6E40F00FACE00000000000000000000000000F1' as const,
  implementation: '0xA6E40F00C10E00000000000000000000000000C1' as const,
} as const
