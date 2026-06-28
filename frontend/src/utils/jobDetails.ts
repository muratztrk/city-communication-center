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
  job: Pick<JobDetail, 'departments'>,
): string | null {
  return job.departments.find(department => department.role === 'Target')?.approvedByDisplayName ?? null
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

export function formatJobDestinationsWithAssignees(job: JobDetail): string {
  const destinations = sortJobDepartments(job.departments)
    .filter(department => department.role === 'Target' || department.role === 'Coordinating')
  const effectiveDestinations = destinations.length > 0
    ? destinations
    : job.departments.filter(department => department.departmentId === job.ownerDepartmentId)

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
      return assignees.length > 0 ? `${departmentName} / ${assignees.join(', ')}` : departmentName
    })
    .join(', ') || job.ownerDepartmentName || '—'
}
