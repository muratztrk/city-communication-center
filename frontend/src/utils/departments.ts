/** Presidency-level units cannot receive external (birim dışı) requests. */
export function isPresidencyLevelDepartment(department: { name: string; departmentType: string }): boolean {
  return department.name === 'Başkanlık' || department.departmentType === 'Daire'
}
