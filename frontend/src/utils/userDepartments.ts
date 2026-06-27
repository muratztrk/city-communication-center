import type { User } from '../types/platform'

/** Bir kullanıcının personel olarak çalıştığı birimler (yalnızca birincil + ek atama). */
export function userWorksInDepartment(user: User, departmentId: string): boolean {
  if (user.departmentId === departmentId) return true
  return Boolean(user.departments?.some(department => !department.isPrimary && department.departmentId === departmentId))
}

export function userWorksInAnyDepartment(user: User, departmentIds: Set<string>): boolean {
  if (departmentIds.has(user.departmentId)) return true
  return Boolean(user.departments?.some(department => !department.isPrimary && departmentIds.has(department.departmentId)))
}
