import { NextRequest, NextResponse } from 'next/server'
import { runAgentCycle, agentInfo } from '@/lib/agent/trading-agent'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { persona = 'yolo', forceDirection = 'AUTO' } =
    (await req.json().catch(() => ({}))) as {
      persona?: 'yolo' | 'quant' | 'scared'
      forceDirection?: 'LONG' | 'SHORT' | 'AUTO'
    }

  const origin = req.nextUrl.origin
  // Fire and forget — frontend polls /api/agent/status
  runAgentCycle({ persona, forceDirection, baseUrl: origin }).catch(() => {})

  return NextResponse.json({ started: true, persona, forceDirection, agent: agentInfo() })
}

export async function GET() {
  return NextResponse.json({ agent: agentInfo() })
}
