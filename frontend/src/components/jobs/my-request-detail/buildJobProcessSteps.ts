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
  dateTimeUtc?: string | null
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
  const ownerDecided = detail.departments.find(d => d.role === 'Owner')?.decidedAtUtc
  const targetDecided = detail.departments.find(d => d.role === 'Target')?.decidedAtUtc
  return steps.map(step => {
    // Hedef onay adımı, turuncu Durum adımından sonra da gelse onaylandıysa yeşil kalır (card #1345).
    if (step.id === 'targetApproval' && targetDecided) {
      return { ...step, state: 'completed' as const }
    }
    if (foundCurrent) {
      return { ...step, state: 'upcoming' as const }
    }

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
      if (detail.status === 'PendingExternalApproval') {
        foundCurrent = true
        return { ...step, state: 'current' as const }
      }
      if (!ownerDecided && detail.status === 'PendingOwnerApproval') {
        return { ...step, state: 'upcoming' as const }
      }
      if (shouldShowCitizenTargetApprovalDate(detail)) {
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
      dateTimeUtc: detail.createdAtUtc,
    },
  ]
  const targetDepartment = detail.departments.find(department => department.role === 'Target')
  const targetDecided = Boolean(targetDepartment?.decidedAtUtc)

  // Birim yöneticisinin oluşturduğu birim içi/birim dışı aktif taleplerde turuncu "Durum / Yapılmakta"
  // adımı onay beklerken Talep Tarihi'nin hemen arkasına gelir; hedef onaylandıysa hedef onay
  // adımından sonra gelir (cards #1275/#1345/#1357). İptalden geri alınan talepte İptal Tarihi
  // adımı Durum'dan önce kalmalı, o yüzden erken eklenmez.
  const managerCreatedActive = detail.createdByRoleCode === 'Manager'
    && !isCitizenRequestJob(detail)
    && (detail.requestType === 'InternalUnit' || detail.requestType === 'ExternalUnit')
  const statusStepEarly = managerCreatedActive
    && !wasRecoveredFromCancellation(detail)
    && !(detail.requestType === 'ExternalUnit' && targetDecided)
  if (statusStepEarly && !isTerminalStatus(detail.status)) {
    steps.push({
      id: 'status',
      label: t('jobs.columns.status', 'Durum'),
      displayValue: t('jobs.statusLabel.inProgress', 'Yapılmakta'),
      dateTimeUtc: null,
    })
  }

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
      dateTimeUtc: ownerDepartment?.decidedAtUtc ?? null,
    })
  }

  if (shouldShowCitizenTargetApprovalDate(detail)) {
    steps.push({
      id: 'targetApproval',
      label: t('jobs.detail.targetManagerApprovalDate', 'Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi'),
      displayValue: targetDepartment?.decidedAtUtc
        ? formatDueDateTime(targetDepartment.decidedAtUtc, locale)
        : t('jobs.detail.pendingApproval', 'Onay Bekleyen'),
      displayMeta: targetDepartment?.approvedByDisplayName ?? undefined,
      dateTimeUtc: targetDepartment?.decidedAtUtc ?? null,
    })
  }

  if (wasRecoveredFromCancellation(detail) && detail.status !== 'Cancelled' && detail.status !== 'Rejected') {
    steps.push({
      id: 'cancelDate',
      label: t('jobs.detail.cancelledAt', 'İptal Tarihi'),
      displayValue: formatDateTime(detail.updatedAtUtc ?? null, locale),
      dateTimeUtc: detail.updatedAtUtc ?? null,
    })
  }

  if (detail.status === 'Completed') {
    steps.push({
      id: 'completionDate',
      label: t('jobs.detail.completedAt', 'Tamamlanma Tarihi'),
      displayValue: formatDateTime(detail.completedAtUtc ?? null, locale),
      dateTimeUtc: detail.completedAtUtc ?? null,
    })
  } else if (detail.status === 'Cancelled' || detail.status === 'Rejected') {
    steps.push({
      id: 'cancelDate',
      label: t('jobs.detail.cancelledAt', 'İptal Tarihi'),
      displayValue: formatDateTime(detail.updatedAtUtc ?? null, locale),
      dateTimeUtc: detail.updatedAtUtc ?? null,
    })
  }

  // Standart kullanıcının onaylanmış (Active) talebi turuncu "Durum / Yapılmakta" step'i
  // onay adımlarından sonra gösterir (card #1334); iptalden geri alınan yönetici talebi de
  // Durum adımını İptal Tarihi'nden sonra alır.
  // hideOwnerApproval yalnızca sahip-onay adımını gizler — Durum adımını engellemez
  // (Birime Gelen/Giden + yönetici Taleplerim, card #1535).
  const standardApprovedActive = detail.status === 'Active'
    && !isCitizenRequestJob(detail)
  if (!isTerminalStatus(detail.status) && !statusStepEarly && (managerCreatedActive || standardApprovedActive)) {
    steps.push({
      id: 'status',
      label: t('jobs.columns.status', 'Durum'),
      displayValue: t('jobs.statusLabel.inProgress', 'Yapılmakta'),
      dateTimeUtc: null,
    })
  }

  if (!isTerminalStatus(detail.status)) {
    steps.push({
      id: 'dueDate',
      label: t('jobs.columns.dueDate', 'Son Tarih'),
      displayValue: formatDueDateTime(detail.dueDateUtc, locale),
      dateTimeUtc: detail.dueDateUtc ?? null,
    })
  }

  return resolveStepStates(steps, detail)
}

export function isJobRecoveredFromCancellation(detail: JobDetail): boolean {
  return wasRecoveredFromCancellation(detail)
}
