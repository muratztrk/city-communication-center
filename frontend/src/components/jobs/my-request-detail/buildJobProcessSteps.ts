import type { TFunction } from 'i18next'
import type { JobDetail } from '../../../types/platform'
import {
  isCitizenRequestJob,
  shouldShowCitizenTargetApprovalDate,
} from '../../../utils/citizenRequests'
import { formatDateTime, formatDueDateTime } from './format'
import { getJobTargetApproverDisplayName } from '../../../utils/jobDetails'

export type JobProcessStepState = 'completed' | 'current' | 'pending' | 'upcoming' | 'terminal-success' | 'terminal-danger'

function isPendingApprovalJobStatus(status: string): boolean {
  return status === 'PendingOwnerApproval'
    || status === 'PendingExternalApproval'
}

/** Birime Gelen: Active + henüz görev yok → UI'da Onay Bekleyen (card #1535, vatandaş talebinde de card #1535 reopen). */
function isUnassignedActivePending(
  detail: JobDetail,
  options?: BuildJobProcessStepsOptions,
): boolean {
  return Boolean(options?.unassignedActiveAsPending)
    && detail.status === 'Active'
    && (detail.tasks?.length ?? 0) === 0
}

function shouldShowPendingStatusLayer(
  detail: JobDetail,
  options?: BuildJobProcessStepsOptions,
): boolean {
  if (!options?.hideOwnerApproval && !options?.ownerApprovalBeforeStatus) return false
  return isPendingApprovalJobStatus(detail.status) || isUnassignedActivePending(detail, options)
}

export type BuildJobProcessStepsOptions = {
  hideOwnerApproval?: boolean
  /** Gelen/Giden detayında sahip-birim onayını Durum katmanından önce gösterir. */
  ownerApprovalBeforeStatus?: boolean
  /** Standart kullanıcı/Giden detayında bekleyen hedef-birim onayını Durum'dan sonra gösterir. */
  showPendingTargetApprovalAfterStatus?: boolean
  /** Birime Gelen detayında Active + görev yok = mavi Durum/Onay Bekleyen */
  unassignedActiveAsPending?: boolean
}

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

/**
 * Tek hedefli birim dışı talepte sahip yöneticisinin onayı hedef kaydı da aynı anda otomatik
 * damgalar (ApproveRejectJobOwnerCommands "one-step approval") — bu damga hedef yöneticisinin
 * kararı DEĞİLDİR. Gerçek karar sinyali: hedef kayıttaki onaycı adının sahip onaycısından
 * farklı olması veya hedef birimde atanmış görev bulunması (card #1595 ile aynı sezgi;
 * cards #1603/#1606 "Onay Bekleyen" katmanı bu ayrıma dayanır).
 */
function hasRealTargetDecision(detail: JobDetail): boolean {
  const target = detail.departments.find(department => department.role === 'Target')
  if (!target?.decidedAtUtc) return false
  if (detail.requestType !== 'ExternalUnit' || isCitizenRequestJob(detail)) return true
  const ownerApprover = detail.departments.find(department => department.role === 'Owner')?.approvedByDisplayName ?? null
  if (target.approvedByDisplayName && target.approvedByDisplayName !== ownerApprover) return true
  return detail.tasks?.some(task => task.assignedDepartmentId === target.departmentId) ?? false
}

function wasRecoveredFromCancellation(detail: JobDetail): boolean {
  return Boolean(detail.cancelReason?.trim())
    && (detail.status === 'Active' || detail.status === 'Completed')
}

function resolveStepStates(
  steps: Omit<JobProcessStep, 'state'>[],
  detail: JobDetail,
  options?: BuildJobProcessStepsOptions,
): JobProcessStep[] {
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
  // Sahip onayının hedefe bastığı otomatik damga gerçek karar sayılmaz (cards #1603/#1606).
  const targetDecided = hasRealTargetDecision(detail)
  return steps.map(step => {
    // Hedef onay adımı, turuncu Durum adımından sonra da gelse onaylandıysa yeşil kalır (card #1345).
    if (step.id === 'targetApproval' && targetDecided) {
      return { ...step, state: 'completed' as const }
    }
    if (step.id === 'targetApproval' && options?.showPendingTargetApprovalAfterStatus && !targetDecided) {
      return { ...step, state: 'pending' as const }
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
      // Onay bekleyen taleplerde Durum katmanı mavi "pending" tonunda (card #1535 reopen).
      if (isPendingApprovalJobStatus(detail.status) || isUnassignedActivePending(detail, options)) {
        return { ...step, state: 'pending' as const }
      }
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
  options?: BuildJobProcessStepsOptions,
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
  // decidedAtUtc tek başına güvenilmez: tek hedefli dış talepte sahip onayı hedefi de otomatik
  // damgalar. Gerçek hedef kararı hasRealTargetDecision ile ayrıştırılır (cards #1603/#1606).
  const targetDecided = hasRealTargetDecision(detail)
  const showPendingTargetApproval = Boolean(options?.showPendingTargetApprovalAfterStatus)
    && !isCitizenRequestJob(detail)
    && detail.requestType === 'ExternalUnit'
    && Boolean(detail.departments.find(department => department.role === 'Owner')?.decidedAtUtc)
    && Boolean(targetDepartment)
    && !targetDecided
    && detail.status === 'Active'

  // Birim yöneticisinin oluşturduğu birim içi/birim dışı aktif taleplerde turuncu "Durum / Yapılmakta"
  // adımı onay beklerken Talep Tarihi'nin hemen arkasına gelir; hedef onaylandıysa hedef onay
  // adımından sonra gelir (cards #1275/#1345/#1357). İptalden geri alınan talepte İptal Tarihi
  // adımı Durum'dan önce kalmalı, o yüzden erken eklenmez.
  // Onay beklerken aynı erken katman mavi "Durum / Onay Bekleyen" olur (card #1535 reopen).
  const pendingStatusLayer = shouldShowPendingStatusLayer(detail, options)
  const statusDisplayValue = pendingStatusLayer
    || isPendingApprovalJobStatus(detail.status)
    ? t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen')
    : t('jobs.statusLabel.inProgress', 'Yapılmakta')
  const managerCreatedActive = detail.createdByRoleCode === 'Manager'
    && !isCitizenRequestJob(detail)
    && (detail.requestType === 'InternalUnit' || detail.requestType === 'ExternalUnit')
  const statusStepEarly = managerCreatedActive
    && !wasRecoveredFromCancellation(detail)
    && !(detail.requestType === 'ExternalUnit' && targetDecided)
    && !options?.ownerApprovalBeforeStatus
  if (statusStepEarly && !isTerminalStatus(detail.status)) {
    steps.push({
      id: 'status',
      label: t('jobs.columns.status', 'Durum'),
      displayValue: statusDisplayValue,
      dateTimeUtc: null,
    })
  }

  // Sahip onayı gizlenen eski tüketicilerde onay bekleyen Durum katmanını Talep Tarihi'nin
  // hemen arkasına koy — yönetici-oluşturmadıysa statusStepEarly kaçırırdı (card #1535).
  // Gelen/Giden yeni düzeninde ownerApprovalBeforeStatus bu adımı sahip onayının arkasına erteler.
  if (!statusStepEarly && pendingStatusLayer && !options?.ownerApprovalBeforeStatus && !isTerminalStatus(detail.status)) {
    steps.push({
      id: 'status',
      label: t('jobs.columns.status', 'Durum'),
      displayValue: t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen'),
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

  // Sahip onayı henüz yokken Durum/Onay Bekleyen, hemen üstteki sahip-onay adımıyla
  // mükerrer kalır — o durumda Durum katmanını ekleme (card #1629). Unassigned Active
  // ve PendingExternalApproval için mavi Durum katmanı korunur.
  if (!statusStepEarly && pendingStatusLayer && options?.ownerApprovalBeforeStatus && !isTerminalStatus(detail.status)) {
    const ownerStepShowsPendingApproval = !options?.hideOwnerApproval
      && !isCitizenRequestJob(detail)
      && detail.status === 'PendingOwnerApproval'
    if (!ownerStepShowsPendingApproval) {
      steps.push({
        id: 'status',
        label: t('jobs.columns.status', 'Durum'),
        displayValue: t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen'),
        dateTimeUtc: null,
      })
    }
  }

  if (shouldShowCitizenTargetApprovalDate(detail)) {
    steps.push({
      id: 'targetApproval',
      label: t('jobs.detail.targetManagerApprovalDate', 'Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi'),
      displayValue: targetDepartment?.decidedAtUtc
        ? formatDueDateTime(targetDepartment.decidedAtUtc, locale)
        : t('jobs.detail.pendingApproval', 'Onay Bekleyen'),
      displayMeta: getJobTargetApproverDisplayName(detail) ?? undefined,
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
  // Onay bekleyen (pendingStatusLayer) zaten erken eklendi — burada tekrarlama.
  const standardApprovedActive = detail.status === 'Active'
    && !isCitizenRequestJob(detail)
    && !pendingStatusLayer
  if (!isTerminalStatus(detail.status) && !statusStepEarly && !pendingStatusLayer
    && (managerCreatedActive || standardApprovedActive)) {
    steps.push({
      id: 'status',
      label: t('jobs.columns.status', 'Durum'),
      displayValue: statusDisplayValue,
      dateTimeUtc: null,
    })
  }

  if (showPendingTargetApproval) {
    steps.push({
      id: 'targetApproval',
      label: t('jobs.detail.targetManagerApprovalDate', 'Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi'),
      displayValue: t('jobs.detail.pendingApproval', 'Onay Bekleyen'),
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

  return resolveStepStates(steps, detail, options)
}

export function isJobRecoveredFromCancellation(detail: JobDetail): boolean {
  return wasRecoveredFromCancellation(detail)
}
