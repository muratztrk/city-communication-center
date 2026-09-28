/** Bekleyen ek süre işareti: isim parantez içinde ifadenin sağında (#3892). */
export function formatExtraTimePendingMarker(label: string, requesterDisplayName?: string | null): string {
  const name = requesterDisplayName?.trim()
  if (!name) {
    return label
  }

  if (label.endsWith(')')) {
    return `${label.slice(0, -1)} ${name})`
  }

  return `(${label} ${name})`
}
