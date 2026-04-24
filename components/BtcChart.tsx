'use client'

import { useEffect, useRef, useState } from 'react'

interface Point { t: number; v: number }

/**
 * Live BTC/USD chart.
 *   seed:  Binance REST /api/v3/klines (1m × 60) on mount
 *   live:  poll /api/v3/ticker/price every 3s, append real price
 *   fallback: synthetic random walk only if Binance unreachable
 */
export default function BtcChart() {
  const [points, setPoints] = useState<Point[]>([])
  const [live, setLive] = useState<number | null>(null)
  const [delta, setDelta] = useState<number>(0)
  const [source, setSource] = useState<'BINANCE' | 'MOCK'>('MOCK')
  const pollRef = useRef<any>(null)

  // Seed with 60 × 1m candles from Binance, fallback to mock.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(
          'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=60',
          { cache: 'no-store' },
        )
        if (!r.ok) throw 0
        const klines: any[][] = await r.json()
        const pts: Point[] = klines
          .filter(k => Array.isArray(k) && k.length >= 5)
          .map(k => ({ t: Number(k[0]), v: parseFloat(k[4]) }))
        if (pts.length > 10) {
          setPoints(pts)
          setLive(pts[pts.length - 1].v)
          setSource('BINANCE')
          return
        }
        throw 0
      } catch {
        const base = 78_000 + Math.random() * 1500
        const seed: Point[] = []
        let p = base
        for (let i = 0; i < 60; i++) {
          p += (Math.random() - 0.5) * 250
          seed.push({ t: Date.now() - (60 - i) * 60_000, v: p })
        }
        setPoints(seed)
        setLive(seed[seed.length - 1].v)
        setSource('MOCK')
      }
    })()
  }, [])

  // Live tick — poll real BTC spot price every 3s.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(
          'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
          { cache: 'no-store' },
        )
        if (!r.ok) return
        const j = await r.json()
        const price = parseFloat(j.price)
        if (!price || !Number.isFinite(price)) return
        setPoints(prev => {
          if (prev.length === 0) return prev
          const arr = [...prev, { t: Date.now(), v: price }].slice(-80)
          setLive(price)
          setDelta(price - prev[0].v)
          setSource('BINANCE')
          return arr
        })
      } catch { /* offline — leave chart alone */ }
    }, 3000)
    return () => clearInterval(pollRef.current)
  }, [])

  const W = 600
  const H = 170
  const hasData = points.length >= 2
  const min = hasData ? Math.min(...points.map(p => p.v)) : 0
  const max = hasData ? Math.max(...points.map(p => p.v)) : 1
  const pad = (max - min) * 0.15 || 1
  const y = (val: number) => H - 20 - ((val - (min - pad)) / (max + pad - (min - pad))) * (H - 30)
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * W

  const pathD = hasData
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ')
    : ''
  const up = delta >= 0
  const stroke = up ? 'var(--buy)' : 'var(--sell)'

  return (
    <div className="panel p-0 flex flex-col" style={{ width: '100%', height: '100%' }}>
      <div className="flex items-end justify-between px-4 pt-4">
        <div>
          <div className="text-xs text-ink-2 font-bold">BTC/USD</div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="font-display text-4xl tabular-nums">
              ${live ? live.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
            </span>
            <span className="font-mono font-bold text-sm" style={{ color: up ? 'var(--buy)' : 'var(--sell)' }}>
              {up ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
            style={{ background: source === 'BINANCE' ? 'var(--buy)' : 'var(--money)' }}
          />
          <span className="text-ink-3 font-mono font-bold">{source}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" preserveAspectRatio="none" style={{ height: H }}>
        {[0.33, 0.66].map(g => (
          <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--line)" />
        ))}
        {hasData && <path d={pathD} stroke={stroke} strokeWidth="2" fill="none" />}
        {hasData && (
          <circle cx={x(points.length - 1)} cy={y(points[points.length - 1].v)} r="3" fill={stroke}>
            <animate attributeName="r" values="3;6;3" dur="1.6s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
    </div>
  )
}
