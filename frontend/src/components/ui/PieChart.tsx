import { useTranslation } from 'react-i18next'
import type { DashboardChartSlice } from '../../types/platform'

const COLOR_MAP: Record<string, string> = {
  primary: 'var(--color-primary)',
  success: '#22c55e',
  warning: '#eab308', // "Bekleyen" sarı — turuncudan (#f97316) ayrışsın (card 760)
  danger: '#ef4444',
  info: '#06b6d4',
  neutral: '#94a3b8',
  orange: '#f97316',
}

function getColor(hint: string): string {
  return COLOR_MAP[hint] ?? COLOR_MAP.primary
}

interface ArcPoint {
  x: number
  y: number
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): ArcPoint {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function buildArcPath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, endDeg: number): string {
  const o1 = polarToCartesian(cx, cy, outerR, startDeg)
  const o2 = polarToCartesian(cx, cy, outerR, endDeg)
  const i1 = polarToCartesian(cx, cy, innerR, endDeg)
  const i2 = polarToCartesian(cx, cy, innerR, startDeg)
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ')
}

interface PieChartProps {
  slices: DashboardChartSlice[]
  noDataLabel?: string
  showZeroSlices?: boolean
  /** Sağlanırsa lejant metinleri tıklanabilir olur ve tıklanınca bu çağrılır (card 759). */
  onSelect?: () => void
}

/** Resolve a label — may be a plain i18n key, a "prefix – i18n.key" compound, or a literal name. */
const TRANSLATABLE_PREFIXES = ['dashboard.', 'channel.', 'sourceType.']

function isTranslatableKey(key: string): boolean {
  return TRANSLATABLE_PREFIXES.some(prefix => key.startsWith(prefix))
}

function useResolvedLabel(rawLabel: string): string {
  const { t } = useTranslation()
  const SEP = ' – '
  const translateLabel = (key: string) => {
    if (!isTranslatableKey(key)) return key

    // Dashboard API'si kanal ve kaynak türü etiketlerini "channel.X" / "sourceType.X"
    // olarak gönderir; bunlar yerelleştirme dosyalarında dashboard altında tutulur.
    const translationKey = key.startsWith('channel.') || key.startsWith('sourceType.')
      ? `dashboard.${key}`
      : key
    return t(translationKey)
  }
  const sepIdx = rawLabel.indexOf(SEP)
  if (sepIdx !== -1) {
    const prefix = rawLabel.slice(0, sepIdx)
    const key = rawLabel.slice(sepIdx + SEP.length)
    const suffix = translateLabel(key)
    return `${prefix} (${suffix})`
  }
  return translateLabel(rawLabel)
}

function LegendItem({ slice, onSelect }: { slice: DashboardChartSlice; onSelect?: () => void }) {
  const label = useResolvedLabel(slice.label)
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span className="shrink-0 size-2.5 rounded-full" style={{ backgroundColor: getColor(slice.colorHint) }} />
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 cursor-pointer truncate text-left text-slate-700 transition-colors hover:text-[color:var(--color-primary)] hover:underline"
        >
          {label}
        </button>
      ) : (
        <span className="min-w-0 truncate text-slate-700">{label}</span>
      )}
      <span className="ml-auto pl-3 font-semibold text-slate-950 tabular-nums">{slice.value}</span>
    </li>
  )
}

export function PieChart({ slices, noDataLabel = 'Veri yok', showZeroSlices = false, onSelect }: PieChartProps) {
  const nonZero = slices.filter(s => s.value > 0)

  if (nonZero.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-[color:var(--color-muted-foreground)]">
        {noDataLabel}
      </div>
    )
  }

  const cx = 80
  const cy = 80
  const outerR = 68
  const innerR = 42
  const size = 160
  const total = nonZero.reduce((sum, s) => sum + s.value, 0)

  const segments: { path: string; color: string; slice: DashboardChartSlice }[] = []

  if (nonZero.length === 1) {
    const color = getColor(nonZero[0].colorHint)
    const p1 = polarToCartesian(cx, cy, outerR, 0)
    const p2 = polarToCartesian(cx, cy, outerR, 180)
    const i1 = polarToCartesian(cx, cy, innerR, 180)
    const i2 = polarToCartesian(cx, cy, innerR, 0)
    const path = [
      `M ${p1.x} ${p1.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${p2.x} ${p2.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${p1.x} ${p1.y}`,
      `L ${i2.x} ${i2.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${i1.x} ${i1.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${i2.x} ${i2.y}`,
      'Z',
    ].join(' ')
    segments.push({ path, color, slice: nonZero[0] })
  } else {
    let currentDeg = 0
    for (const slice of nonZero) {
      const sweep = (slice.value / total) * 360
      const endDeg = currentDeg + sweep
      segments.push({
        path: buildArcPath(cx, cy, outerR, innerR, currentDeg, endDeg),
        color: getColor(slice.colorHint),
        slice,
      })
      currentDeg = endDeg
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {segments.map((seg, i) => (
          <path key={i} d={seg.path} fill={seg.color} stroke="white" strokeWidth="1.5" />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">
          {total}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#64748b">
          toplam
        </text>
      </svg>

      <ul className="flex flex-col gap-2 min-w-0 w-full">
        {(showZeroSlices ? slices : nonZero).map(slice => (
          <LegendItem key={slice.label} slice={slice} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  )
}
