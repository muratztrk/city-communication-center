/** Grid satırında menü alta sığmazsa yukarı aç (#3332). Üstte aşağı, altta yukarı. */
export function shouldOpenDropdownUp(trigger: HTMLElement | null, forcedUp = false, forceDown = false): boolean {
  if (forceDown) return false
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
