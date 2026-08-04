import { isModuleUsable } from './licenseModules'
import type { LicenseModuleKey } from '../types/platform'

export const ROLE_CODES = ['SystemAdmin', 'Manager', 'CitizenRequestManager', 'Operator', 'Staff', 'Reporter', 'EDevletActivityPlan'] as const

export type RoleCode = typeof ROLE_CODES[number]

export const PAGE_ACCESS_ITEMS = [
  { key: 'dashboard', path: '/dashboard', labelKey: 'nav.dashboard' },
  { key: 'createRequest', path: '/requests/new', labelKey: 'nav.createRequest' },
  { key: 'createRoutineTask', path: '/routine-tasks/new', labelKey: 'nav.createRoutineTask' },
  { key: 'myTasks', path: '/my-tasks', labelKey: 'nav.myTasks' },
  { key: 'departmentTasks', path: '/department-tasks', labelKey: 'nav.departmentTasks' },
  { key: 'myRequests', path: '/my-requests', labelKey: 'nav.myRequests' },
  { key: 'incomingRequests', path: '/incoming-requests', labelKey: 'nav.incomingRequests' },
  { key: 'outgoingRequests', path: '/outgoing-requests', labelKey: 'nav.outgoingRequests' },
  { key: 'citizenMessageApproval', path: '/citizen-message-approval', labelKey: 'nav.citizenMessageApproval' },
  { key: 'smsDeliveryApproval', path: '/sms-delivery-approval', labelKey: 'nav.smsDeliveryApproval' },
  { key: 'social', path: '/social', labelKey: 'nav.social' },
  { key: 'citizenDirectory', path: '/citizen-directory', labelKey: 'nav.citizenDirectory' },
  { key: 'display', path: '/display', labelKey: 'nav.display' },
  { key: 'departments', path: '/departments', labelKey: 'nav.departments' },
  { key: 'users', path: '/users', labelKey: 'nav.users' },
  { key: 'settings', path: '/settings', labelKey: 'nav.settings' },
  { key: 'audit', path: '/audit', labelKey: 'nav.audit' },
  { key: 'edevletActivityPlan', path: '/edevlet/activity-plan', labelKey: 'nav.edevletActivityPlan' },
  { key: 'edevletActivityPlansList', path: '/edevlet/activity-plans', labelKey: 'nav.edevletActivityPlansList' },
] as const

export type PageAccessKey = typeof PAGE_ACCESS_ITEMS[number]['key']
export type RolePageAccessMatrix = Record<RoleCode, Record<PageAccessKey, boolean>>

/** Pages configurable under the e-Devlet Günlük Faaliyet Planı role column. */
export const EDEVLET_ROLE_PAGE_KEYS = ['edevletActivityPlan', 'edevletActivityPlansList'] as const satisfies readonly PageAccessKey[]

/** Pages for the Vatandaş Talep Yöneticisi role column. */
export const CITIZEN_REQUEST_MANAGER_PAGE_KEYS = [
  'createRequest',
  'createRoutineTask',
  'myTasks',
  'departmentTasks',
  'myRequests',
  'incomingRequests',
  'citizenMessageApproval',
] as const satisfies readonly PageAccessKey[]

/**
 * Modüler lisans (Trello #WGDYIM79 / #MHrIEwuE): bir sayfa yalnız belirli bir modül lisanslıyken
 * görünür. Haritada olmayan sayfalar (dashboard, createRequest, myTasks, departmentTasks,
 * incomingRequests, citizenMessageApproval, smsDeliveryApproval, departments, users, settings,
 * audit) her iki modülde de ortak/yönetimsel sayfalardır — modül şartı yoktur.
 */
export const PAGE_LICENSE_MODULE: Partial<Record<PageAccessKey, LicenseModuleKey>> = {
  // Kurum İçi İş Takip Sistemi'nde olmamalı (#WGDYIM79): vatandaş kanalları + e-Devlet faaliyet planı.
  edevletActivityPlan: 'citizen',
  edevletActivityPlansList: 'citizen',
  social: 'citizen',
  citizenDirectory: 'citizen',
  // Vatandaş İş Takip Sistemi'nde olmamalı (#MHrIEwuE): birim-içi iş takibine özgü sayfalar.
  myRequests: 'internal',
  outgoingRequests: 'internal',
  createRoutineTask: 'internal',
  display: 'internal',
}

export function pageRequiresModule(pageKey: PageAccessKey): LicenseModuleKey | null {
  return PAGE_LICENSE_MODULE[pageKey] ?? null
}

export const ROLE_PAGE_ACCESS_STORAGE_KEY = 'ccc_role_page_access_matrix'
export const ROLE_PAGE_ACCESS_EVENT = 'ccc-role-page-access-updated'

const DEFAULT_ALLOWED_PAGES_BY_ROLE: Record<RoleCode, readonly PageAccessKey[]> = {
  SystemAdmin: ['settings'],
  Manager: PAGE_ACCESS_ITEMS
    .map(page => page.key)
    .filter(pageKey =>
      pageKey !== 'citizenDirectory'
      && pageKey !== 'settings'
      && pageKey !== 'edevletActivityPlan'
      && pageKey !== 'edevletActivityPlansList'
      && pageKey !== 'smsDeliveryApproval',
    ),
  CitizenRequestManager: [
    'dashboard',
    ...CITIZEN_REQUEST_MANAGER_PAGE_KEYS,
  ],
  Operator: [
    'dashboard',
    'createRequest',
    'createRoutineTask',
    'myTasks',
    'myRequests',
    'smsDeliveryApproval',
    'social',
    'citizenDirectory',
    'display',
    'departments',
    'users',
    'audit',
  ],
  Staff: [
    'dashboard',
    'createRequest',
    'createRoutineTask',
    'myTasks',
    'myRequests',
    'social',
    'display',
    'departments',
    'users',
    'audit',
  ],
  Reporter: [
    'dashboard',
    'createRequest',
    'myRequests',
    'social',
    'citizenDirectory',
    'display',
    'departments',
    'users',
    'audit',
  ],
  EDevletActivityPlan: ['dashboard', 'edevletActivityPlan', 'edevletActivityPlansList'],
}

export const DEFAULT_ROLE_PAGE_ACCESS: RolePageAccessMatrix = ROLE_CODES.reduce((matrix, role) => {
  matrix[role] = PAGE_ACCESS_ITEMS.reduce((pages, page) => {
    pages[page.key] = DEFAULT_ALLOWED_PAGES_BY_ROLE[role].includes(page.key)
    return pages
  }, {} as Record<PageAccessKey, boolean>)
  return matrix
}, {} as RolePageAccessMatrix)

function isRoleCode(value: string): value is RoleCode {
  return ROLE_CODES.includes(value as RoleCode)
}

export function normalizeRolePageAccessMatrix(input: unknown): RolePageAccessMatrix {
  const source = input && typeof input === 'object' ? input as Partial<RolePageAccessMatrix> : {}
  return ROLE_CODES.reduce((matrix, role) => {
    matrix[role] = PAGE_ACCESS_ITEMS.reduce((pages, page) => {
      const configured = source[role]?.[page.key]
      if (typeof configured === 'boolean') {
        pages[page.key] = configured
      } else if (page.key === 'edevletActivityPlansList' && typeof source[role]?.edevletActivityPlan === 'boolean') {
        pages[page.key] = source[role].edevletActivityPlan
      } else if (page.key === 'incomingRequests') {
        const legacyJobs = (source[role] as Record<string, boolean | undefined> | undefined)?.jobs
        if (typeof legacyJobs === 'boolean') {
          pages[page.key] = legacyJobs
        } else {
          pages[page.key] = DEFAULT_ROLE_PAGE_ACCESS[role][page.key]
        }
      } else {
        pages[page.key] = DEFAULT_ROLE_PAGE_ACCESS[role][page.key]
      }
      return pages
    }, {} as Record<PageAccessKey, boolean>)
    // Anasayfa yalnız Sistem Yöneticisi için kapalı (card #2249) — SystemAdmin'in
    // varsayılan açılış sayfası Ayarlar'dır (bkz. getDefaultLandingPath).
    matrix[role].dashboard = role !== 'SystemAdmin'
    matrix[role].settings = role === 'SystemAdmin'
    if (role === 'EDevletActivityPlan') {
      matrix[role].edevletActivityPlan = true
      matrix[role].edevletActivityPlansList = true
    }
    if (role === 'CitizenRequestManager') {
      matrix[role].incomingRequests = true
      matrix[role].citizenMessageApproval = true
    }
    if (role === 'Operator' || role === 'Staff' || role === 'Reporter') {
      matrix[role].edevletActivityPlan = false
      matrix[role].edevletActivityPlansList = false
      matrix[role].outgoingRequests = false
      matrix[role].citizenMessageApproval = false
      // departmentTasks (Birimdeki Görevler) rol matrisinden yapılandırılabilir (card #2242) — zorla kapatma.
    }
    if (role === 'EDevletActivityPlan') {
      matrix[role].outgoingRequests = false
      // departmentTasks (Birimdeki Görevler) rol matrisinden yapılandırılabilir (card #2242) — zorla kapatma.
    }
    if (role === 'CitizenRequestManager') {
      matrix[role].outgoingRequests = false
      // departmentTasks (Birimdeki Görevler) rol matrisinden yapılandırılabilir (card #1073) — zorla kapatma.
    }
    if (role === 'Manager') {
      // Kayıtlı matriste açık olsa bile Manager Sms Onayı'na girmez (#6a6b6c8e).
      matrix[role].smsDeliveryApproval = false
    }
    // departmentTasks (Birimdeki Görevler) ve citizenDirectory (Vatandaş Bilgi Listesi) artık
    // rol matrisinden yapılandırılabilir; zorla açma/kapatma yok (card #2242). Varsayılanlar
    // (kayıt yokken) DEFAULT_ROLE_PAGE_ACCESS'te tanımlı.
    return matrix
  }, {} as RolePageAccessMatrix)
}

/** Settings/reset flows need a fresh matrix, never a shared object or stale browser fallback. */
export function createDefaultRolePageAccessMatrix(): RolePageAccessMatrix {
  return normalizeRolePageAccessMatrix(DEFAULT_ROLE_PAGE_ACCESS)
}

export function loadRolePageAccessMatrix(): RolePageAccessMatrix {
  try {
    const stored = window.localStorage.getItem(ROLE_PAGE_ACCESS_STORAGE_KEY)
    return normalizeRolePageAccessMatrix(stored ? JSON.parse(stored) : null)
  } catch {
    return DEFAULT_ROLE_PAGE_ACCESS
  }
}

export function parseRolePageAccessMatrix(value: string | null | undefined): RolePageAccessMatrix | null {
  if (!value) return null
  try {
    return normalizeRolePageAccessMatrix(JSON.parse(value))
  } catch {
    return null
  }
}

export function serializeRolePageAccessMatrix(matrix: RolePageAccessMatrix): string {
  return JSON.stringify(normalizeRolePageAccessMatrix(matrix))
}

export function saveRolePageAccessMatrix(matrix: RolePageAccessMatrix) {
  const normalized = normalizeRolePageAccessMatrix(matrix)
  window.localStorage.setItem(ROLE_PAGE_ACCESS_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(ROLE_PAGE_ACCESS_EVENT))
}

export function canRoleAccessPage(role: string | undefined, pageKey: PageAccessKey): boolean {
  if (!role) return false
  return canAnyRoleAccessPage([role], pageKey)
}

export function canAnyRoleAccessPage(roles: readonly (string | undefined)[] | undefined, pageKey: PageAccessKey): boolean {
  const requiredModule = pageRequiresModule(pageKey)
  if (requiredModule && !isModuleUsable(requiredModule)) {
    return false
  }

  const matrix = loadRolePageAccessMatrix()
  const effectiveRoles = (roles ?? [])
    .filter((role): role is RoleCode => !!role && isRoleCode(role))

  if (EDEVLET_ROLE_PAGE_KEYS.includes(pageKey as typeof EDEVLET_ROLE_PAGE_KEYS[number])) {
    if (effectiveRoles.includes('SystemAdmin')) {
      return matrix.SystemAdmin[pageKey]
    }
    return effectiveRoles.includes('EDevletActivityPlan')
  }

  return effectiveRoles.some(role => matrix[role][pageKey])
}

export function getEffectiveUserRoles(user: { role?: string; additionalRoles?: string[] } | null | undefined): string[] {
  if (!user?.role) return []
  const roles = [user.role]
  for (const role of user.additionalRoles ?? []) {
    if (role && !roles.includes(role)) roles.push(role)
  }
  return roles
}

/**
 * Sadece Sistem Yöneticisi yetkisine sahip personelde Anasayfa gizli olduğundan
 * (card #2249) varsayılan açılış sayfası Ayarlar'dır; diğer tüm roller Anasayfa'ya açılır.
 */
export function getDefaultLandingPath(user: { role?: string; additionalRoles?: string[] } | null | undefined): string {
  const roles = getEffectiveUserRoles(user)
  return roles.length === 1 && roles[0] === 'SystemAdmin' ? '/settings' : '/dashboard'
}
