export const ROLE_CODES = ['SystemAdmin', 'Manager', 'Operator', 'Staff', 'Reporter'] as const

export type RoleCode = typeof ROLE_CODES[number]

export const PAGE_ACCESS_ITEMS = [
  { key: 'dashboard', path: '/dashboard', labelKey: 'nav.dashboard' },
  { key: 'myTasks', path: '/my-tasks', labelKey: 'nav.myTasks' },
  { key: 'myRequests', path: '/my-requests', labelKey: 'nav.myRequests' },
  { key: 'tasks', path: '/tasks', labelKey: 'nav.tasks' },
  { key: 'jobs', path: '/jobs', labelKey: 'nav.jobs' },
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
    pages[page.key] = page.key !== 'settings' || role === 'SystemAdmin'
    return pages
  }, {} as Record<PageAccessKey, boolean>)
  return matrix
}, {} as RolePageAccessMatrix)

function isRoleCode(value: string): value is RoleCode {
  return ROLE_CODES.includes(value as RoleCode)
}

function normalizeMatrix(input: unknown): RolePageAccessMatrix {
  const source = input && typeof input === 'object' ? input as Partial<RolePageAccessMatrix> : {}
  return ROLE_CODES.reduce((matrix, role) => {
    matrix[role] = PAGE_ACCESS_ITEMS.reduce((pages, page) => {
      const configured = source[role]?.[page.key]
      pages[page.key] = typeof configured === 'boolean' ? configured : DEFAULT_ROLE_PAGE_ACCESS[role][page.key]
      return pages
    }, {} as Record<PageAccessKey, boolean>)
    matrix[role].dashboard = true
    matrix[role].settings = role === 'SystemAdmin'
    return matrix
  }, {} as RolePageAccessMatrix)
}

export function loadRolePageAccessMatrix(): RolePageAccessMatrix {
  try {
    const stored = window.localStorage.getItem(ROLE_PAGE_ACCESS_STORAGE_KEY)
    return normalizeMatrix(stored ? JSON.parse(stored) : null)
  } catch {
    return DEFAULT_ROLE_PAGE_ACCESS
  }
}

export function saveRolePageAccessMatrix(matrix: RolePageAccessMatrix) {
  const normalized = normalizeMatrix(matrix)
  window.localStorage.setItem(ROLE_PAGE_ACCESS_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent(ROLE_PAGE_ACCESS_EVENT))
}

export function canRoleAccessPage(role: string | undefined, pageKey: PageAccessKey): boolean {
  if (!role || !isRoleCode(role)) return false
  return loadRolePageAccessMatrix()[role][pageKey]
}
