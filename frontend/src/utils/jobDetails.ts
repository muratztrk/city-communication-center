import type { JobDetail, JobDepartmentInfo } from '../types/platform'
import { isCitizenRequestJob } from './citizenRequests'

function sortJobDepartments(departments: JobDepartmentInfo[]) {
  const order: Record<string, number> = { Owner: 0, Target: 1, Coordinating: 2 }
  return [...departments].sort((left, right) => (order[left.role] ?? 9) - (order[right.role] ?? 9))
}

export function getJobOwnerApproverDisplayName(
  job: Pick<JobDetail, 'departments'>,
): string | null {
  return job.departments.find(department => department.role === 'Owner')?.approvedByDisplayName ?? null
}

export function getJobTargetApproverDisplayName(
  job: Pick<JobDetail, 'departments'> & Partial<Pick<JobDetail, 'requestType' | 'tasks'>>,
): string | null {
  const target = job.departments.find(department =>
    department.role === 'Target'
      && department.approvalStatus === 'Approved'
      && Boolean(department.decidedAtUtc),
  ) ?? job.departments.find(department => department.role === 'Target')
  const storedApprover = target?.approvedByDisplayName ?? null
  if (job.requestType !== 'ExternalUnit' || !target) return storedApprover

  // Eski tek-hedefli birim dışı kayıtlarda sahibi birim onayı hedef kayda da aynı kişiyle
  // yazılmış olabilir. İlk hedef görevini atayan yönetici gerçek hedef onaycısıdır (card #1595).
  const ownerApprover = getJobOwnerApproverDisplayName(job)
  if (storedApprover && storedApprover !== ownerApprover) return storedApprover
  return job.tasks?.find(task =>
    task.assignedDepartmentId === target.departmentId
      && Boolean(task.assigningManagerDisplayName),
  )?.assigningManagerDisplayName ?? storedApprover
}

export function getRequestApproverDepartmentName(
  job: Pick<JobDetail, 'departments' | 'requestType' | 'sourceType'>,
): string | null {
  if (isCitizenRequestJob(job)) {
    const target = job.departments.find(department => department.role === 'Target')
    if (target?.approvedByDisplayName) {
      return target.departmentName
    }
    return job.departments.find(department => department.role === 'Owner')?.departmentName ?? null
  }
  return job.departments.find(department => department.role === 'Owner')?.departmentName ?? null
}

export function formatRequestApproverDisplay(
  job: Pick<JobDetail, 'departments' | 'requestType' | 'sourceType'>,
): string | null {
  const approverName = getRequestApproverDisplayName(job)
  if (!approverName) return null
  const departmentName = getRequestApproverDepartmentName(job)
  return departmentName ? `${departmentName} / ${approverName}` : approverName
}

export function getRequestApproverDisplayName(
  job: Pick<JobDetail, 'departments' | 'requestType' | 'sourceType'>,
): string | null {
  if (isCitizenRequestJob(job)) {
    return getJobTargetApproverDisplayName(job) ?? getJobOwnerApproverDisplayName(job)
  }
  return getJobOwnerApproverDisplayName(job)
}

export function shouldShowRequestApproverField(job: {
  status: string
  requestType?: string | null
  sourceType?: string | null
  departments?: { role: string; approvalStatus?: string | null }[]
}): boolean {
  if (job.status === 'PendingOwnerApproval' || job.status === 'PendingExternalApproval') {
    return false
  }
  if (isCitizenRequestJob(job)) {
    const target = job.departments?.find(department => department.role === 'Target')
    return target?.approvalStatus === 'Approved'
  }
  return true
}

export function shouldShowJobStatusActorName(job: {
  status: string
  statusActorDisplayName?: string | null
}): boolean {
  if (!job.statusActorDisplayName) return false
  return shouldShowRequestApproverField(job)
}

export function formatJobDestinationsWithAssignees(job: JobDetail, showUnassignedPlaceholder = false, includeAssignee = true): string {
  const destinations = sortJobDepartments(job.departments)
    .filter(department => department.role === 'Target' || department.role === 'Coordinating')
  const effectiveDestinations = destinations.length > 0
    ? destinations
    : job.departments.filter(department => department.departmentId === job.ownerDepartmentId)

  // Görevlerim popup'ında (İlgili Talep Detayları) sadece birim adı gösterilir, atanan kişi
  // Görev Bilgileri panelinde zaten var (card #1446).
  if (!includeAssignee) {
    return effectiveDestinations
      .map(department => department.departmentName ?? job.ownerDepartmentName ?? '—')
      .join(', ') || job.ownerDepartmentName || '—'
  }

  return effectiveDestinations
    .map(department => {
      const assignees = [...new Set(
        job.tasks
          .filter(task =>
            task.assignedDepartmentId === department.departmentId
            || task.assignedDepartmentName === department.departmentName)
          .map(task => task.assignedUserDisplayName)
          .filter((name): name is string => Boolean(name)),
      )]
      const departmentName = department.departmentName ?? job.ownerDepartmentName ?? '—'
      if (assignees.length > 0) {
        return `${departmentName} / ${assignees.join(', ')}`
      }
      return showUnassignedPlaceholder ? `${departmentName} / -` : departmentName
    })
    .join(', ') || (showUnassignedPlaceholder ? `${job.ownerDepartmentName || '—'} / -` : job.ownerDepartmentName || '—')
}
