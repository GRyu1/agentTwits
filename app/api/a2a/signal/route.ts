// External agent submits a signal. Reputation gains if signal is well-formed.
// Real platform would evaluate signal vs outcome; for demo we credit submission.

import { NextRequest, NextResponse } from 'next/server'
import { upsertExternal, store } from '@/lib/agent/store'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string
    asset?: string
    bias?: 'LONG' | 'SHORT' | 'NEUTRAL'
    note?: string
    x402Paid?: boolean
  }

  if (!body.id || !body.asset || !body.bias) {
    return NextResponse.json(
      { error: 'id, asset, bias required', example: { id: 'my-bot', asset: 'ETH', bias: 'LONG', note: 'RSI<30' } },
      { status: 400 },
    )
  }

  const existing = store.externalAgents[body.id]
  const repGain = 3 + (body.note ? 1 : 0) + (body.x402Paid ? 2 : 0)

  const agent = upsertExternal(body.id, {
    repScore: Math.min(100, (existing?.repScore ?? 5) + repGain),
    signalsSubmitted: (existing?.signalsSubmitted ?? 0) + 1,
    x402Paid: (existing?.x402Paid ?? 0) + (body.x402Paid ? 1 : 0),
    recentSignals: [
      {
        at: new Date().toISOString(),
        asset: body.asset,
        bias: body.bias,
        note: body.note ?? '',
      },
      ...(existing?.recentSignals ?? []),
    ].slice(0, 10),
  })

  return NextResponse.json({ ok: true, agent, repGain })
}
