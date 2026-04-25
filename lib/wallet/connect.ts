// MetaMask-only wallet connect.
//
// We use the EIP-6963 announce/discover protocol to find the MetaMask provider
// even when multiple wallets are injected (Rabby, Coinbase, OKX, etc. all
// fight over `window.ethereum`). Falls back to `window.ethereum` when it
// self-identifies as MetaMask via `isMetaMask`.

import type { Address, Hex } from 'viem'
import { BASE_SEPOLIA } from '../pancakeswap/addresses'

declare global {
  interface Window {
    ethereum?: any
  }
}

export interface WalletState {
  address: Address
  chainIdHex: Hex
  chainId: number
  onBaseSepolia: boolean
}

const BASE_SEPOLIA_HEX = ('0x' + BASE_SEPOLIA.chainId.toString(16)) as Hex
const METAMASK_INSTALL_URL = 'https://metamask.io/download/'

// EIP-6963 provider info shape.
interface Eip6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string }
  provider: any
}

let cachedProvider: any | null = null

function isMetaMaskProvider(p: any): boolean {
  if (!p) return false
  // MetaMask-only: explicitly reject Coinbase / Brave / Rabby / Phantom etc.
  if (p.isCoinbaseWallet) return false
  if (p.isBraveWallet) return false
  if (p.isRabby) return false
  if (p.isPhantom) return false
  return Boolean(p.isMetaMask)
}

/**
 * Discover the MetaMask EIP-1193 provider. Returns null if MetaMask isn't
 * installed in the browser. Caches result.
 */
export function getMetaMaskProvider(): any | null {
  if (typeof window === 'undefined') return null
  if (cachedProvider) return cachedProvider

  // 1. EIP-6963 announce — most reliable when multiple wallets are present.
  let announced: any | null = null
  const onAnnounce = (event: any) => {
    const detail = event.detail as Eip6963ProviderDetail | undefined
    if (!detail?.provider) return
    if (detail.info?.rdns === 'io.metamask' || isMetaMaskProvider(detail.provider)) {
      announced = detail.provider
    }
  }
  try {
    window.addEventListener('eip6963:announceProvider', onAnnounce as any)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
  } finally {
    window.removeEventListener('eip6963:announceProvider', onAnnounce as any)
  }
  if (announced) {
    cachedProvider = announced
    return announced
  }

  // 2. Multi-provider fallback: window.ethereum.providers[]
  const eth = window.ethereum
  if (!eth) return null
  if (Array.isArray(eth.providers)) {
    const mm = eth.providers.find(isMetaMaskProvider)
    if (mm) {
      cachedProvider = mm
      return mm
    }
  }

  // 3. Single provider fallback
  if (isMetaMaskProvider(eth)) {
    cachedProvider = eth
    return eth
  }
  return null
}

export function hasMetaMask() {
  return getMetaMaskProvider() !== null
}

export async function connectWallet(): Promise<WalletState> {
  const provider = getMetaMaskProvider()
  if (!provider) {
    throw new Error(`MetaMask not detected. Install it at ${METAMASK_INSTALL_URL}`)
  }
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as Address[]
  if (!accounts?.[0]) throw new Error('MetaMask returned no accounts.')

  await ensureBaseSepolia()

  const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as Hex
  return {
    address: accounts[0],
    chainIdHex,
    chainId: parseInt(chainIdHex, 16),
    onBaseSepolia: chainIdHex.toLowerCase() === BASE_SEPOLIA_HEX.toLowerCase(),
  }
}

export async function ensureBaseSepolia(): Promise<void> {
  const provider = getMetaMaskProvider()
  if (!provider) return
  const current = (await provider.request({ method: 'eth_chainId' })) as Hex
  if (current.toLowerCase() === BASE_SEPOLIA_HEX.toLowerCase()) return

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_SEPOLIA_HEX }],
    })
  } catch (err: any) {
    // 4902 = chain not added — add it then switch.
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message ?? '')) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BASE_SEPOLIA_HEX,
          chainName: 'Base Sepolia',
          nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: [BASE_SEPOLIA.rpc],
          blockExplorerUrls: [BASE_SEPOLIA.explorer],
        }],
      })
    } else {
      throw err
    }
  }
}

export function onAccountChange(cb: (accounts: Address[]) => void): () => void {
  const provider = getMetaMaskProvider()
  if (!provider) return () => {}
  const handler = (accs: Address[]) => cb(accs)
  provider.on?.('accountsChanged', handler)
  return () => provider.removeListener?.('accountsChanged', handler)
}

export function onChainChange(cb: (chainIdHex: Hex) => void): () => void {
  const provider = getMetaMaskProvider()
  if (!provider) return () => {}
  const handler = (id: Hex) => cb(id)
  provider.on?.('chainChanged', handler)
  return () => provider.removeListener?.('chainChanged', handler)
}

export { METAMASK_INSTALL_URL }
