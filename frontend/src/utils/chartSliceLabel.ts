import type { TFunction } from 'i18next'

/** Resolve a chart slice label — plain i18n key, "prefix – i18n.key" compound, "GUID|name" pair, or literal name. */
const TRANSLATABLE_PREFIXES = ['dashboard.', 'channel.', 'sourceType.']
const STAFF_SLICE_USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\|/i

function isTranslatableKey(key: string): boolean {
  return TRANSLATABLE_PREFIXES.some(prefix => key.startsWith(prefix))
}

export function resolveSliceLabel(rawLabel: string, t: TFunction): string {
  const staffPipeIdx = rawLabel.indexOf('|')
  if (staffPipeIdx > 0 && STAFF_SLICE_USER_ID.test(rawLabel)) {
    return rawLabel.slice(staffPipeIdx + 1)
  }
  const SEP = ' – '
  const translateLabel = (key: string) => {
    if (!isTranslatableKey(key)) return key
    const translationKey = key.startsWith('channel.') || key.startsWith('sourceType.')
      ? `dashboard.${key}`
      : key
    return t(translationKey)
  }
  const sepIdx = rawLabel.indexOf(SEP)
  if (sepIdx !== -1) {
    const prefix = rawLabel.slice(0, sepIdx)
    const key = rawLabel.slice(sepIdx + SEP.length)
    return `${prefix} (${translateLabel(key)})`
  }
  return translateLabel(rawLabel)
}
