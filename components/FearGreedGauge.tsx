'use client'

interface Props { value: number }

/** Horizontal bar gauge — blue block on left, red block on right, needle between.
 *  Flat, no gradients, no glow. */
export default function FearGreedGauge({ value }: Props) {
  const v = Math.min(100, Math.max(0, value))

  const label =
    v < 20 ? 'EXTREME FEAR' :
    v < 40 ? 'FEAR' :
    v < 60 ? 'NEUTRAL' :
    v < 80 ? 'GREED' :
             'EXTREME GREED'

  const tone = v < 40 ? 'fear' : v > 60 ? 'greed' : 'neutral'

  return (
    <div className="panel p-6 flex flex-col justify-between" style={{ minHeight: 220, width: '100%', height: '100%' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-ink-2 font-bold">Market Mood</div>
          <div className="font-display text-4xl mt-1"
               style={{ color: tone === 'fear' ? 'var(--fear)' : tone === 'greed' ? 'var(--greed)' : 'var(--ink)' }}>
            {label}
          </div>
        </div>
        <div className="font-display text-ink tabular-nums" style={{ fontSize: 72 }}>{v}</div>
      </div>

      {/* Bar */}
      <div className="mt-6">
        <div className="relative h-5 flex" style={{ border: '2px solid var(--ink)' }}>
          <div className="bg-fear" style={{ width: '40%' }} />
          <div style={{ background: 'var(--line-2)', width: '20%' }} />
          <div className="bg-greed" style={{ width: '40%' }} />

          {/* Needle */}
          <div
            className="absolute top-[-6px] bottom-[-6px] w-1 bg-ink"
            style={{ left: `calc(${v}% - 2px)`, transition: 'left 1.2s cubic-bezier(.2,.9,.3,1.2)' }}
          />
          <div
            className="absolute w-3 h-3 bg-ink"
            style={{ left: `calc(${v}% - 6px)`, top: -14, transition: 'left 1.2s cubic-bezier(.2,.9,.3,1.2)' }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs font-bold">
          <span className="text-fear">PANIC · 0</span>
          <span className="text-ink-3">50</span>
          <span className="text-greed">EUPHORIA · 100</span>
        </div>
      </div>
    </div>
  )
}
