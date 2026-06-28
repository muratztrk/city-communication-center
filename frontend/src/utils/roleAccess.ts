import { getEffectiveUserRoles } from '../lib/rolePageAccess'

export function hasCitizenRequestManagerRole(
  user: { role?: string; additionalRoles?: string[] } | null | undefined,
): boolean {
  return getEffectiveUserRoles(user).includes('CitizenRequestManager')
}

export function isCitizenRequestVTNumber(displayNumber: string): boolean {
  return displayNumber.startsWith('VT-')
}

export function canCitizenRequestManagerActOnRow(
  user: { role?: string; additionalRoles?: string[] } | null | undefined,
  row: { isCitizenRequest?: boolean; displayNumber: string },
): boolean {
  if (!hasCitizenRequestManagerRole(user)) return true
  return Boolean(row.isCitizenRequest) && isCitizenRequestVTNumber(row.displayNumber)
}
