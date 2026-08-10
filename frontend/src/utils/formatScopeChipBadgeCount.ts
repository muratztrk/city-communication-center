export function formatScopeChipBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}
