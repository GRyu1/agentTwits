// Pure persona-driven trend evaluation + decision.
// Safe to import from both server (trading-agent) and client (AgentConsole /
// MyAgentTab) — no Node-only dependencies.

import type { AgentDecision } from './store'
import type { MarketSnapshot } from '../market/data'

export type Persona = 'yolo' | 'quant' | 'scared'

export interface PremiumLike {
  recommendation: 'LONG_BIAS' | 'SHORT_BIAS' | 'NEUTRAL'
  whaleActivity: 'accumulation' | 'distribution' | 'neutral'
  fundingRate: number
}

/** Trend evaluation + persona-specific sideways band + directional bias. */
export function evaluateTrend(
  market: MarketSnapshot,
  premium: PremiumLike,
  persona: Persona,
): { score: number; direction: 'bullish' | 'bearish' | 'sideways' } {
  const base =
    (premium.recommendation === 'LONG_BIAS' ? 35 : premium.recommendation === 'SHORT_BIAS' ? -35 : 0) +
    market.change24h * 6 +
    (market.rsi < 35 ? 15 : market.rsi > 70 ? -15 : 0) +
    (premium.whaleActivity === 'accumulation' ? 20 : premium.whaleActivity === 'distribution' ? -20 : 0) +
    (market.trend === 'UP' ? 10 : market.trend === 'DOWN' ? -10 : 0)

  const sidewaysBand = persona === 'yolo' ? 8 : persona === 'quant' ? 22 : 15
  const bias         = persona === 'yolo' ? 8 : persona === 'scared' ? -6 : 0

  const score = Math.round(base + bias)
  const direction: 'bullish' | 'bearish' | 'sideways' =
    score >  sidewaysBand ? 'bullish' :
    score < -sidewaysBand ? 'bearish' :
                            'sideways'
  return { score, direction }
}

/** Persona-voiced decision. All personas route:
 *    bullish → BUY (LONG)   bearish → SELL (SHORT)   sideways → HOLD  */
export function decide(
  persona: Persona,
  market: MarketSnapshot,
  premium: PremiumLike,
): AgentDecision {
  const t = evaluateTrend(market, premium, persona)
  const shared = { trend: t.direction, trendScore: t.score }

  if (t.direction === 'sideways') {
    if (persona === 'yolo') return {
      action: 'HOLD', emotion: 'Optimistic', confidence: 30,
      message: `market's sleeping. annoying. waiting.`,
      reasoning: `score=${t.score}. sideways within YOLO's tight band — nothing to chase.`,
      ...shared,
    }
    if (persona === 'scared') return {
      action: 'HOLD', emotion: 'Cautious', confidence: 40,
      message: `sideways is still scary. stepping aside.`,
      reasoning: `score=${t.score}. KIM waits out choppy tape.`,
      ...shared,
    }
    return {
      action: 'HOLD', emotion: 'Neutral', confidence: 55,
      message: `no directional edge. RSI ${market.rsi}, funding ${premium.fundingRate}. flat.`,
      reasoning: `score=${t.score}. QUANT requires |score|>22 to enter.`,
      ...shared,
    }
  }

  if (t.direction === 'bullish') {
    if (persona === 'yolo') return {
      action: 'BUY', emotion: 'Aggressive',
      confidence: Math.min(95, 70 + t.score),
      message: `LFG!!! bullish confirmed. RSI ${market.rsi}, whale ${premium.whaleActivity}. sending it.`,
      reasoning: `score=${t.score}. YOLO takes LONG on any bullish read.`,
      ...shared,
    }
    if (persona === 'scared') return {
      action: 'BUY', emotion: 'Cautious',
      confidence: Math.max(35, 40 + Math.min(25, t.score) / 2),
      message: `...fine. small long. reluctantly.`,
      reasoning: `score=${t.score}. KIM only longs when clearly bullish, minimal size.`,
      ...shared,
    }
    return {
      action: 'BUY', emotion: 'Optimistic',
      confidence: Math.min(88, 55 + t.score / 2),
      message: `bullish edge confirmed. LONG ${Math.min(5, t.score / 20).toFixed(1)}% sizing.`,
      reasoning: `score=${t.score}. QUANT follows the trend.`,
      ...shared,
    }
  }

  // bearish → SHORT
  if (persona === 'yolo') return {
    action: 'SELL', emotion: 'Aggressive',
    confidence: Math.min(70, 50 + Math.abs(t.score) / 3),
    message: `ugh. flipping short. hate doing this.`,
    reasoning: `score=${t.score}. YOLO reluctantly shorts when bearish pushes past its tight band.`,
    ...shared,
  }
  if (persona === 'scared') return {
    action: 'SELL', emotion: 'Defensive',
    confidence: Math.min(92, 70 + Math.abs(t.score) / 3),
    message: `I TOLD YOU. shorting. get out while you can.`,
    reasoning: `score=${t.score}. KIM's home turf — high-conviction short.`,
    ...shared,
  }
  return {
    action: 'SELL', emotion: 'Cautious',
    confidence: Math.min(88, 55 + Math.abs(t.score) / 2),
    message: `bearish edge. SHORT ${Math.min(5, Math.abs(t.score) / 20).toFixed(1)}% sizing.`,
    reasoning: `score=${t.score}. QUANT follows the trend.`,
    ...shared,
  }
}
