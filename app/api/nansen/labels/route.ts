// Nansen address-labels passthrough — used by WalletPanel to badge the
// connected MetaMask wallet ("Smart Trader", "DeFi Power User", ENS, etc.).

import { NextRequest, NextResponse } from 'next/server'
import { getAddressLabels } from '@/lib/nansen/signals'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  const chain = req.nextUrl.searchParams.get('chain') ?? 'base'
  if (!address || !address.startsWith('0x')) {
    return NextResponse.json({ error: 'address required' }, { status: 400 })
  }
  const r = await getAddressLabels(address, chain)
  return NextResponse.json({
    address,
    chain,
    source: r.source,
    labels: r.labels,
  })
}
