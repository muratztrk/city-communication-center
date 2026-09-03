/** Presidency-level units cannot receive external (birim dışı) requests. */
export function isPresidencyLevelDepartment(department: { name: string; departmentType: string }): boolean {
  return department.name === 'Başkanlık' || department.departmentType === 'Daire'
}

/** LDAP/grid birim listesinde aynı addan yalnız bir kayıt (#3333). */
export function uniqueDepartmentsByName<T extends { departmentId: string; name: string }>(
  departments: T[],
  keepIds: Iterable<string> = [],
): T[] {
  const keep = new Set(keepIds)
  const seen = new Set<string>()
  const kept: T[] = []
  for (const department of departments) {
    if (!keep.has(department.departmentId)) continue
    kept.push(department)
    seen.add(department.name.trim().toLocaleLowerCase('tr'))
  }
  const rest: T[] = []
  for (const department of departments) {
    if (keep.has(department.departmentId)) continue
    const key = department.name.trim().toLocaleLowerCase('tr')
    if (seen.has(key)) continue
    seen.add(key)
    rest.push(department)
  }
  return [...kept, ...rest]
}
