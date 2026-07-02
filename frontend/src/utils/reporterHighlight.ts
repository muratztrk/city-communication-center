export function isReporterCreated(roleCode: string | null | undefined): boolean {
  return roleCode === 'Reporter'
}

export function reporterDepartmentTextClass(isReporter: boolean): string {
  return isReporter ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
}
