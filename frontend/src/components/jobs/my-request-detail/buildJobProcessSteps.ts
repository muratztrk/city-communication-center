import type { TFunction } from 'i18next'
import type { JobDetail } from '../../../types/platform'
import {
  isCitizenRequestJob,
  shouldShowCitizenTargetApprovalDate,
  countOpenWorkTasks,
  getCitizenRequestDetailStatusLabel,
} from '../../../utils/citizenRequests'
import { formatDateTime, formatDueDateTime } from './format'
import { formatOverdueInProgressStatus } from '../../../utils/localization'
import { getJobTargetApproverDisplayName } from '../../../utils/jobDetails'
import { isJobDueDateOverdue } from '../../../utils/dateTimePicker'

export type JobProcessStepState = 'completed' | 'current' | 'pending' | 'upcoming' | 'terminal-success' | 'terminal-danger'

function isPendingApprovalJobStatus(status: string): boolean {
  return status === 'PendingOwnerApproval'
    || status === 'PendingExternalApproval'
}

/** Birime Gelen: Active + henüz açık görev yok → UI'da Onay Bekleyen (card #1535, vatandaş talebinde de card #1535 reopen). */
function isUnassignedActivePending(
  detail: JobDetail,
  options?: BuildJobProcessStepsOptions,
): boolean {
  return Boolean(options?.unassignedActiveAsPending)
    && detail.status === 'Active'
    && countOpenWorkTasks(detail) === 0
}

function shouldShowPendingStatusLayer(
  detail: JobDetail,
  options?: BuildJobProcessStepsOptions,
): boolean {
  if (!options?.hideOwnerApproval && !options?.ownerApprovalBeforeStatus) return false
  return isPendingApprovalJobStatus(detail.status) || isUnassignedActivePending(detail, options)
}

/** Birim dışı talepte sahip onaylı, hedef onay beklerken Durum mükerrer (cards #1652/#1653/#1655). */
function shouldHideStatusWhileAwaitingTargetApproval(
  detail: JobDetail,
  targetDecided: boolean,
): boolean {
  if (isCitizenRequestJob(detail) || detail.requestType !== 'ExternalUnit') return false
  if (targetDecided) return false
  const ownerDecided = Boolean(detail.departments.find(department => department.role === 'Owner')?.decidedAtUtc)
  if (!ownerDecided) return false
  return detail.status === 'PendingExternalApproval' || detail.status === 'Active'
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
  | 'inProgressPeriod'
  | 'completionDate'
  | 'cancelDate'
  | 'dueDate'

export interface JobProcessStep {
  id: JobProcessStepId
  label: string
  displayValue: string
  displayMeta?: string
  dateTimeUtc?: string | null
  /** Terminal Yapılmakta aralığının ikinci zamanı (date • time - date • time, #2773/#2774). */
  endDateTimeUtc?: string | null
  state: JobProcessStepState
}

function isTerminalStatus(status: string): boolean {
  return status === 'Completed' || status === 'Cancelled' || status === 'Rejected'
}

/** Aktif talepte son tarih geçmişse Durum turuncu kalır (card #1644).
 * Onay bekleyen taleplerde aynı gün içinde saat aşımı "Geciken" sayılmaz;
 * takvim günü değişince geçerli olur (card #1819). */
function isActiveJobOverdue(detail: JobDetail): boolean {
  if (isTerminalStatus(detail.status)) return false
  return isJobDueDateOverdue(detail)
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
  // Klasik iptalden geri alma: cancelReason + Active/Completed.
  return Boolean(detail.cancelReason?.trim())
    && (detail.status === 'Active' || detail.status === 'Completed')
}

/** Mesaj Onayı "Talep Durumunu Değiştir" ile Active'e dönen vatandaş talebi (#2099/#2108). */
export function wasReopenedViaCitizenMessageApproval(detail: JobDetail): boolean {
  if (!isCitizenRequestJob(detail) || detail.status !== 'Active') return false
  // ReopenCommand: Completed → completedAtUtc korunur; Cancelled → cancelReason kalır.
  return Boolean(detail.completedAtUtc) || Boolean(detail.cancelReason?.trim())
}

function isRecoveredTimeline(detail: JobDetail): boolean {
  return wasRecoveredFromCancellation(detail) || wasReopenedViaCitizenMessageApproval(detail)
}

export function buildInProgressPeriodStep(
  t: TFunction,
  locale: string,
  previousUtc: string | null | undefined,
  nextUtc: string | null | undefined,
  assigneeName: string | null | undefined,
  dueDateUtc?: string | null,
): Omit<JobProcessStep, 'state'> {
  const overdueAtClose = Boolean(
    dueDateUtc
    && nextUtc
    && new Date(dueDateUtc).getTime() < new Date(nextUtc).getTime(),
  )
  const statusLabel = overdueAtClose
    ? formatOverdueInProgressStatus(t)
    : t('jobs.statusLabel.inProgress', 'Yapılmakta')
  const name = assigneeName?.trim()
  return {
    id: 'inProgressPeriod',
    label: name ? `${statusLabel} / ${name}` : statusLabel,
    displayValue: `${formatDateTime(previousUtc ?? null, locale)} - ${formatDateTime(nextUtc ?? null, locale)}`,
    dateTimeUtc: previousUtc ?? null,
    endDateTimeUtc: nextUtc ?? null,
  }
}

function resolveStepStates(
  steps: Omit<JobProcessStep, 'state'>[],
  detail: JobDetail,
  options?: BuildJobProcessStepsOptions,
): JobProcessStep[] {
  if (isRecoveredTimeline(detail)) {
    let foundCurrent = false
    return steps.map(step => {
      // İptal/Tamamlanma, Durum'tan önce gelse de sonra gelse terminal rengi korunsun (#2108).
      if (step.id === 'cancelDate') {
        return { ...step, state: 'terminal-danger' as const }
      }
      if (step.id === 'completionDate') {
        return { ...step, state: 'terminal-success' as const }
      }
      if (foundCurrent) {
        return { ...step, state: 'upcoming' as const }
      }
      if (step.id === 'status') {
        foundCurrent = true
        // Yapılmakta → mavi pending; Geciken → turuncu current (#2107).
        return { ...step, state: isActiveJobOverdue(detail) ? 'current' as const : 'pending' as const }
      }
      if (step.id === 'dueDate') {
        return { ...step, state: 'upcoming' as const }
      }
      // Reopen + henüz onaylanmamış hedef: yeşil completed değil, mavi pending (#6a6aecbc).
      if (step.id === 'targetApproval' && !step.dateTimeUtc) {
        return { ...step, state: 'pending' as const }
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
    // Sentetik hedef "Onay Bekleyen" → mavi pending; süresi geçmişte mavi yok (card #1645).
    // foundCurrent'dan önce: Durum Yapılmakta (current) sonrası da mavi kalabilsin.
    if (step.id === 'targetApproval' && options?.showPendingTargetApprovalAfterStatus && !targetDecided) {
      if (isActiveJobOverdue(detail)) {
        return { ...step, state: 'upcoming' as const }
      }
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
        // Onay Bekleyen → mavi; süresi geçmişte turuncu (card #1645).
        return { ...step, state: isActiveJobOverdue(detail) ? 'current' as const : 'pending' as const }
      }
      return { ...step, state: 'completed' as const }
    }
    if (step.id === 'targetApproval') {
      if (detail.status === 'PendingExternalApproval') {
        foundCurrent = true
        return { ...step, state: isActiveJobOverdue(detail) ? 'current' as const : 'pending' as const }
      }
      if (!ownerDecided && detail.status === 'PendingOwnerApproval') {
        return { ...step, state: 'upcoming' as const }
      }
      if (shouldShowCitizenTargetApprovalDate(detail)) {
        foundCurrent = true
        // Vatandaş hedef onayı beklerken de Onay Bekleyen → mavi (card #1645).
        return { ...step, state: isActiveJobOverdue(detail) ? 'current' as const : 'pending' as const }
      }
      return { ...step, state: ownerDecided ? 'completed' as const : 'upcoming' as const }
    }
    if (step.id === 'status') {
      foundCurrent = true
      // Geciken → turuncu (#1644). Yapılmakta + Onay Bekleyen → mavi pending
      // (#1651; #1645 turuncusunu geri alır, #1643 ile hizalı).
      if (isActiveJobOverdue(detail)) {
        return { ...step, state: 'current' as const }
      }
      return { ...step, state: 'pending' as const }
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
  const hideStatusAwaitingTarget = shouldHideStatusWhileAwaitingTargetApproval(detail, targetDecided)
  const jobOverdue = isActiveJobOverdue(detail)
  const inProgressLabel = t('jobs.statusLabel.inProgress', 'Yapılmakta')
  const pendingApprovalLabel = t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen')
  const overdueSuffix = t('jobs.statusLabel.overdue', 'Geciken')
  const statusDisplayValue = pendingStatusLayer || isPendingApprovalJobStatus(detail.status)
    ? jobOverdue
      ? `${pendingApprovalLabel} ${overdueSuffix}`
      : pendingApprovalLabel
    : jobOverdue
      ? `${inProgressLabel} (${overdueSuffix})`
      : inProgressLabel
  const managerCreatedActive = detail.createdByRoleCode === 'Manager'
    && !isCitizenRequestJob(detail)
    && (detail.requestType === 'InternalUnit' || detail.requestType === 'ExternalUnit')
  const statusStepEarly = managerCreatedActive
    && !isRecoveredTimeline(detail)
    && !(detail.requestType === 'ExternalUnit' && targetDecided)
    && !options?.ownerApprovalBeforeStatus
    && !hideStatusAwaitingTarget
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
  // Mesaj Onayı reopen'da Durum, İptal/Tamamlanma'dan SONRA eklenir (#2108) — erken ekleme yok.
  if (!statusStepEarly && pendingStatusLayer && !options?.ownerApprovalBeforeStatus
    && !hideStatusAwaitingTarget && !isTerminalStatus(detail.status)
    && !isRecoveredTimeline(detail)) {
    steps.push({
      id: 'status',
      label: t('jobs.columns.status', 'Durum'),
      displayValue: statusDisplayValue,
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
  // ve PendingExternalApproval için mavi Durum katmanı korunur — istisna: birim dışı +
  // hedef onay beklerken de gizlenir (cards #1652/#1653/#1655; yönetici veya standart kullanıcı).
  if (!statusStepEarly && pendingStatusLayer && options?.ownerApprovalBeforeStatus
    && !hideStatusAwaitingTarget && !isTerminalStatus(detail.status)
    && !isRecoveredTimeline(detail)) {
    const ownerStepShowsPendingApproval = !options?.hideOwnerApproval
      && !isCitizenRequestJob(detail)
      && detail.status === 'PendingOwnerApproval'
    if (!ownerStepShowsPendingApproval) {
      steps.push({
        id: 'status',
        label: t('jobs.columns.status', 'Durum'),
        displayValue: statusDisplayValue,
        dateTimeUtc: null,
      })
    }
  }

  if (shouldShowCitizenTargetApprovalDate(detail) && !showPendingTargetApproval) {
    // Gerçek hedef kararı yokken otomatik damgalı tarih + ayrıca "Onay Bekleyen" mükerrer
    // kalıyordu; o durumda yalnız showPendingTargetApproval adımı kullanılır (cards #1641/#1642).
    steps.push({
      id: 'targetApproval',
      label: t('jobs.detail.targetManagerApprovalDate', 'Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi'),
      displayValue: targetDepartment?.decidedAtUtc
        ? formatDueDateTime(targetDepartment.decidedAtUtc, locale)
        : t('jobs.detail.pendingApproval', 'Onay Bekleyen'),
      displayMeta: getJobTargetApproverDisplayName(detail) ?? undefined,
      dateTimeUtc: targetDepartment?.decidedAtUtc ?? null,
    })
  } else if (
    wasReopenedViaCitizenMessageApproval(detail)
    && isCitizenRequestJob(detail)
    && targetDepartment
    && !showPendingTargetApproval
    && !steps.some(step => step.id === 'targetApproval')
  ) {
    // Mesaj Onayı reopen: hedef onay tarihi varsa göster; yoksa görev atama zamanı;
    // ikisi de yoksa Onay Bekleyen — Onayla ile atama sonrası tarih dolar (#6a6aecbc).
    const decidedAt = targetDepartment.decidedAtUtc
      ?? detail.tasks?.find(task =>
        task.assignedDepartmentId === targetDepartment.departmentId
        && Boolean(task.assignedAtUtc),
      )?.assignedAtUtc
      ?? null
    const approverMeta = getJobTargetApproverDisplayName(detail)
      ?? detail.tasks?.find(task =>
        task.assignedDepartmentId === targetDepartment.departmentId
        && Boolean(task.assigningManagerDisplayName),
      )?.assigningManagerDisplayName
      ?? undefined
    steps.push({
      id: 'targetApproval',
      label: t('jobs.detail.targetManagerApprovalDate', 'Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi'),
      displayValue: decidedAt
        ? formatDueDateTime(decidedAt, locale)
        : t('jobs.detail.pendingApproval', 'Onay Bekleyen'),
      displayMeta: decidedAt ? approverMeta : undefined,
      dateTimeUtc: decidedAt,
    })
  }

  if (isRecoveredTimeline(detail) && detail.status !== 'Cancelled' && detail.status !== 'Rejected') {
    if (detail.cancelReason?.trim()) {
      steps.push({
        id: 'cancelDate',
        label: t('jobs.detail.cancelledAt', 'İptal Tarihi'),
        displayValue: formatDateTime(detail.updatedAtUtc ?? null, locale),
        dateTimeUtc: detail.updatedAtUtc ?? null,
      })
    } else if (detail.completedAtUtc) {
      steps.push({
        id: 'completionDate',
        label: t('jobs.detail.completedAt', 'Tamamlanma Tarihi'),
        displayValue: formatDateTime(detail.completedAtUtc, locale),
        dateTimeUtc: detail.completedAtUtc,
      })
    }
  }

  if (
    (detail.status === 'Completed' || detail.status === 'Cancelled' || detail.status === 'Rejected')
    && !isRecoveredTimeline(detail)
  ) {
    const previousUtc = [...steps].reverse().find(step => Boolean(step.dateTimeUtc))?.dateTimeUtc
      ?? detail.createdAtUtc
    const nextUtc = detail.status === 'Completed'
      ? (detail.completedAtUtc ?? null)
      : (detail.updatedAtUtc ?? null)
    const assigneeNames = [...new Set(
      (detail.tasks ?? [])
        .map(task => task.assignedUserDisplayName)
        .filter((name): name is string => Boolean(name)),
    )]
    steps.push(buildInProgressPeriodStep(
      t,
      locale,
      previousUtc,
      nextUtc,
      assigneeNames.join(', ') || null,
      detail.dueDateUtc,
    ))
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

  // Vatandaş talebi Mesaj Onayı "Talep Durumunu Değiştir" ile Active'e dönünce
  // İptal/Tamamlanma tarihinden sonra standart Yapılmakta katmanı (#2099/#2108).
  if (
    wasReopenedViaCitizenMessageApproval(detail)
    && !steps.some(step => step.id === 'status')
  ) {
    steps.push({
      id: 'status',
      label: t('jobs.columns.status', 'Durum'),
      displayValue: statusDisplayValue,
      dateTimeUtc: null,
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
    && !hideStatusAwaitingTarget
    && (managerCreatedActive || standardApprovedActive)) {
    steps.push({
      id: 'status',
      label: t('jobs.columns.status', 'Durum'),
      displayValue: statusDisplayValue,
      dateTimeUtc: null,
    })
  }

  if (
    isCitizenRequestJob(detail)
    && detail.status === 'Active'
    && !steps.some(step => step.id === 'status')
  ) {
    steps.push({
      id: 'status',
      label: t('jobs.columns.status', 'Durum'),
      displayValue: getCitizenRequestDetailStatusLabel(t, detail),
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

  // Aktif taleplerde Durum’dan sonra; terminalde Tamamlanma/İptal’den sonra (#2785/#2786).
  steps.push({
    id: 'dueDate',
    label: t('jobs.columns.dueDate', 'Son Tarih'),
    displayValue: formatDueDateTime(detail.dueDateUtc, locale),
    dateTimeUtc: detail.dueDateUtc ?? null,
  })

  return resolveStepStates(steps, detail, options)
}

export function isJobRecoveredFromCancellation(detail: JobDetail): boolean {
  return isRecoveredTimeline(detail)
}
