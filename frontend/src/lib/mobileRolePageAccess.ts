import type { RoleCode } from './rolePageAccess'
import type { LicenseModuleKey } from '../types/platform'

/**
 * Tim mobil uygulaması sayfa/rol matrisi (#6aaf7d54). Web matrisinden (`rolePageAccess.ts`)
 * bağımsızdır: mobil alt menü sayfaları web rotalarıyla birebir eşleşmez ve mobil uygulama
 * bu matrisi `/auth/profile` yanıtındaki `mobileRolePageAccessJson` alanından okur.
 */
export const MOBILE_PAGE_ACCESS_ITEMS = [
  { key: 'citizenHome', module: 'citizen', labelKey: 'nav.dashboard', fallback: 'Anasayfa' },
  { key: 'citizenDepartments', module: 'citizen', labelKey: 'nav.departments', fallback: 'Birimler' },
  { key: 'citizenMap', module: 'citizen', labelKey: 'settings.roles.mobilePageMap', fallback: 'Harita' },
  { key: 'citizenCitizens', module: 'citizen', labelKey: 'settings.roles.mobilePageCitizens', fallback: 'Vatandaşlar' },
  { key: 'citizenSettings', module: 'citizen', labelKey: 'nav.settings', fallback: 'Ayarlar' },
  { key: 'internalHome', module: 'internal', labelKey: 'nav.dashboard', fallback: 'Anasayfa' },
  { key: 'internalDepartment', module: 'internal', labelKey: 'settings.roles.mobilePageDepartment', fallback: 'Birim' },
  { key: 'internalMap', module: 'internal', labelKey: 'settings.roles.mobilePageMap', fallback: 'Harita' },
  { key: 'internalCitizens', module: 'internal', labelKey: 'settings.roles.mobilePageCitizens', fallback: 'Vatandaşlar' },
  { key: 'internalSettings', module: 'internal', labelKey: 'nav.settings', fallback: 'Ayarlar' },
] as const satisfies readonly { key: string; module: LicenseModuleKey; labelKey: string; fallback: string }[]

export type MobilePageAccessKey = typeof MOBILE_PAGE_ACCESS_ITEMS[number]['key']

/** Mobil matriste sütunu olan roller; bölüm bazlı alt kümeler aşağıda. */
export const MOBILE_ROLE_CODES = ['SystemAdmin', 'Manager', 'Reporter'] as const satisfies readonly RoleCode[]

export type MobileRoleCode = typeof MOBILE_ROLE_CODES[number]

export const MOBILE_CITIZEN_TRACKING_ROLES = ['SystemAdmin', 'Reporter'] as const satisfies readonly MobileRoleCode[]
export const MOBILE_INTERNAL_TRACKING_ROLES = ['SystemAdmin', 'Manager'] as const satisfies readonly MobileRoleCode[]

export type MobileRolePageAccessMatrix = Record<MobileRoleCode, Record<MobilePageAccessKey, boolean>>

export function mobilePagesForModule(module: LicenseModuleKey): readonly typeof MOBILE_PAGE_ACCESS_ITEMS[number][] {
  return MOBILE_PAGE_ACCESS_ITEMS.filter(page => page.module === module)
}

export function mobileRolesForModule(module: LicenseModuleKey): readonly MobileRoleCode[] {
  return module === 'citizen' ? MOBILE_CITIZEN_TRACKING_ROLES : MOBILE_INTERNAL_TRACKING_ROLES
}

/**
 * Matris yalnız gridde gösterilen rol/sayfa çiftlerini taşır: Manager vatandaş takibi
 * bölümünde, Reporter kurum içi bölümünde sütun almaz. Kapsam dışı çift `true` kaydedilirse
 * mobil uygulama yöneticinin hiç görmediği bir yetkiyi açardı (#6aaf7d54).
 */
export function isMobilePagePairInScope(role: MobileRoleCode, pageKey: MobilePageAccessKey): boolean {
  const page = MOBILE_PAGE_ACCESS_ITEMS.find(item => item.key === pageKey)
  if (!page) return false
  return mobileRolesForModule(page.module).includes(role)
}

/** Kayıt yokken kapsam içi tüm sayfalar açık — read-only sürümdeki "Aktif" matrisiyle aynı davranış. */
export const DEFAULT_MOBILE_ROLE_PAGE_ACCESS: MobileRolePageAccessMatrix = MOBILE_ROLE_CODES.reduce((matrix, role) => {
  matrix[role] = MOBILE_PAGE_ACCESS_ITEMS.reduce((pages, page) => {
    pages[page.key] = isMobilePagePairInScope(role, page.key)
    return pages
  }, {} as Record<MobilePageAccessKey, boolean>)
  return matrix
}, {} as MobileRolePageAccessMatrix)

export function normalizeMobileRolePageAccessMatrix(input: unknown): MobileRolePageAccessMatrix {
  const source = input && typeof input === 'object' ? input as Partial<MobileRolePageAccessMatrix> : {}
  return MOBILE_ROLE_CODES.reduce((matrix, role) => {
    matrix[role] = MOBILE_PAGE_ACCESS_ITEMS.reduce((pages, page) => {
      if (!isMobilePagePairInScope(role, page.key)) {
        pages[page.key] = false
        return pages
      }
      const configured = source[role]?.[page.key]
      pages[page.key] = typeof configured === 'boolean'
        ? configured
        : DEFAULT_MOBILE_ROLE_PAGE_ACCESS[role][page.key]
      return pages
    }, {} as Record<MobilePageAccessKey, boolean>)
    return matrix
  }, {} as MobileRolePageAccessMatrix)
}

export function createDefaultMobileRolePageAccessMatrix(): MobileRolePageAccessMatrix {
  return normalizeMobileRolePageAccessMatrix(DEFAULT_MOBILE_ROLE_PAGE_ACCESS)
}

export function parseMobileRolePageAccessMatrix(value: string | null | undefined): MobileRolePageAccessMatrix | null {
  if (!value) return null
  try {
    return normalizeMobileRolePageAccessMatrix(JSON.parse(value))
  } catch {
    return null
  }
}

export function serializeMobileRolePageAccessMatrix(matrix: MobileRolePageAccessMatrix): string {
  return JSON.stringify(normalizeMobileRolePageAccessMatrix(matrix))
}
