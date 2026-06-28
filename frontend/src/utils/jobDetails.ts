import type { JobDetail, JobDepartmentInfo } from '../types/platform'

function sortJobDepartments(departments: JobDepartmentInfo[]) {
  const order: Record<string, number> = { Owner: 0, Target: 1, Coordinating: 2 }
  return [...departments].sort((left, right) => (order[left.role] ?? 9) - (order[right.role] ?? 9))
}

export function getJobOwnerApproverDisplayName(
  job: Pick<JobDetail, 'departments'>,
): string | null {
  return job.departments.find(department => department.role === 'Owner')?.approvedByDisplayName ?? null
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
