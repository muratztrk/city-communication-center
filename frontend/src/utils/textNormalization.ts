export function toTitleCaseTr(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/(^|[\s/('-])(\p{L})/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase('tr')}`)
}

export function normalizeTitleCaseField(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? toTitleCaseTr(trimmed) : null
}

/** Türkçe diyakritikleri ASCII'ye katlayıp küçük harfe çevirir (Sistemde ara / Personel ara — cards #1791/#1794). */
export function foldTurkishForSearch(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .toLocaleLowerCase('tr')
}

export function includesFoldedTr(haystack: string | null | undefined, needle: string): boolean {
  if (!needle) return true
  if (!haystack) return false
  return foldTurkishForSearch(haystack).includes(foldTurkishForSearch(needle))
}
