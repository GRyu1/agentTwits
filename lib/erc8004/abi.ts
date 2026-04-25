// Minimal ABIs for ERC-8004 registries used in the FearNet demo.
// Derived from EIP-8004 draft: identity is an ERC-721-like soul-bound token,
// reputation is a feedback receiver tied to that token id.

export const IDENTITY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentDomain', type: 'string' },
      { name: 'agentAddress', type: 'address' },
    ],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'agentDomain', type: 'string', indexed: false },
    ],
  },
] as const

export const REPUTATION_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'acceptFeedback',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'pnlUsdE6', type: 'int256' }, // signed USD * 1e6 (USDC scale)
      { name: 'evidenceUri', type: 'string' },
    ],
    outputs: [{ name: 'newScore', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'scoreOf',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'FeedbackAccepted',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'pnlUsdE6', type: 'int256', indexed: false },
      { name: 'newScore', type: 'uint256', indexed: false },
    ],
  },
] as const

// Minimal-proxy wallet factory ABI — EIP-1167 clone of `implementation` per agentId.
export const AGENT_WALLET_FACTORY_ABI = [
  {
    type: 'function',
    name: 'predictAgentWallet',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'wallet', type: 'address' }],
  },
  {
    type: 'function',
    name: 'createAgentWallet',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'wallet', type: 'address' }],
  },
  {
    type: 'event',
    name: 'AgentWalletCreated',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'wallet', type: 'address', indexed: true },
    ],
  },
] as const

// AgentWallet (the clone instance) — only the methods FearNet calls directly.
export const AGENT_WALLET_ABI = [
  {
    type: 'function',
    name: 'agentId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'pullDeposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountUsdE6', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [{ name: 'txHash', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'closePosition',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'positionId', type: 'bytes32' },
      { name: 'pnlUsdE6', type: 'int256' },
    ],
    outputs: [{ name: 'newRep', type: 'uint256' }],
  },
] as const
