export const ADDRESS_STREET_MAX_LENGTH = 50
export const ADDRESS_STREET_NO_MAX_LENGTH = 6
export const ADDRESS_OPEN_ADDRESS_MAX_LENGTH = 100
/** Cadde üzerinde kapı yok (yol, park, saha) — CBS No listesine eklenir (#2714). */
export const STREET_NO_NONE = 'Yok'

export function isAbsentStreetNo(value: string | null | undefined): boolean {
  return value?.trim().toLocaleLowerCase('tr') === STREET_NO_NONE.toLocaleLowerCase('tr')
}

/** No alanı: yazılan her karakter büyük harf (#2585). */
export function normalizeStreetNo(value: string): string {
  return value.toLocaleUpperCase('tr')
}
