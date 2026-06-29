/** Banner araması: grid sütun metinlerinde contains eşleşmesi (Türkçe locale + tire/boşluk toleransı). */
export function matchesBannerSearch(query: string, values: string[]): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true

  const qLower = trimmed.toLocaleLowerCase('tr')
  const qCompact = qLower.replace(/[\s\-./]/g, '')

  return values.some(value => {
    if (!value) return false
    const lower = value.toLocaleLowerCase('tr')
    if (lower.includes(qLower)) return true
    if (qCompact.length < 2) return false
    return lower.replace(/[\s\-./]/g, '').includes(qCompact)
  })
}
