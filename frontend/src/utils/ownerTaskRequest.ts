import type { JobDepartmentInfo } from '../types/platform'

// Birim içi talep oluşturulurken "görevi kendim yapayım" seçiminin saklandığı not öneki.
export const OWNER_TASK_NOTES_PREFIX = 'ccc:owner-task-request:v1:'

// Talebi oluşturan kişi, sahip (Owner) birim talebinde kendisini görev sahibi olarak
// seçtiyse o kullanıcı id'sini döndürür; aksi halde null. (card 607/616 ortak mantığı)
export function getSelfRequestedOwnerUserId(job: { departments?: JobDepartmentInfo[] | null }): string | null {
  const ownerDepartment = job.departments?.find(department => department.role === 'Owner')
  const requestedByUserId = ownerDepartment?.requestedByUserId
  const notes = ownerDepartment?.notes
  if (!requestedByUserId || !notes?.startsWith(OWNER_TASK_NOTES_PREFIX)) return null

  try {
    const payload = JSON.parse(notes.slice(OWNER_TASK_NOTES_PREFIX.length)) as {
      OwnerUserIds?: string[]
      ownerUserIds?: string[]
    }
    const requestedOwnerUserIds = payload.OwnerUserIds ?? payload.ownerUserIds ?? []
    return requestedOwnerUserIds.includes(requestedByUserId) ? requestedByUserId : null
  } catch {
    return null
  }
}
