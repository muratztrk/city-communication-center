import type { JobSummary, SocialMessage, Task } from '../types/platform'
import { getLocale } from './localization'
import { formatCitizenRequestNumber, isCitizenProcessingReceivedState, isCitizenRequestJob } from './citizenRequests'
import { isJobDueDateOverdue } from './dateTimePicker'

export type IncomingStatusFilter = 'pending-approval' | 'approved' | 'overdue' | 'in-progress' | 'completed' | 'cancelled' | 'processing-received' | 'all'

export type IncomingRequestRow = {
  id: string
  jobId: string
  displayNumber: string
  kind: 'internal' | 'external'
  statusDomain: 'task' | 'job'
  title: string
  status: string
  priority: string
  departmentName: string | null
  departmentId: string | null
  createdBy: string | null
  taskOwnerDisplayName: string | null
  dueDateUtc: string | null
  createdAtUtc: string | null
  assignTargetDepartmentId: string | null
  pendingTargetApprovalDepartmentId: string | null
  approvedAtUtc: string | null
  ownerApprovedAtUtc: string | null
  completedAtUtc: string | null
  updatedAtUtc: string | null
  createdByRoleCode: string | null
  isCitizenRequest?: boolean
  taskCount?: number
}

function formatJobDisplayNumber(job: JobSummary): string {
  const year = job.jobNumberYear ?? new Date().getFullYear()
  if (job.jobNumber != null && job.jobNumberYear != null) {
    return `T-${year}-${job.jobNumber}`
  }
  return `T-${year}-Onay Bekleyen`
}

function formatInternalRequestNumber(task: Task): string {
  const year = task.jobNumberYear ?? new Date().getFullYear()
  if (task.jobNumber != null && task.jobNumberYear != null) {
    return `T-${task.jobNumberYear}-${task.jobNumber}`
  }
  return `T-${year}-Onay Bekleyen`
}

function isIncomingExternalForActiveDept(job: JobSummary, activeDeptId: string | null): boolean {
  if (job.status === 'PendingOwnerApproval') return false
  const ownerApproved = job.departments?.some(d => d.role === 'Owner' && d.approvalStatus === 'Approved') ?? false
  const isVisibleToTarget = ownerApproved
    || job.status === 'Active'
    || job.status === 'PendingExternalApproval'
  if (!isVisibleToTarget) return false
  if (!activeDeptId) return true
  return job.departments?.some(d => d.role === 'Target' && d.departmentId === activeDeptId) ?? false
}

function isCitizenProcessingReceivedRow(row: IncomingRequestRow): boolean {
  if (!row.isCitizenRequest) return false
  return isCitizenProcessingReceivedState({
    status: row.status,
    dueDateUtc: row.dueDateUtc,
    taskCount: row.taskCount,
  })
}

export function isIncomingRowInProgress(row: IncomingRequestRow): boolean {
  const taskCount = row.taskCount ?? 0
  const isActiveJob = row.statusDomain === 'job' && row.status === 'Active'
  const isInProgressTask = row.statusDomain === 'task' && (
    row.status === 'Waiting'
    || row.status === 'Assigned'
    || row.status === 'InProgress'
    || row.status === 'PendingCloseApproval'
  )
  return (isActiveJob && taskCount > 0) || isInProgressTask
}

export function matchesIncomingStatusFilter(row: IncomingRequestRow, filter: IncomingStatusFilter): boolean {
  if (filter === 'all') return true
  const isOverdue = isJobDueDateOverdue(row)
  const isClosed = row.status === 'Completed' || row.status === 'Cancelled' || row.status === 'Rejected' || row.status === 'RevisionRequested'

  if (filter === 'pending-approval') {
    const ownerApprovalPending = row.status === 'PendingOwnerApproval' || row.status === 'PendingApproval'
    const citizenProcessingBeforeOwnerApproval = isCitizenProcessingReceivedRow(row) && !row.ownerApprovedAtUtc
    return ownerApprovalPending
      || row.assignTargetDepartmentId != null
      || citizenProcessingBeforeOwnerApproval
  }

  if (filter === 'processing-received') {
    return isCitizenProcessingReceivedRow(row)
  }

  // Onaylanmış: onaylı ama tamamlanmış/iptal/yapılmakta değil (#2826).
  if (filter === 'approved') {
    return row.approvedAtUtc != null
      && !isClosed
      && !isIncomingRowInProgress(row)
  }

  if (filter === 'overdue') return !isClosed && isOverdue
  if (isOverdue && !isClosed) return false

  if (filter === 'completed') return row.status === 'Completed'
  if (filter === 'cancelled') {
    return row.status === 'Cancelled' || row.status === 'Rejected' || row.status === 'RevisionRequested'
  }

  if (row.assignTargetDepartmentId != null) return false

  if (filter === 'in-progress') {
    return isIncomingRowInProgress(row)
  }

  return false
}

function toInternalRow(task: Task): IncomingRequestRow {
  return {
    id: task.taskId,
    jobId: task.jobId,
    displayNumber: formatInternalRequestNumber(task),
    kind: 'internal',
    statusDomain: 'task',
    title: task.title,
    status: task.currentStatus,
    priority: task.priority,
    departmentName: task.ownerDepartmentName ?? task.assignedDepartmentName ?? null,
    departmentId: null,
    createdBy: task.createdByDisplayName ?? null,
    taskOwnerDisplayName: task.assignedUserDisplayName ?? task.ownerDisplayName ?? null,
    dueDateUtc: task.dueDateUtc,
    createdAtUtc: task.jobCreatedAtUtc ?? task.createdAtUtc ?? null,
    assignTargetDepartmentId: null,
    pendingTargetApprovalDepartmentId: null,
    approvedAtUtc: task.createdAtUtc ?? null,
    ownerApprovedAtUtc: null,
    completedAtUtc: task.completedAtUtc ?? null,
    updatedAtUtc: task.updatedAtUtc ?? null,
    createdByRoleCode: task.createdByRoleCode ?? null,
  }
}

function toPendingInternalJobRow(job: JobSummary): IncomingRequestRow {
  const ownerDept = job.departments?.find(d => d.role === 'Owner')
  return {
    id: job.jobId,
    jobId: job.jobId,
    displayNumber: formatJobDisplayNumber(job),
    kind: 'internal',
    statusDomain: 'job',
    title: job.title,
    status: job.status,
    priority: job.priority,
    departmentName: job.ownerDepartmentName,
    departmentId: job.ownerDepartmentId ?? null,
    createdBy: job.createdByDisplayName,
    taskOwnerDisplayName: job.assignedUserDisplayName ?? null,
    dueDateUtc: job.dueDateUtc,
    createdAtUtc: job.createdAtUtc,
    assignTargetDepartmentId: null,
    pendingTargetApprovalDepartmentId: null,
    approvedAtUtc: ownerDept?.decidedAtUtc ?? null,
    ownerApprovedAtUtc: ownerDept?.decidedAtUtc ?? null,
    completedAtUtc: job.completedAtUtc,
    updatedAtUtc: job.updatedAtUtc ?? null,
    createdByRoleCode: job.createdByRoleCode ?? null,
  }
}

function toExternalRow(
  job: JobSummary,
  activeDeptId: string | null,
  socialByJobId: Map<string, SocialMessage>,
  locale: string,
): IncomingRequestRow {
  const ownerDept = job.departments?.find(d => d.role === 'Owner')
  const activeTarget = activeDeptId
    ? job.departments?.find(d => d.role === 'Target' && d.departmentId === activeDeptId)
    : undefined
  const targetPending = activeTarget?.approvalStatus === 'Pending'
  const targetApproved = activeTarget?.approvalStatus === 'Approved' || activeTarget?.approvalStatus === 'NotRequired'
  const isCitizen = isCitizenRequestJob(job)
  const assignTargetDepartmentId = activeTarget && job.status === 'Active' && job.taskCount === 0
    && (targetApproved || (isCitizen && targetPending))
    ? activeTarget.departmentId
    : null
  const pendingTargetApprovalDepartmentId = targetPending && activeTarget && !isCitizen
    ? activeTarget.departmentId
    : null
  const isTerminalJobStatus = job.status === 'Completed'
    || job.status === 'Cancelled'
    || job.status === 'Rejected'
    || job.status === 'RevisionRequested'
  const displayStatus = targetPending && !isTerminalJobStatus ? 'PendingExternalApproval' : job.status
  const displayNumber = isCitizenRequestJob(job)
    ? formatCitizenRequestNumber(socialByJobId.get(job.jobId) ?? { createdAtUtc: job.createdAtUtc }, locale)
    : formatJobDisplayNumber(job)
  return {
    id: job.jobId,
    jobId: job.jobId,
    displayNumber,
    kind: 'external',
    statusDomain: 'job',
    title: job.title,
    status: displayStatus,
    priority: job.priority,
    departmentName: job.ownerDepartmentName,
    departmentId: job.ownerDepartmentId ?? null,
    createdBy: job.createdByDisplayName,
    taskOwnerDisplayName: job.assignedUserDisplayName ?? null,
    dueDateUtc: job.dueDateUtc,
    createdAtUtc: job.createdAtUtc,
    assignTargetDepartmentId,
    pendingTargetApprovalDepartmentId,
    approvedAtUtc: activeTarget?.decidedAtUtc ?? ownerDept?.decidedAtUtc ?? null,
    ownerApprovedAtUtc: ownerDept?.decidedAtUtc ?? null,
    completedAtUtc: job.completedAtUtc,
    updatedAtUtc: job.updatedAtUtc ?? null,
    createdByRoleCode: job.createdByRoleCode ?? null,
    isCitizenRequest: isCitizen,
    taskCount: job.taskCount,
  }
}

export function buildIncomingRequestRows(
  tasks: Task[],
  jobs: JobSummary[],
  activeDeptId: string | null,
  socialMessages: SocialMessage[],
  locale: string,
): IncomingRequestRow[] {
  const socialByJobId = new Map<string, SocialMessage>()
  for (const message of socialMessages) {
    if (message.jobId) socialByJobId.set(message.jobId, message)
  }
  const internalTasks = tasks.filter(task => task.jobRequestType === 'InternalUnit')
  const internalRows = internalTasks.map(toInternalRow)
  const jobIdsWithTasks = new Set(internalTasks.map(t => t.jobId))
  const pendingInternalJobRows = jobs
    .filter(job => job.requestType === 'InternalUnit' && !jobIdsWithTasks.has(job.jobId))
    .map(toPendingInternalJobRow)
  const externalRows = jobs
    .filter(job => (job.requestType === 'ExternalUnit' || job.requestType === 'Citizen') && isIncomingExternalForActiveDept(job, activeDeptId))
    .map(job => toExternalRow(job, activeDeptId, socialByJobId, locale))

  return [...internalRows, ...pendingInternalJobRows, ...externalRows]
}

export function countIncomingPendingApprovalRows(
  rows: IncomingRequestRow[],
  options?: { citizenOnly?: boolean },
): number {
  return rows
    .filter(row => matchesIncomingStatusFilter(row, 'pending-approval'))
    .filter(row => !options?.citizenOnly || row.isCitizenRequest)
    .length
}

export function isIncomingPendingApprovalOverdue(row: IncomingRequestRow): boolean {
  return isJobDueDateOverdue(row) && matchesIncomingStatusFilter(row, 'pending-approval')
}

export function countIncomingPendingApprovalForNav(
  tasks: Task[],
  jobs: JobSummary[],
  activeDeptId: string | null,
  socialMessages: SocialMessage[],
  locale = getLocale('tr'),
  citizenOnly = false,
): number {
  const rows = buildIncomingRequestRows(tasks, jobs, activeDeptId, socialMessages, locale)
  return countIncomingPendingApprovalRows(rows, { citizenOnly })
}
