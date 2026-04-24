import { NextResponse } from 'next/server'
import { getState } from '@/lib/agent/store'
import { agentInfo } from '@/lib/agent/trading-agent'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ agent: agentInfo(), ...getState() })
}
