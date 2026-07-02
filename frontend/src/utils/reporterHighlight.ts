export function isReporterCreated(roleCode: string | null | undefined): boolean {
  return roleCode === 'Reporter'
}

export function reporterDepartmentTextClass(isReporter: boolean): string {
  return isReporter ? 'font-bold text-orange-500' : 'font-semibold text-slate-700'
}

export function reporterCreatorTextClass(isReporter: boolean): string {
  return isReporter ? 'text-sm font-semibold text-orange-500' : 'text-xs text-slate-500'
}
