export const ROLE_CODES = ['SystemAdmin', 'Manager', 'Operator', 'Staff', 'Reporter', 'EDevletActivityPlan', 'CitizenRequestManager'] as const

export type RoleCode = typeof ROLE_CODES[number]

export const PAGE_ACCESS_ITEMS = [
  { key: 'dashboard', path: '/dashboard', labelKey: 'nav.dashboard' },
  { key: 'edevletActivityPlan', path: '/edevlet/activity-plan', labelKey: 'nav.edevletActivityPlan' },
  { key: 'edevletActivityPlansList', path: '/edevlet/activity-plans', labelKey: 'nav.edevletActivityPlansList' },
  { key: 'createRequest', path: '/requests/new', labelKey: 'nav.createRequest' },
  { key: 'createRoutineTask', path: '/routine-tasks/new', labelKey: 'nav.createRoutineTask' },
  { key: 'myTasks', path: '/my-tasks', labelKey: 'nav.myTasks' },
  { key: 'departmentTasks', path: '/department-tasks', labelKey: 'nav.departmentTasks' },
  { key: 'myRequests', path: '/my-requests', labelKey: 'nav.myRequests' },
  { key: 'incomingRequests', path: '/incoming-requests', labelKey: 'nav.incomingRequests' },
  { key: 'outgoingRequests', path: '/outgoing-requests', labelKey: 'nav.outgoingRequests' },
  { key: 'social', path: '/social', labelKey: 'nav.social' },
  { key: 'display', path: '/display', labelKey: 'nav.display' },
  { key: 'departments', path: '/departments', labelKey: 'nav.departments' },
  { key: 'users', path: '/users', labelKey: 'nav.users' },
  { key: 'settings', path: '/settings', labelKey: 'nav.settings' },
  { key: 'audit', path: '/audit', labelKey: 'nav.audit' },
] as const

export type PageAccessKey = typeof PAGE_ACCESS_ITEMS[number]['key']
export type RolePageAccessMatrix = Record<RoleCode, Record<PageAccessKey, boolean>>

/** Pages configurable under the e-Devlet Günlük Faaliyet Planı role column. */
export const EDEVLET_ROLE_PAGE_KEYS = ['edevletActivityPlan', 'edevletActivityPlansList'] as const satisfies readonly PageAccessKey[]

/** Pages for the Vatandaş Talep Yöneticisi role column. */
export const CITIZEN_REQUEST_MANAGER_PAGE_KEYS = ['createRequest', 'incomingRequests'] as const satisfies readonly PageAccessKey[]

export const ROLE_PAGE_ACCESS_STORAGE_KEY = 'ccc_role_page_access_matrix'
export const ROLE_PAGE_ACCESS_EVENT = 'ccc-role-page-access-updated'

export const DEFAULT_ROLE_PAGE_ACCESS: RolePageAccessMatrix = ROLE_CODES.reduce((matrix, role) => {
  matrix[role] = PAGE_ACCESS_ITEMS.reduce((pages, page) => {
    if (role === 'EDevletActivityPlan') {
      pages[page.key] = page.key === 'dashboard'
        || EDEVLET_ROLE_PAGE_KEYS.includes(page.key as typeof EDEVLET_ROLE_PAGE_KEYS[number])
      return pages
    }
    if (role === 'CitizenRequestManager') {
      pages[page.key] = page.key === 'dashboard'
        || CITIZEN_REQUEST_MANAGER_PAGE_KEYS.includes(page.key as typeof CITIZEN_REQUEST_MANAGER_PAGE_KEYS[number])
      return pages
    }
    if (role === 'Operator' || role === 'Staff' || role === 'Reporter') {
      pages[page.key] = page.key !== 'settings'
        && page.key !== 'edevletActivityPlan'
        && page.key !== 'edevletActivityPlansList'
        && page.key !== 'outgoingRequests'
        && page.key !== 'departmentTasks'
      return pages
    }
    if (role === 'Manager') {
      pages[page.key] = page.key !== 'settings'
        && page.key !== 'edevletActivityPlan'
        && page.key !== 'edevletActivityPlansList'
      return pages
    }
    pages[page.key] = page.key !== 'settings' || role === 'SystemAdmin'
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
    matrix[role].dashboard = true
    matrix[role].settings = role === 'SystemAdmin'
    if (role === 'EDevletActivityPlan') {
      matrix[role].edevletActivityPlan = true
      matrix[role].edevletActivityPlansList = true
    }
    if (role === 'CitizenRequestManager') {
      matrix[role].incomingRequests = true
    }
    if (role === 'Operator' || role === 'Staff' || role === 'Reporter') {
      matrix[role].edevletActivityPlan = false
      matrix[role].edevletActivityPlansList = false
      matrix[role].outgoingRequests = false
      matrix[role].departmentTasks = false
    }
    if (role === 'EDevletActivityPlan') {
      matrix[role].outgoingRequests = false
      matrix[role].departmentTasks = false
    }
    if (role === 'CitizenRequestManager') {
      matrix[role].outgoingRequests = false
      // departmentTasks (Birimdeki Görevler) rol matrisinden yapılandırılabilir (card #1073) — zorla kapatma.
    }
    if (role === 'Manager' || role === 'SystemAdmin') {
      matrix[role].departmentTasks = true
    }
    return matrix
  }, {} as RolePageAccessMatrix)
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
