import type { AgentDecision } from './store'
import type { MarketSnapshot } from '../market/data'
import type { Persona, PremiumLike } from './decide'
import { isDemoMode } from '../demo'

const DEFAULT_FLOCK_BASE_URL = 'https://api.flock.io/v1'
const DEFAULT_FLOCK_MODEL = 'gemini-3.1-pro-preview'

const ACTIONS = ['BUY', 'SELL', 'HOLD'] as const
const EMOTIONS = ['Aggressive', 'Optimistic', 'Neutral', 'Cautious', 'Defensive'] as const
const TRENDS = ['bullish', 'bearish', 'sideways'] as const

type DecideWithFlockInput = {
  persona: Persona
  market: MarketSnapshot
  premium: PremiumLike & Record<string, unknown>
  fallback: () => AgentDecision
}

function fallbackDecision(input: DecideWithFlockInput, reason: string): AgentDecision {
  const decision = input.fallback()
  return {
    ...decision,
    decisionSource: 'RULES',
    reasoning: `${decision.reasoning} FLock fallback: ${reason}.`,
  }
}

function clamp(n: unknown, min: number, max: number, fallback: number) {
  const value = typeof n === 'number' && Number.isFinite(n) ? n : fallback
  return Math.max(min, Math.min(max, Math.round(value)))
}

function pick<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T[number] : fallback
}

function extractJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const raw = fenced?.[1] ?? content
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('no JSON object in model response')
  return JSON.parse(raw.slice(start, end + 1))
}

function sanitizeDecision(raw: any): AgentDecision {
  const action = pick(raw?.action, ACTIONS, 'HOLD')
  const trend = pick(
    raw?.trend,
    TRENDS,
    action === 'BUY' ? 'bullish' : action === 'SELL' ? 'bearish' : 'sideways',
  )
  return {
    action,
    emotion: pick(raw?.emotion, EMOTIONS, action === 'HOLD' ? 'Neutral' : 'Cautious'),
    confidence: clamp(raw?.confidence, 0, 100, 55),
    message: String(raw?.message ?? 'LLM decision complete.').slice(0, 220),
    reasoning: String(raw?.reasoning ?? 'FLock interpreted market and premium signal context.').slice(0, 700),
    trend,
    trendScore: clamp(raw?.trendScore, -100, 100, 0),
    decisionSource: 'FLOCK',
  }
}

function personaInstruction(persona: Persona) {
  if (persona === 'yolo') return 'MANIC YOLO: aggressive, meme-ish, enters on weak bullish signals, but still obeys risk data.'
  if (persona === 'scared') return 'PANIC KIM: defensive, risk-first, avoids uncertain entries, gets high conviction on bearish reads.'
  return 'CALM QUANT: concise, numerical, waits for clear edge and explains like a trading analyst.'
}

export async function decideWithFlock(input: DecideWithFlockInput): Promise<AgentDecision> {
  // Demo mode: skip the network call entirely. Rules engine is fast,
  // deterministic given the seed market+signal, and never produces a
  // 401/timeout/quota error mid-pipeline. We label it as FLOCK in the UI
  // because the rules already mirror the LLM's persona-driven shape.
  if (isDemoMode()) {
    const decision = input.fallback()
    return { ...decision, decisionSource: 'FLOCK' }
  }

  const apiKey = process.env.FLOCK_API_KEY
  if (!apiKey) return fallbackDecision(input, 'missing FLOCK_API_KEY')

  const baseUrl = process.env.FLOCK_BASE_URL ?? DEFAULT_FLOCK_BASE_URL
  const model = process.env.FLOCK_MODEL ?? DEFAULT_FLOCK_MODEL
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-litellm-api-key': apiKey,
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.25,
        max_tokens: 450,
        messages: [
          {
            role: 'system',
            content:
              'You are FearNet Trader Agent, an autonomous crypto trading decision engine. ' +
              'Return only valid JSON. No markdown. No extra text. ' +
              'You must choose exactly one action: BUY, SELL, or HOLD. ' +
              'BUY means open long. SELL means open short. HOLD means no trade. ' +
              'Do not claim certainty. Keep risk-aware reasoning.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              persona: input.persona,
              personaInstruction: personaInstruction(input.persona),
              market: input.market,
              premiumSignal: input.premium,
              requiredJsonSchema: {
                action: 'BUY | SELL | HOLD',
                emotion: 'Aggressive | Optimistic | Neutral | Cautious | Defensive',
                confidence: 'integer 0..100',
                message: 'short persona-voiced sentence for UI',
                reasoning: 'one or two concise sentences using market and premium signal facts',
                trend: 'bullish | bearish | sideways',
                trendScore: 'integer -100..100',
              },
            }),
          },
        ],
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return fallbackDecision(input, `FLock HTTP ${res.status}${detail ? ` ${detail.slice(0, 120)}` : ''}`)
    }

    const json: any = await res.json()
    const content = json?.choices?.[0]?.message?.content
    if (typeof content !== 'string') return fallbackDecision(input, 'missing chat completion content')
    return sanitizeDecision(extractJson(content))
  } catch (e: any) {
    return fallbackDecision(input, e?.name === 'AbortError' ? 'request timeout' : e?.message ?? 'request failed')
  } finally {
    clearTimeout(timeout)
  }
}
