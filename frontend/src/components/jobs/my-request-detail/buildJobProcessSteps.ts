import type { TFunction } from 'i18next'
import type { JobDetail } from '../../../types/platform'
import {
  isCitizenRequestJob,
  shouldShowCitizenTargetApprovalDate,
} from '../../../utils/citizenRequests'
import { formatDateTime, formatDueDateTime } from './format'

export type JobProcessStepState = 'completed' | 'current' | 'upcoming' | 'terminal-success' | 'terminal-danger'

export type JobProcessStepId =
  | 'requestDate'
  | 'ownerApproval'
  | 'targetApproval'
  | 'status'
  | 'completionDate'
  | 'cancelDate'
  | 'dueDate'

export interface JobProcessStep {
  id: JobProcessStepId
  label: string
  displayValue: string
  displayMeta?: string
  state: JobProcessStepState
}

function isTerminalStatus(status: string): boolean {
  return status === 'Completed' || status === 'Cancelled' || status === 'Rejected'
}

function wasRecoveredFromCancellation(detail: JobDetail): boolean {
  return Boolean(detail.cancelReason?.trim())
    && (detail.status === 'Active' || detail.status === 'Completed')
}

function resolveStepStates(steps: Omit<JobProcessStep, 'state'>[], detail: JobDetail): JobProcessStep[] {
  if (wasRecoveredFromCancellation(detail)) {
    let foundCurrent = false
    return steps.map(step => {
      if (foundCurrent) {
        return { ...step, state: 'upcoming' as const }
      }
      if (step.id === 'cancelDate') {
        return { ...step, state: 'terminal-danger' as const }
      }
      if (step.id === 'status') {
        foundCurrent = true
        return { ...step, state: 'current' as const }
      }
      if (step.id === 'completionDate') {
        return { ...step, state: 'terminal-success' as const }
      }
      if (step.id === 'dueDate') {
        return { ...step, state: 'upcoming' as const }
      }
      return { ...step, state: 'completed' as const }
    })
  }

  if (detail.status === 'Completed') {
    return steps.map(step => ({
      ...step,
      state: step.id === 'completionDate' ? 'terminal-success' : 'completed',
    }))
  }
  if (detail.status === 'Cancelled' || detail.status === 'Rejected') {
    return steps.map(step => ({
      ...step,
      state: step.id === 'cancelDate' ? 'terminal-danger' : 'completed',
    }))
  }

  let foundCurrent = false
  return steps.map(step => {
    if (foundCurrent) {
      return { ...step, state: 'upcoming' as const }
    }

    const ownerDecided = detail.departments.find(d => d.role === 'Owner')?.decidedAtUtc
    const targetDecided = detail.departments.find(d => d.role === 'Target')?.decidedAtUtc

    if (step.id === 'requestDate') {
      return { ...step, state: 'completed' as const }
    }
    if (step.id === 'ownerApproval') {
      if (ownerDecided) return { ...step, state: 'completed' as const }
      if (detail.status === 'PendingOwnerApproval') {
        foundCurrent = true
        return { ...step, state: 'current' as const }
      }
      return { ...step, state: 'completed' as const }
    }
    if (step.id === 'targetApproval') {
      if (targetDecided) return { ...step, state: 'completed' as const }
      if (detail.status === 'PendingExternalApproval') {
        foundCurrent = true
        return { ...step, state: 'current' as const }
      }
      if (!ownerDecided && detail.status === 'PendingOwnerApproval') {
        return { ...step, state: 'upcoming' as const }
      }
      if (!targetDecided && shouldShowCitizenTargetApprovalDate(detail)) {
        foundCurrent = true
        return { ...step, state: 'current' as const }
      }
      return { ...step, state: ownerDecided ? 'completed' as const : 'upcoming' as const }
    }
    if (step.id === 'status') {
      foundCurrent = true
      return { ...step, state: 'current' as const }
    }
    if (step.id === 'completionDate' || step.id === 'cancelDate') {
      return { ...step, state: 'completed' as const }
    }
    if (step.id === 'dueDate') {
      return { ...step, state: isTerminalStatus(detail.status) ? 'completed' as const : 'upcoming' as const }
    }

    return { ...step, state: 'upcoming' as const }
  })
}

export function buildJobProcessSteps(
  t: TFunction,
  detail: JobDetail,
  locale: string,
  options?: { hideOwnerApproval?: boolean },
): JobProcessStep[] {
  const steps: Omit<JobProcessStep, 'state'>[] = [
    {
      id: 'requestDate',
      label: t('jobs.detail.requestDate', 'Talep Tarihi'),
      displayValue: formatDateTime(detail.createdAtUtc, locale),
    },
  ]

  if (!isCitizenRequestJob(detail) && !options?.hideOwnerApproval) {
    const ownerDepartment = detail.departments.find(department => department.role === 'Owner')
    const ownerApprovalActor = ownerDepartment?.approvedByDisplayName
      ?? (ownerDepartment?.decidedAtUtc ? null : detail.statusActorDisplayName)
    const ownerApprovalLabel = t('jobs.detail.ownerManagerApprovalDate', 'Talebin Birim Yöneticisinin Onay Tarihi')
    steps.push({
      id: 'ownerApproval',
      label: ownerApprovalLabel,
      displayValue: formatDueDateTime(ownerDepartment?.decidedAtUtc ?? null, locale),
      displayMeta: ownerApprovalActor ?? undefined,
    })
  }

  if (shouldShowCitizenTargetApprovalDate(detail)) {
    const targetDepartment = detail.departments.find(department => department.role === 'Target')
    steps.push({
      id: 'targetApproval',
      label: t('jobs.detail.targetManagerApprovalDate', 'Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi'),
      displayValue: formatDueDateTime(targetDepartment?.decidedAtUtc ?? null, locale),
      displayMeta: targetDepartment?.approvedByDisplayName ?? undefined,
    })
  }

  if (wasRecoveredFromCancellation(detail) && detail.status !== 'Cancelled' && detail.status !== 'Rejected') {
    steps.push({
      id: 'cancelDate',
      label: t('jobs.detail.cancelledAt', 'İptal Tarihi'),
      displayValue: formatDateTime(detail.updatedAtUtc ?? null, locale),
    })
  }

  if (detail.status === 'Completed') {
    steps.push({
      id: 'completionDate',
      label: t('jobs.detail.completedAt', 'Tamamlanma Tarihi'),
      displayValue: formatDateTime(detail.completedAtUtc ?? null, locale),
    })
  } else if (detail.status === 'Cancelled' || detail.status === 'Rejected') {
    steps.push({
      id: 'cancelDate',
      label: t('jobs.detail.cancelledAt', 'İptal Tarihi'),
      displayValue: formatDateTime(detail.updatedAtUtc ?? null, locale),
    })
  }

  if (!isTerminalStatus(detail.status)) {
    steps.push({
      id: 'dueDate',
      label: t('jobs.columns.dueDate', 'Son Tarih'),
      displayValue: formatDueDateTime(detail.dueDateUtc, locale),
    })
  }

  return resolveStepStates(steps, detail)
}

export function isJobRecoveredFromCancellation(detail: JobDetail): boolean {
  return wasRecoveredFromCancellation(detail)
}
