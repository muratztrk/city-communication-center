/** Grid boş değer em-dash — transparan (card #1894). */
export function EmptyCell({ value, fallback = '—' }: { value?: string | null; fallback?: string }) {
  const trimmed = value?.trim()
  if (trimmed) return <>{trimmed}</>
  return <span className="empty-cell-dash">{fallback}</span>
}
