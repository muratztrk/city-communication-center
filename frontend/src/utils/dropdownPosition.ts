/** Grid satırında menü alta sığmazsa yukarı aç (#3332). */
export function shouldOpenDropdownUp(trigger: HTMLElement | null, forcedUp = false): boolean {
  if (forcedUp) return true
  if (!trigger) return false
  const rect = trigger.getBoundingClientRect()
  const container = trigger.closest('.table-wrap')
  const bounds = container?.getBoundingClientRect()
  const bottom = bounds?.bottom ?? window.innerHeight - 8
  const top = bounds?.top ?? 8
  const spaceBelow = bottom - rect.bottom
  const spaceAbove = rect.top - top
  return spaceBelow < 168 && spaceAbove > spaceBelow
}
