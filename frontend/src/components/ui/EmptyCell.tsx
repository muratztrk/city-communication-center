/** Grid boş değer em-dash — gri (#r480 / card #1894). */
export function EmptyCell({ value, fallback = '—' }: { value?: string | null; fallback?: string }) {
  const trimmed = value?.trim()
  if (trimmed) return <>{trimmed}</>
  return <span className="empty-cell-dash font-mono text-xs text-slate-400">{fallback}</span>
}
