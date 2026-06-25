export const ROLE_CODES = ['SystemAdmin', 'Manager', 'Operator', 'Staff', 'Reporter', 'EDevletActivityPlan'] as const

export type RoleCode = typeof ROLE_CODES[number]

export const PAGE_ACCESS_ITEMS = [
  { key: 'dashboard', path: '/dashboard', labelKey: 'nav.dashboard' },
  { key: 'edevletActivityPlan', path: '/edevlet/activity-plan', labelKey: 'nav.edevletActivityPlan' },
  { key: 'createRequest', path: '/requests/new', labelKey: 'nav.createRequest' },
  { key: 'createRoutineTask', path: '/routine-tasks/new', labelKey: 'nav.createRoutineTask' },
  { key: 'myTasks', path: '/my-tasks', labelKey: 'nav.myTasks' },
  { key: 'myRequests', path: '/my-requests', labelKey: 'nav.myRequests' },
  { key: 'jobs', path: '/jobs', labelKey: 'nav.jobs' },
  { key: 'incomingRequests', path: '/incoming-requests', labelKey: 'nav.incomingRequestsAll' },
  { key: 'social', path: '/social', labelKey: 'nav.social' },
  { key: 'display', path: '/display', labelKey: 'nav.display' },
  { key: 'departments', path: '/departments', labelKey: 'nav.departments' },
  { key: 'users', path: '/users', labelKey: 'nav.users' },
  { key: 'settings', path: '/settings', labelKey: 'nav.settings' },
  { key: 'audit', path: '/audit', labelKey: 'nav.audit' },
] as const

export type PageAccessKey = typeof PAGE_ACCESS_ITEMS[number]['key']
export type RolePageAccessMatrix = Record<RoleCode, Record<PageAccessKey, boolean>>

export const ROLE_PAGE_ACCESS_STORAGE_KEY = 'ccc_role_page_access_matrix'
export const ROLE_PAGE_ACCESS_EVENT = 'ccc-role-page-access-updated'

export const DEFAULT_ROLE_PAGE_ACCESS: RolePageAccessMatrix = ROLE_CODES.reduce((matrix, role) => {
  matrix[role] = PAGE_ACCESS_ITEMS.reduce((pages, page) => {
    if (role === 'EDevletActivityPlan') {
      pages[page.key] = page.key === 'dashboard' || page.key === 'edevletActivityPlan'
      return pages
    }
    if (role === 'Operator') {
      pages[page.key] = page.key !== 'settings' && page.key !== 'edevletActivityPlan'
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
      pages[page.key] = typeof configured === 'boolean' ? configured : DEFAULT_ROLE_PAGE_ACCESS[role][page.key]
      return pages
    }, {} as Record<PageAccessKey, boolean>)
    matrix[role].dashboard = true
    matrix[role].settings = role === 'SystemAdmin'
    if (role === 'EDevletActivityPlan') {
      matrix[role].edevletActivityPlan = true
    }
    if (role === 'Operator') {
      matrix[role].edevletActivityPlan = false
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
  return (roles ?? [])
    .filter((role): role is RoleCode => !!role && isRoleCode(role))
    .some(role => matrix[role][pageKey])
}

export function getEffectiveUserRoles(user: { role?: string; additionalRoles?: string[] } | null | undefined): string[] {
  if (!user?.role) return []
  const roles = [user.role]
  for (const role of user.additionalRoles ?? []) {
    if (role && !roles.includes(role)) roles.push(role)
  }
  return roles
}
