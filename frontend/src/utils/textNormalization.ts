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

/** Yalnızca ilk harfi TR büyük yapar (#6a6f496e); zaten büyükse değişmez. */
export function ensureLeadingCapitalTr(value: string | null | undefined): string {
  if (value == null || value.length === 0) return value ?? ''
  return value.replace(/\p{L}/u, letter => letter.toLocaleUpperCase('tr'))
}

/** Rich-text HTML içinde ilk görünen harfi büyük yapar (#6a6f496e). */
export function ensureLeadingCapitalRichText(html: string | null | undefined): string {
  if (!html) return html ?? ''
  let done = false
  return html.replace(/>([^<]+)/g, (match, text: string) => {
    if (done || !/\p{L}/u.test(text)) return match
    done = true
    return `>${text.replace(/\p{L}/u, letter => letter.toLocaleUpperCase('tr'))}`
  })
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
