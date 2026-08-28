import type { CitizenDashboardMapPin, DashboardChartDrilldownRow } from '../types/platform'

function normalizeSearch(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('tr')
}

function phoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** Harita / dizin araması 3 karakterden önce filtrelemez (#3103). */
export const SEARCH_MIN_CHARS = 3

export function isSearchQueryActive(query: string): boolean {
  const compact = normalizeSearch(query).replace(/[^\p{L}\p{N}]+/gu, '')
  return compact.length >= SEARCH_MIN_CHARS
}

function haystackIncludes(query: string, ...parts: Array<string | null | undefined>): boolean {
  if (!isSearchQueryActive(query)) return true
  const q = normalizeSearch(query)
  const qDigits = phoneDigits(q)
  if (parts.some(part => normalizeSearch(part).includes(q))) return true
  if (qDigits.length >= 3) {
    return parts.some(part => phoneDigits(part).includes(qDigits))
  }
  return false
}

/** Vatandaş haritası / paneli: ad soyad, telefon, mahalle. */
export function pinMatchesCitizenSearch(pin: CitizenDashboardMapPin, query: string): boolean {
  return haystackIncludes(query, pin.citizenName, pin.citizenPhone, pin.neighborhood, pin.openAddress, pin.title)
}

/** Birim haritası: birim adı. */
export function pinMatchesDepartmentSearch(pin: CitizenDashboardMapPin, query: string): boolean {
  return haystackIncludes(
    query,
    pin.departmentName,
    pin.ownerDepartmentName,
    pin.destinationDepartmentName,
    pin.title,
  )
}

export function pinMatchesMapSearch(
  pin: CitizenDashboardMapPin,
  query: string,
  variant: 'citizen' | 'department',
): boolean {
  return variant === 'department'
    ? pinMatchesDepartmentSearch(pin, query)
    : pinMatchesCitizenSearch(pin, query)
}

export function drilldownRowMatchesCitizenSearch(row: DashboardChartDrilldownRow, query: string): boolean {
  return haystackIncludes(
    query,
    row.citizenName,
    row.citizenPhone,
    row.neighborhood,
    row.departmentName,
    row.title,
  )
}
