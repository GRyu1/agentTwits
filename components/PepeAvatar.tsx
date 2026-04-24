'use client'

/**
 * Agent avatars. Two modes:
 *   - Default: inline SVG pepe-family characters (license-clean, always works).
 *   - Asset mode: PNG/JPG dropped into /public/agents/. Flip USE_AGENT_ASSETS
 *     to `true` once files are in. Per-agent null fallback keeps SVG for any
 *     character you haven't supplied an image for.
 */

export type AgentType = 'kim' | 'ghost' | 'quant' | 'yolo' | 'dex' | 'angry' | 'lol' | 'dogecool'

// ┌─────────────────────────────────────────────────────────────┐
// │  Drop PNGs into /public/agents/ then flip this to `true`.   │
// └─────────────────────────────────────────────────────────────┘
const USE_AGENT_ASSETS = true

// Per-agent override. null = fall back to SVG for that agent.
// We only use the two hero pepes for KIM (crying/fear face) and YOLO
// (happy/greed face); others keep their distinct SVGs so no duplicate
// pepes sit next to each other in a zone.
const ASSET_MAP: Record<AgentType, string | null> = {
  kim:      '/agents/crypepe.png',
  ghost:    '/agents/thinkingpepe.png',
  quant:    '/agents/calmpepe.png',
  yolo:     '/agents/happypepe.png',
  dex:      '/agents/rolexpepe.png',
  angry:    '/agents/angry.png',
  lol:      '/agents/lol.png',
  dogecool: '/agents/dogecool.png',
}

interface Props {
  type: AgentType
  size?: number
  className?: string
}

const HEAD_PATH =
  'M18 48 C18 22 34 10 50 10 C67 10 82 22 82 48 C82 72 68 88 50 88 C32 88 18 72 18 48 Z'
const CHIN_PATH =
  'M30 70 C34 78 42 83 50 83 C58 83 66 78 70 70 C66 80 58 85 50 85 C42 85 34 80 30 70 Z'

function Base({ fill, stroke, opacity = 1 }: { fill: string; stroke: string; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {/* Head */}
      <path d={HEAD_PATH} fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Lower jaw shading */}
      <path d={CHIN_PATH} fill={stroke} opacity="0.22" />
      {/* Brow ridge */}
      <path d="M25 35 C32 28 40 28 48 33" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <path d="M52 33 C60 28 68 28 75 35" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </g>
  )
}

export default function PepeAvatar({ type, size = 56, className = '' }: Props) {
  const s = size
  const commonProps = {
    width: s,
    height: s,
    viewBox: '0 0 100 100',
    className,
    style: { display: 'block', flexShrink: 0 },
  }

  // Asset override — render the user's image instead of the SVG.
  const assetPath = USE_AGENT_ASSETS ? ASSET_MAP[type] : null
  if (assetPath) {
    // These two assets are cut-out PNGs with transparent backgrounds — wrap
    // them in a warm-white circle so they read as proper avatars next to the
    // in-image-backgrounded pepes (cry/happy/calm/thinking/rolex).
    const NEEDS_BG: AgentType[] = ['angry', 'lol']
    const needsBg = NEEDS_BG.includes(type)
    if (needsBg) {
      return (
        <div
          className={className}
          style={{
            width: s,
            height: s,
            borderRadius: '9999px',
            background: '#f5f2e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <img
            src={assetPath}
            alt={type}
            style={{ width: s * 0.88, height: s * 0.88, objectFit: 'contain', display: 'block' }}
          />
        </div>
      )
    }
    return (
      <img
        src={assetPath}
        width={s}
        height={s}
        alt={type}
        className={className}
        style={{ display: 'block', flexShrink: 0, objectFit: 'contain' }}
      />
    )
  }

  // KIM — 쫄보: pale, wide tearful eyes, trembling mouth, sweat drops
  if (type === 'kim') {
    return (
      <svg {...commonProps}>
        <Base fill="#7ea378" stroke="#2d4426" />
        {/* Eye whites — huge */}
        <ellipse cx="37" cy="42" rx="11" ry="12" fill="#f5f2e8" stroke="#2d4426" strokeWidth="2" />
        <ellipse cx="63" cy="42" rx="11" ry="12" fill="#f5f2e8" stroke="#2d4426" strokeWidth="2" />
        {/* Pupils — small, looking up-right (anxious) */}
        <circle cx="39" cy="40" r="2.8" fill="#1a1a1a" />
        <circle cx="65" cy="40" r="2.8" fill="#1a1a1a" />
        {/* Tear */}
        <path d="M29 52 Q27 58 30 61 Q33 58 31 52 Z" fill="#6cb8ff" stroke="#2b5d94" strokeWidth="1" />
        {/* Wavy worried mouth */}
        <path d="M36 68 Q42 64 46 68 Q50 72 54 68 Q58 64 64 68" fill="none" stroke="#2d4426" strokeWidth="2.5" strokeLinecap="round" />
        {/* Sweat */}
        <path d="M22 20 Q21 26 24 28 Q27 26 26 20 Z" fill="#6cb8ff" stroke="#2b5d94" strokeWidth="1" />
      </svg>
    )
  }

  // GHOST — 유령: cyan-tinted, translucent, slit eyes
  if (type === 'ghost') {
    return (
      <svg {...commonProps}>
        {/* Wavy ghost bottom instead of chin */}
        <path
          d="M18 45 C18 22 34 10 50 10 C67 10 82 22 82 45 L82 80 L74 86 L68 80 L60 86 L52 80 L44 86 L36 80 L28 86 L22 80 L18 80 Z"
          fill="#8eb8b0" stroke="#2d5552" strokeWidth="2.5" strokeLinejoin="round" opacity="0.92"
        />
        {/* Slit eyes */}
        <rect x="32" y="38" width="3" height="14" rx="1.5" fill="#1a1a1a" />
        <rect x="65" y="38" width="3" height="14" rx="1.5" fill="#1a1a1a" />
        {/* Flat mouth */}
        <line x1="42" y1="65" x2="58" y2="65" stroke="#2d5552" strokeWidth="2.5" strokeLinecap="round" />
        {/* Subtle glow dots */}
        <circle cx="30" cy="25" r="1.5" fill="#e8f4f2" opacity="0.6" />
        <circle cx="72" cy="28" r="1" fill="#e8f4f2" opacity="0.6" />
      </svg>
    )
  }

  // QUANT — 냉정: glasses, flat mouth, stoic
  if (type === 'quant') {
    return (
      <svg {...commonProps}>
        <Base fill="#5a8450" stroke="#243d1e" />
        {/* Eye whites */}
        <circle cx="37" cy="42" r="8" fill="#f5f2e8" stroke="#243d1e" strokeWidth="2" />
        <circle cx="63" cy="42" r="8" fill="#f5f2e8" stroke="#243d1e" strokeWidth="2" />
        {/* Pupils */}
        <circle cx="37" cy="43" r="3" fill="#1a1a1a" />
        <circle cx="63" cy="43" r="3" fill="#1a1a1a" />
        {/* Glasses rectangle frames */}
        <rect x="26" y="34" width="22" height="16" rx="1" fill="none" stroke="#0a0a0a" strokeWidth="2.5" />
        <rect x="52" y="34" width="22" height="16" rx="1" fill="none" stroke="#0a0a0a" strokeWidth="2.5" />
        <line x1="48" y1="42" x2="52" y2="42" stroke="#0a0a0a" strokeWidth="2.5" />
        {/* Glasses glint */}
        <line x1="29" y1="36" x2="35" y2="36" stroke="#f5f2e8" strokeWidth="1.5" opacity="0.6" />
        <line x1="55" y1="36" x2="61" y2="36" stroke="#f5f2e8" strokeWidth="1.5" opacity="0.6" />
        {/* Flat line mouth */}
        <line x1="40" y1="68" x2="60" y2="68" stroke="#243d1e" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    )
  }

  // YOLO — 광기: manic, tongue out, red cheeks, $$$ eyes
  if (type === 'yolo') {
    return (
      <svg {...commonProps}>
        <Base fill="#6a9858" stroke="#1f3617" />
        {/* Eye whites */}
        <circle cx="37" cy="42" r="10" fill="#f5f2e8" stroke="#1f3617" strokeWidth="2" />
        <circle cx="63" cy="42" r="10" fill="#f5f2e8" stroke="#1f3617" strokeWidth="2" />
        {/* $$ inside eyes */}
        <text x="37" y="47" textAnchor="middle" fontSize="13" fontWeight="900" fontFamily="Archivo Black, sans-serif" fill="#1a1a1a">$</text>
        <text x="63" y="47" textAnchor="middle" fontSize="13" fontWeight="900" fontFamily="Archivo Black, sans-serif" fill="#1a1a1a">$</text>
        {/* Red blush cheeks */}
        <ellipse cx="22" cy="58" rx="6" ry="3" fill="#ef3b2c" opacity="0.55" />
        <ellipse cx="78" cy="58" rx="6" ry="3" fill="#ef3b2c" opacity="0.55" />
        {/* Wide open mouth with tongue */}
        <path d="M34 65 Q50 82 66 65 L62 72 Q50 80 38 72 Z" fill="#1a1a1a" stroke="#1f3617" strokeWidth="2" strokeLinejoin="round" />
        <path d="M40 73 Q50 80 60 73 Q58 77 50 78 Q42 77 40 73 Z" fill="#e85a5a" />
      </svg>
    )
  }

  // DEX — 도파민: fire crown, wide excited eyes, O mouth
  if (type === 'dex') {
    return (
      <svg {...commonProps}>
        {/* Flames above head */}
        <path d="M30 12 Q32 2 36 8 Q38 2 40 10 Q44 0 46 12 Z" fill="#f2c14e" stroke="#b37f12" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M44 8 Q46 -2 50 6 Q52 -2 55 6 Q58 -4 60 10 Z" fill="#ef3b2c" stroke="#7a1a14" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M58 10 Q60 0 64 6 Q66 0 68 10 Q70 4 72 14 Z" fill="#f2c14e" stroke="#b37f12" strokeWidth="1.5" strokeLinejoin="round" />
        <Base fill="#648f4e" stroke="#1f3617" />
        {/* Big eyes, star glints */}
        <circle cx="37" cy="42" r="10" fill="#f5f2e8" stroke="#1f3617" strokeWidth="2" />
        <circle cx="63" cy="42" r="10" fill="#f5f2e8" stroke="#1f3617" strokeWidth="2" />
        <circle cx="38" cy="43" r="4.5" fill="#1a1a1a" />
        <circle cx="64" cy="43" r="4.5" fill="#1a1a1a" />
        <circle cx="36" cy="41" r="1.5" fill="#f5f2e8" />
        <circle cx="62" cy="41" r="1.5" fill="#f5f2e8" />
        {/* O mouth */}
        <ellipse cx="50" cy="70" rx="5" ry="6" fill="#1a1a1a" stroke="#1f3617" strokeWidth="2" />
      </svg>
    )
  }

  return null
}
