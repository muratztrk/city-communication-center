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

/** Yöneticinin "Personelimin Görevleri" listesinde gösterilebilecek aktif personel. */
export function isDepartmentStaffUser(user: User, departmentIds: Set<string>): boolean {
  if (!user.isActive || user.roleCode !== 'Staff') return false
  return userWorksInAnyDepartment(user, departmentIds)
}
