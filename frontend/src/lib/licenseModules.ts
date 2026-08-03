import type { LicenseModuleKey, LicenseModuleStatus } from '../types/platform'

/**
 * `rolePageAccess.ts`'teki rol-yetki matrisiyle aynı desen: sunucudan çekilen lisans modül
 * durumu login sonrası buraya senkronlanır, senkron okuyucular (canAnyRoleAccessPage gibi
 * React dışı saf fonksiyonlar) buradan okur. Bkz. LicenseModuleContext.tsx.
 */
const LICENSE_MODULES_STORAGE_KEY = 'ccc_license_modules'

/** AppShell'in rol-yetki matrisi için zaten dinlediği ROLE_PAGE_ACCESS_EVENT'e eklenir (bkz. AppShell.tsx). */
export const LICENSE_MODULES_EVENT = 'ccc-license-modules-updated'

export function saveLicenseModules(modules: LicenseModuleStatus[]) {
  try {
    window.localStorage.setItem(LICENSE_MODULES_STORAGE_KEY, JSON.stringify(modules))
  } catch {
    // yok say
  }
  window.dispatchEvent(new CustomEvent(LICENSE_MODULES_EVENT))
}

export function clearLicenseModules() {
  try {
    window.localStorage.removeItem(LICENSE_MODULES_STORAGE_KEY)
  } catch {
    // yok say
  }
  window.dispatchEvent(new CustomEvent(LICENSE_MODULES_EVENT))
}

export function loadLicenseModules(): LicenseModuleStatus[] {
  try {
    const raw = window.localStorage.getItem(LICENSE_MODULES_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LicenseModuleStatus[]) : []
  } catch {
    return []
  }
}

/** Durum henüz yüklenmediyse ya da modül bulunamadıysa fail-open: kullanılabilir sayılır. */
export function isModuleUsable(module: LicenseModuleKey): boolean {
  const entry = loadLicenseModules().find(item => item.module === module)
  return entry?.usable ?? true
}
