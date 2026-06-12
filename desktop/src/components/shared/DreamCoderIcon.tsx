import { useId } from 'react'

export function DreamCoderIcon({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')

  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0 }}
      role="img"
      aria-label="DreamCoder"
    >
      <defs>
        <linearGradient id={`${id}-dc-bg`} x1="112" y1="80" x2="912" y2="944" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fffbef" />
          <stop offset="0.48" stopColor="#f4fbf3" />
          <stop offset="1" stopColor="#e5f4f0" />
        </linearGradient>
        <linearGradient id={`${id}-dc-mark`} x1="248" y1="224" x2="740" y2="804" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1d322b" />
          <stop offset="1" stopColor="#335d50" />
        </linearGradient>
        <linearGradient id={`${id}-dc-code`} x1="400" y1="360" x2="640" y2="644" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00a6a6" />
          <stop offset="1" stopColor="#16b973" />
        </linearGradient>
        <linearGradient id={`${id}-dc-gold`} x1="620" y1="260" x2="730" y2="686" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffe07a" />
          <stop offset="1" stopColor="#f28a3d" />
        </linearGradient>
        <filter id={`${id}-dc-shadow`} x="8%" y="8%" width="84%" height="88%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="24" stdDeviation="28" floodColor="#10241e" floodOpacity="0.16" />
        </filter>
      </defs>

      <rect width="1024" height="1024" rx="220" fill={`url(#${id}-dc-bg)`} />
      <rect x="28" y="28" width="968" height="968" rx="198" fill="none" stroke="#1d322b" strokeWidth="8" strokeOpacity="0.08" />

      <g filter={`url(#${id}-dc-shadow)`}>
        <path d="M335 248v528" fill="none" stroke={`url(#${id}-dc-mark)`} strokeWidth="82" strokeLinecap="round" />
        <path
          d="M335 248c244 0 394 102 394 264S579 776 335 776"
          fill="none"
          stroke={`url(#${id}-dc-mark)`}
          strokeWidth="82"
          strokeLinecap="round"
        />

        <path
          d="M444 386 572 512 444 638"
          fill="none"
          stroke={`url(#${id}-dc-code)`}
          strokeWidth="70"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M604 656h112" fill="none" stroke={`url(#${id}-dc-gold)`} strokeWidth="58" strokeLinecap="round" />

        <path d="M703 292c8 36 28 56 64 64-36 8-56 28-64 64-8-36-28-56-64-64 36-8 56-28 64-64z" fill={`url(#${id}-dc-gold)`} />
        <circle cx="258" cy="284" r="18" fill="#00a6a6" opacity="0.28" />
        <circle cx="765" cy="724" r="20" fill="#f2a541" opacity="0.34" />
      </g>
    </svg>
  )
}
