// Minimal typed client for the Nansen API.
// Docs: https://docs.nansen.ai/  Base: https://api.nansen.ai/api/v1/
//
// All Nansen endpoints we touch are POST + JSON, authenticated via the
// `apiKey` header. We add a tiny in-process TTL cache so repeated fetches
// (e.g. a polling UI) don't burn rate limit, and fall back to a `mock`
// generator when NANSEN_API_KEY isn't set — keeps local dev painless.

export const NANSEN_BASE_URL = 'https://api.nansen.ai/api/v1'

export type NansenResult<T> =
  | { ok: true; source: 'nansen'; data: T }
  | { ok: true; source: 'mock'; data: T }
  | { ok: false; source: 'nansen'; error: string; status?: number }

interface CacheEntry { value: any; expiresAt: number }
const cache: Map<string, CacheEntry> = (globalThis as any).__nansenCache ?? new Map()
;(globalThis as any).__nansenCache = cache

import { isDemoMode } from '../demo'

export function nansenConfigured(): boolean {
  // Demo mode short-circuits every external service to its mock path so
  // the demo never shows a 401/empty-state/rate-limit failure.
  if (isDemoMode()) return false
  return Boolean(process.env.NANSEN_API_KEY)
}

interface CallOpts {
  ttlMs?: number          // cache duration (default 60s)
  cacheKey?: string       // override cache key
  signal?: AbortSignal
}

/**
 * Low-level POST against the Nansen API. When the key isn't configured we
 * skip the network call entirely and return `{ source: 'mock' }` with the
 * provided fallback so callers can render reasonable demo data.
 */
export async function nansenPost<T>(
  path: string,
  body: any,
  fallback: () => T,
  opts: CallOpts = {},
): Promise<NansenResult<T>> {
  const ttl = opts.ttlMs ?? 60_000
  const key = opts.cacheKey ?? `${path}|${JSON.stringify(body)}`
  const now = Date.now()

  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  if (!nansenConfigured()) {
    const r: NansenResult<T> = { ok: true, source: 'mock', data: fallback() }
    cache.set(key, { value: r, expiresAt: now + ttl })
    return r
  }

  try {
    const res = await fetch(`${NANSEN_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Spec uses lowercase `apikey` header; we send both common casings
        // because some intermediaries normalize headers and Nansen accepts
        // either. The lowercase one is the canonical one.
        apikey: process.env.NANSEN_API_KEY!,
        'API-KEY': process.env.NANSEN_API_KEY!,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: opts.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const err: NansenResult<T> = {
        ok: false, source: 'nansen', status: res.status,
        error: `nansen ${path} ${res.status}: ${text.slice(0, 200)}`,
      }
      // Don't cache hard failures — but cache 4xx briefly to avoid hammering.
      cache.set(key, { value: err, expiresAt: now + Math.min(ttl, 30_000) })
      return err
    }
    const json = (await res.json()) as T
    const r: NansenResult<T> = { ok: true, source: 'nansen', data: json }
    cache.set(key, { value: r, expiresAt: now + ttl })
    return r
  } catch (e: any) {
    return { ok: false, source: 'nansen', error: e?.message ?? 'fetch failed' }
  }
}

export function clearNansenCache() {
  cache.clear()
}
