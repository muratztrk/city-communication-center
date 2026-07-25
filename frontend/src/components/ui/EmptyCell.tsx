/** Grid boş değer em-dash — talep no stili, transparan değil (card #1894 reopen). */
export function EmptyCell({ value, fallback = '—' }: { value?: string | null; fallback?: string }) {
  const trimmed = value?.trim()
  if (trimmed) return <>{trimmed}</>
  return <span className="empty-cell-dash font-mono text-xs text-slate-500">{fallback}</span>
}
