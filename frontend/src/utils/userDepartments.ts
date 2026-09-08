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

const TASK_ASSIGNABLE_ROLE_CODES = new Set(['Staff', 'Operator', 'CitizenRequestManager'])

function userHasAssignableTaskRole(user: User): boolean {
  if (TASK_ASSIGNABLE_ROLE_CODES.has(user.roleCode)) return true
  return Boolean(user.additionalRoleCodes?.some(role => TASK_ASSIGNABLE_ROLE_CODES.has(role)))
}

/** Personelimin Görevleri filtresi + dashboard pie: Standart + VTY (birincil veya ek rol). */
function userHasStaffMonitorRole(user: User): boolean {
  if (user.roleCode === 'Staff' || user.roleCode === 'CitizenRequestManager') return true
  return Boolean(user.additionalRoleCodes?.includes('CitizenRequestManager'))
}

/** Onayla/Personel Ata modallarında görev atanabilecek aktif kullanıcılar. */
export function isAssignableDepartmentUser(user: User, departmentId: string, currentUserId?: string | null): boolean {
  if (!user.isActive || !userWorksInDepartment(user, departmentId)) return false
  return userHasAssignableTaskRole(user) || user.userId === currentUserId
}

/** Yöneticinin "Personelimin Görevleri" listesinde gösterilebilecek aktif personel. */
export function isDepartmentStaffUser(user: User, departmentIds: Set<string>): boolean {
  if (!user.isActive || !userHasStaffMonitorRole(user)) return false
  return userWorksInAnyDepartment(user, departmentIds)
}
