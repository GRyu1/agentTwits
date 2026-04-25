// Top tokens that Nansen smart money is currently accumulating (24h netflow).
// Used by the Smart Money inflow strip in the My Trader panel.

import { NextRequest, NextResponse } from 'next/server'
import { getSmartMoneyInflows } from '@/lib/nansen/signals'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const chains = (req.nextUrl.searchParams.get('chains') ?? 'ethereum,base,solana')
    .split(',').map(s => s.trim()).filter(Boolean)
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '8')

  const r = await getSmartMoneyInflows({ chains, limit })
  return NextResponse.json({
    source: r.source,
    chains,
    rows: r.rows,
  })
}
