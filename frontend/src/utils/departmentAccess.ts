import type { DepartmentSummary } from '../types/platform'

export function sortUserDepartments(departments: readonly DepartmentSummary[]): DepartmentSummary[] {
  return [...departments].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return Number(right.isPrimary) - Number(left.isPrimary)
    }

    return left.name.localeCompare(right.name, 'tr')
  })
}
