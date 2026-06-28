import type { User } from '../types/platform'

/** Bir kullanıcının personel olarak çalıştığı birimler (birincil + ek atama). */
export function userWorksInDepartment(user: User, departmentId: string): boolean {
  if (user.departmentId === departmentId) return true
  return Boolean(user.departments?.some(department => department.departmentId === departmentId))
}

export function userWorksInAnyDepartment(user: User, departmentIds: Set<string>): boolean {
  if (departmentIds.has(user.departmentId)) return true
  return Boolean(user.departments?.some(department => departmentIds.has(department.departmentId)))
}

const TASK_ASSIGNABLE_ROLE_CODES = new Set(['Staff', 'Operator'])

/** Onayla/Personel Ata modallarında görev atanabilecek aktif kullanıcılar. */
export function isAssignableDepartmentUser(user: User, departmentId: string, currentUserId?: string | null): boolean {
  if (!user.isActive || !userWorksInDepartment(user, departmentId)) return false
  return TASK_ASSIGNABLE_ROLE_CODES.has(user.roleCode) || user.userId === currentUserId
}

/** Yöneticinin "Personelimin Görevleri" listesinde gösterilebilecek aktif personel. */
export function isDepartmentStaffUser(user: User, departmentIds: Set<string>): boolean {
  if (!user.isActive || user.roleCode !== 'Staff') return false
  return userWorksInAnyDepartment(user, departmentIds)
}
