export function isReporterCreated(roleCode: string | null | undefined): boolean {
  return roleCode === 'Reporter'
}

export function reporterDepartmentTextClass(isReporter: boolean): string {
  return isReporter ? 'text-orange-500' : 'text-slate-700'
}
