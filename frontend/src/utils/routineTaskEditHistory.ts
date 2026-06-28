import type { EntityAuditLogEntry } from '../types/platform'

export type RoutineTaskEditSnapshot = {
  title: string
  description: string
  priority: string
  dueDateUtc: string | null
  neighborhood: string | null
  street: string | null
  openAddress: string | null
}

export type RoutineTaskEditHistoryEntry = {
  auditLogId: string
  editedAtUtc: string
  editedByDisplayName: string
  snapshot: RoutineTaskEditSnapshot
}

export function parseRoutineTaskEditHistory(entries: EntityAuditLogEntry[]): RoutineTaskEditHistoryEntry[] {
  return entries
    .filter(entry => entry.action === 'RoutineTaskEditSnapshot' && entry.notes)
    .map(entry => {
      try {
        const snapshot = JSON.parse(entry.notes!) as RoutineTaskEditSnapshot
        return {
          auditLogId: entry.auditLogId,
          editedAtUtc: entry.eventTimeUtc,
          editedByDisplayName: entry.actorDisplayName,
          snapshot,
        }
      } catch {
        return null
      }
    })
    .filter((entry): entry is RoutineTaskEditHistoryEntry => entry != null)
    .sort((a, b) => new Date(b.editedAtUtc).getTime() - new Date(a.editedAtUtc).getTime())
}
