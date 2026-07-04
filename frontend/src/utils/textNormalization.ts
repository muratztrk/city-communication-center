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
