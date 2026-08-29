import { useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DashboardChartSlice } from '../../types/platform'
import { resolveSliceLabel } from '../../utils/chartSliceLabel'
import { isSearchQueryActive } from '../../utils/requestSearch'

const COLOR_MAP: Record<string, string> = {
  primary: 'var(--color-primary)',
  success: '#22c55e',
  warning: '#eab308', // "Bekleyen" sarı — turuncudan (#f97316) ayrışsın (card 760)
  danger: '#ef4444',
  info: '#06b6d4',
  neutral: '#94a3b8',
  orange: '#f97316',
  violet: '#8b5cf6',
  rose: '#f43f5e',
}

function getColor(hint: string): string {
  return COLOR_MAP[hint] ?? COLOR_MAP.info
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
  /**
   * Parent başlık satırındaki Ara... değeri; dilim/lejant filtreler (R550).
   * Arama kutusu PieChart içinde değil — üst satır hizası + odak kaybı önlemi.
   */
  legendSearch?: string
  /** Sağlanırsa lejant metinleri tıklanabilir olur; tıklanan dilim ile çağrılır (card 759). */
  onSelect?: (slice: DashboardChartSlice) => void
  /** Dilim bazında tıklanabilirlik; false dönen dilim/lejant düz metin kalır (card #1337). */
  isSliceSelectable?: (slice: DashboardChartSlice) => boolean
  /** Opsiyonel etiket override; undefined → varsayılan resolveSliceLabel (#r542 / #15). */
  formatSliceLabel?: (rawLabel: string, t: ReturnType<typeof useTranslation>['t']) => string | undefined
}

function useResolvedLabel(
  rawLabel: string,
  formatSliceLabel?: PieChartProps['formatSliceLabel'],
): string {
  const { t } = useTranslation()
  const override = formatSliceLabel?.(rawLabel, t)
  if (override != null) return override
  return resolveSliceLabel(rawLabel, t)
}

function LegendItem({
  slice,
  onSelect,
  formatSliceLabel,
}: {
  slice: DashboardChartSlice
  onSelect?: (slice: DashboardChartSlice) => void
  formatSliceLabel?: PieChartProps['formatSliceLabel']
}) {
  const label = useResolvedLabel(slice.label, formatSliceLabel)
  const content = (
    <>
      <span className="shrink-0 size-2.5 rounded-full" style={{ backgroundColor: getColor(slice.colorHint) }} />
      <span className="min-w-0 truncate text-slate-700">{label}</span>
      <span className="ml-auto pl-3 font-semibold text-slate-950 tabular-nums">{slice.value}</span>
    </>
  )
  if (onSelect) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onSelect(slice)}
          className="flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-1 py-0.5 text-left text-sm transition-colors hover:bg-slate-50 hover:text-[color:var(--color-primary)]"
        >
          {content}
        </button>
      </li>
    )
  }
  return (
    <li className="flex items-center gap-2.5 px-1 py-0.5 text-sm">
      {content}
    </li>
  )
}

/** Banner ile aynı Ara... kutusu; pie başlık satırı / lejant için (R549/R550). */
export function PieLegendSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="scope-chip-search-wrap pie-legend-search shrink-0">
      <Search className="scope-chip-search-icon size-3 shrink-0 text-slate-400" aria-hidden="true" />
      <input
        type="text"
        className="scope-chip-search-input"
        placeholder={t('common.search', 'Ara...')}
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-label={t('common.search', 'Ara...')}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="scope-chip-search-clear shrink-0 font-extrabold text-red-600 transition-colors hover:text-red-700"
          aria-label={t('common.clear', 'Temizle')}
        >
          <X className="size-3.5" strokeWidth={3} />
        </button>
      ) : null}
    </div>
  )
}

export function PieChart({
  slices,
  noDataLabel = 'Veri yok',
  showZeroSlices = false,
  legendSearch = '',
  onSelect,
  isSliceSelectable,
  formatSliceLabel,
}: PieChartProps) {
  const { t } = useTranslation()

  const visibleSlices = useMemo(() => {
    if (!isSearchQueryActive(legendSearch)) return slices
    const query = legendSearch.trim().toLocaleLowerCase('tr')
    return slices.filter(slice => {
      const label = (formatSliceLabel?.(slice.label, t) ?? resolveSliceLabel(slice.label, t))
        .toLocaleLowerCase('tr')
      return label.includes(query)
    })
  }, [slices, legendSearch, formatSliceLabel, t])

  const nonZero = visibleSlices.filter(s => s.value > 0)
  const shouldShowZeroChart = showZeroSlices && visibleSlices.length > 0
  const legendSlices = showZeroSlices ? visibleSlices : nonZero
  const showEmpty = nonZero.length === 0 && !shouldShowZeroChart

  const cx = 80
  const cy = 80
  const outerR = 68
  const innerR = 42
  const size = 160
  const total = nonZero.reduce((sum, s) => sum + s.value, 0)

  const segments: { path: string; color: string; slice: DashboardChartSlice }[] = []

  if (!showEmpty) {
    if (nonZero.length === 0) {
      segments.push({
        path: buildArcPath(cx, cy, outerR, innerR, 0, 359.99),
        color: '#e2e8f0',
        slice: visibleSlices[0],
      })
    } else if (nonZero.length === 1) {
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
  }

  return (
    <div className="pie-chart-root relative flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
      {showEmpty ? (
        <div className="flex min-h-40 w-full items-center justify-center py-10 text-sm text-[color:var(--color-muted-foreground)]">
          {isSearchQueryActive(legendSearch)
            ? t('dashboard.chart.noSearchMatch', 'Eşleşen dilim yok.')
            : noDataLabel}
        </div>
      ) : (
        <>
          {/* SVG boş alanı komşu kartların lejantına binmesin diye pointer-events kapalı; yalnızca dilimler tıklanır. */}
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pointer-events-none shrink-0">
            {segments.map((seg, i) => {
              const canSelectSegment = Boolean(onSelect && seg.slice.value > 0 && (isSliceSelectable?.(seg.slice) ?? true))
              return (
              <path
                key={i}
                d={seg.path}
                fill={seg.color}
                stroke="white"
                strokeWidth="1.5"
                className={canSelectSegment ? 'pointer-events-auto cursor-pointer transition-opacity hover:opacity-90' : undefined}
                onClick={canSelectSegment ? () => onSelect?.(seg.slice) : undefined}
                onKeyDown={canSelectSegment ? event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect?.(seg.slice)
                  }
                } : undefined}
                role={canSelectSegment ? 'button' : undefined}
                tabIndex={canSelectSegment ? 0 : undefined}
                aria-label={canSelectSegment
                  ? (formatSliceLabel?.(seg.slice.label, t) ?? resolveSliceLabel(seg.slice.label, t))
                  : undefined}
              />
              )
            })}
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#0f172a">
              {Number.isInteger(total) ? total : (Math.round(total * 10) / 10)}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#64748b">
              toplam
            </text>
          </svg>

          {/* Lejant: 6 satırdan fazla → scroll; 6 ve altı (ör. 5) → scroll yok (card #1704). */}
          <ul className={`relative z-10 flex min-w-0 w-full flex-col gap-2 ${legendSlices.length > 6 ? 'max-h-40 overflow-y-auto pr-1 [scrollbar-gutter:stable]' : ''}`}>
            {legendSlices.map(slice => (
              <LegendItem
                key={slice.label}
                slice={slice}
                formatSliceLabel={formatSliceLabel}
                onSelect={(isSliceSelectable?.(slice) ?? true) ? onSelect : undefined}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
