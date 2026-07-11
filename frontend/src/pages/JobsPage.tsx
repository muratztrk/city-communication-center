import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '../hooks/useSortable'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import type React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Check, ClipboardList, FileText, Info, MessageSquareText, Printer, Search, Send, PenLine, X as XIcon, XCircle } from 'lucide-react'
import { DueDatePill } from '../components/ui/due-date-pill'
import { GridExtraTimeMarkers } from '../components/ui/extra-time-markers'
import { DateCell } from '../components/ui/date-cell'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { invalidateJobs, invalidateTasks } from '../api/cacheInvalidation'
import { queryKeys } from '../api/queryKeys'
import { getActiveDepartmentId } from '../api/http'
import { AttachmentSection } from '../components/ui/AttachmentSection'
import { AddressDetailFields } from '../components/ui/AddressDetailFields'
import { Button } from '../components/ui/button'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { DisabledActionButton } from '../components/ui/DisabledActionButton'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { RichTextContent } from '../components/ui/RichTextContent'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { Department, JobDepartmentInfo, JobDetail, JobListScope, JobSummary, SocialMessage, User } from '../types/platform'
import { formatJobDestinationsWithAssignees, formatRequestApproverDisplay, shouldShowJobStatusActorName, shouldShowRequestApproverField } from '../utils/jobDetails'
import { JobProjectConfirmationPrompt, JobProjectDeclaredNotice } from '../components/JobProjectModalSection'
import { JobProjectValue } from '../utils/jobProjectDisplay'
import { formatJobProjectLabel } from '../utils/jobProjectLabel'
import { formatAuditNotes, getAuditActionLabel, getLocale, getPriorityColorClass, getPriorityLabel, getStatusPillClass, getJobStatusTone, getTaskStatusLabel, getSocialChannelLabel } from '../utils/localization'
import { getSelfRequestedOwnerUserId } from '../utils/ownerTaskRequest'
import { getRequestEditPath } from '../utils/requestEditPath'
import {
  isCitizenRequestJob,
  canShowCitizenWhatsAppConversation,
  formatCitizenRequestNumber,
  formatCitizenPhoneDisplay,
  getCitizenRequestStatusLabel,
  shouldShowCitizenTargetApprovalDate,
} from '../utils/citizenRequests'
import { getExternalUnitOwnerDisplayStatus, getExternalUnitTargetDisplayStatus } from '../utils/externalUnitRequests'
import { formatJobDisplayNumberText } from '../utils/requestNumberText'
import { isAssignableDepartmentUser } from '../utils/userDepartments'
import { isPresidencyLevelDepartment } from '../utils/departments'
import { hasCitizenRequestManagerRole } from '../utils/roleAccess'
import { matchesBannerSearch } from '../utils/bannerSearch'
import { ChannelIcon } from '../components/ui/channel-icon'
import { getChannelLabelColor } from '../utils/channelColors'
import { WhatsAppConversationModal } from '../components/WhatsAppConversationModal'
import { MyRequestDetailModal } from '../components/jobs/my-request-detail/MyRequestDetailModal'
import { MyRequestSectionHeading } from '../components/jobs/my-request-detail/MyRequestSectionHeading'
import { MyRequestTaskDetailsSection } from '../components/jobs/my-request-detail/MyRequestTaskDetailsSection'
import { buildJobProcessSteps, isJobRecoveredFromCancellation } from '../components/jobs/my-request-detail/buildJobProcessSteps'
import { JobProcessTimeline } from '../components/jobs/my-request-detail/JobProcessTimeline'
import { buildMyRequestEditDraft, type MyRequestEditDraft } from '../components/jobs/my-request-detail/myRequestEditDraft'
import { TablePagination } from '../components/ui/table-pagination'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { printHtmlDocument } from '../utils/printDocument'
import { isReporterCreated, reporterGridValueClass, hasConcreteNumberDisplay } from '../utils/reporterHighlight'
import { richTextToPlainText } from '../utils/richText'
import { normalizeTitleCaseField } from '../utils/textNormalization'

interface ScopeChipFiltersProps {
  searchText: string
  filterFrom: string
  filterTo: string
  onSearch: (v: string) => void
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}
function ScopeChipFilters({ searchText, filterFrom, filterTo, onSearch, onFromChange, onToChange }: ScopeChipFiltersProps) {
  return (
    <div className="scope-chips-filters">
      <div className="scope-chip-search-wrap">
      <Search className="scope-chip-search-icon size-3 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          className="scope-chip-search-input"
          placeholder="Ara..."
          value={searchText}
          onChange={e => onSearch(e.target.value)}
        />
        {searchText && (
        <button type="button" onClick={() => onSearch('')} className="scope-chip-search-clear shrink-0 font-extrabold transition-colors" aria-label="Temizle">
            <XIcon className="size-3.5" strokeWidth={3} />
          </button>
        )}
      </div>
      <ScopeChipDateRange from={filterFrom} to={filterTo} onFromChange={onFromChange} onToChange={onToChange} forceDown />
    </div>
  )
}

const EXTERNAL_SCOPES: { value: JobListScope; labelKey: string }[] = [
  { value: 'department-pool', labelKey: 'jobs.scopes.departmentPool' },
  { value: 'all', labelKey: 'jobs.scopes.all' },
]

type MyRequestsView = 'pending' | 'approved' | 'external-pending' | 'in-progress' | 'overdue' | 'completed' | 'rejected' | 'all'
type RequestFlowFilter = 'internal' | 'external' | 'all'
type DepartmentOutgoingView = 'pending' | 'approved' | 'in-progress' | 'overdue' | 'completed' | 'rejected' | 'all'

const MY_REQUEST_VIEWS: { value: MyRequestsView; labelKey: string }[] = [
  { value: 'external-pending', labelKey: 'jobs.myViews.externalPending' },
  { value: 'in-progress', labelKey: 'jobs.myViews.inProgress' },
  { value: 'overdue', labelKey: 'jobs.myViews.overdue' },
  { value: 'pending', labelKey: 'jobs.myViews.pending' },
  { value: 'approved', labelKey: 'jobs.myViews.approved' },
  { value: 'completed', labelKey: 'jobs.myViews.completed' },
  { value: 'rejected', labelKey: 'jobs.myViews.rejected' },
  { value: 'all', labelKey: 'jobs.myViews.all' },
]

const REQUEST_FLOW_FILTERS: { value: RequestFlowFilter; labelKey: string }[] = [
  { value: 'internal', labelKey: 'filters.requestFlow.internal' },
  { value: 'external', labelKey: 'filters.requestFlow.external' },
  { value: 'all', labelKey: 'filters.requestFlow.all' },
]

const DEPARTMENT_OUTGOING_VIEWS: { value: DepartmentOutgoingView; labelKey: string }[] = [
  { value: 'pending', labelKey: 'jobs.outgoingViews.pending' },
  { value: 'overdue', labelKey: 'jobs.outgoingViews.overdue' },
  { value: 'approved', labelKey: 'jobs.outgoingViews.approved' },
  { value: 'in-progress', labelKey: 'jobs.outgoingViews.inProgress' },
  { value: 'completed', labelKey: 'jobs.outgoingViews.completed' },
  { value: 'rejected', labelKey: 'jobs.outgoingViews.rejected' },
  { value: 'all', labelKey: 'jobs.outgoingViews.all' },
]

function getScopeChipColorClass(value: string): string {
  if (value === 'pending' || value === 'pending-approval') return 'scope-chip--pending'
  if (value === 'external-pending') return 'scope-chip--external-pending'
  if (value === 'approved') return 'scope-chip--approved'
  if (value === 'in-progress' || value === 'overdue') return 'scope-chip--in-progress'
  if (value === 'completed') return 'scope-chip--completed'
  if (value === 'rejected') return 'scope-chip--rejected'
  if (value === 'all') return 'scope-chip--all'
  return ''
}

function isPreApprovalStatus(status: string): boolean {
  return status === 'Draft' || status === 'PendingOwnerApproval' || status === 'PendingExternalApproval' || status === 'RevisionRequested'
}

function canOperatorEditPendingExternalJob(
  role: string | undefined,
  job: { requestType: string; sourceType: string; status: string; taskCount?: number; tasks?: unknown[] | null },
): boolean {
  if (role !== 'Operator') return false
  if (job.requestType !== 'ExternalUnit') return false
  if (job.sourceType !== 'SocialMessage' && job.sourceType !== 'CitizenRequest' && job.sourceType !== 'EDevlet') return false
  const taskCount = job.taskCount ?? job.tasks?.length ?? 0
  return job.status === 'PendingExternalApproval'
    || (job.status === 'Active' && taskCount === 0)
}

function isClosedJobStatus(status: string): boolean {
  return status === 'Completed' || status === 'Cancelled' || status === 'Rejected' || status === 'RevisionRequested'
}

function isJobOverdue(job: JobSummary): boolean {
  return job.dueDateUtc != null && new Date(job.dueDateUtc).getTime() < Date.now()
}

function getJobStatusLabel(t: TFunction, status: string): string {
  return t(`enum.jobStatus.${status}`, { defaultValue: status })
}

function getJobDisplayStatus(
  t: TFunction,
  job: Pick<JobSummary, 'status' | 'dueDateUtc' | 'taskCount' | 'requestType' | 'sourceType'>,
): string {
  if (isCitizenRequestJob(job)) {
    return getCitizenRequestStatusLabel(t, job)
  }
  if (job.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (job.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (job.status === 'Rejected') return t('jobs.statusLabel.rejected', 'Reddedildi')
  if (job.status === 'RevisionRequested') return t('jobs.statusLabel.returned', 'İade Edildi')
  if (job.dueDateUtc != null && new Date(job.dueDateUtc).getTime() < Date.now()) {
    return t('jobs.statusLabel.overdue', 'Son Tarihi Geçmiş')
  }
  const externalOwnerStatus = getExternalUnitOwnerDisplayStatus(t, job)
  if (externalOwnerStatus) return externalOwnerStatus
  if (job.status === 'Active') return t('jobs.statusLabel.inProgress', 'Yapılmakta')
  return t('jobs.statusLabel.pending', 'Bekleyen')
}


function getDepartmentRoleTone(role: string) {
  if (role === 'Owner') return 'info' as const
  if (role === 'Target') return 'success' as const
  return 'neutral' as const
}

function sortJobDepartments(departments: JobDepartmentInfo[]) {
  const order: Record<string, number> = { Owner: 0, Target: 1, Coordinating: 2 }
  return [...departments].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9))
}

function getTargetJobDepartments(job: JobSummary) {
  return sortJobDepartments(job.departments ?? []).filter(department => department.role === 'Target' || department.role === 'Coordinating')
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) return locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified'
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDueDateTime(value: string | null, locale: string) {
  if (!value) return locale.startsWith('tr') ? 'Onay Bekleyen' : 'Pending Approval'
  return formatDateTime(value, locale)
}

function formatApprovalDateText(value: string, approverName: string | null | undefined) {
  return approverName ? `${value} (${approverName})` : value
}

function toDateTimePickerValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function formatJobDisplayNumber(job: JobSummary): string {
  // Vatandaş talepleri her zaman VT- ile gösterilir; T-{jobNumber}'a dönüşemez (card #1077).
  if (isCitizenRequestJob(job)) {
    const year = job.citizenRequestNumberYear ?? job.jobNumberYear ?? new Date().getFullYear()
    return job.citizenRequestNumber != null
      ? `VT-${year}-${job.citizenRequestNumber}`
      : `VT-${year}-Onay Bekleyen`
  }
  if (job.jobNumber != null && job.jobNumberYear != null) {
    return `T-${job.jobNumberYear}-${job.jobNumber}`
  }
  const year = job.jobNumberYear ?? new Date().getFullYear()
  return `T-${year}-Onay Bekleyen`
}

const JOB_SEARCH_COLUMN_KEYS = [
  'jobNumber',
  'title',
  'status',
  'priority',
  'createdAtUtc',
  'dueDateUtc',
  'ownerDecidedAtUtc',
  'completedAtUtc',
  'updatedAtUtc',
  'destinationText',
  'ownerDepartmentName',
  'assignedUserDisplayName',
  'createdByDisplayName',
  'cancelReturnStatus',
] as const

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function stripHtmlTags(value: string | null | undefined) {
  if (!value) return ''
  const parser = new DOMParser()
  const parsed = parser.parseFromString(value, 'text/html')
  return (parsed.body.innerText || parsed.body.textContent || '').replace(/\u00a0/g, ' ').trim()
}

function buildPrintJobStatusLabel(
  detail: JobDetail,
  t: TFunction,
  options?: { incomingTargetView?: boolean },
): string {
  let status: string
  if (isCitizenRequestJob(detail)) {
    status = getCitizenRequestStatusLabel(t, detail)
  } else if (options?.incomingTargetView) {
    status = getExternalUnitTargetDisplayStatus(t, detail)
      ?? (detail.status === 'Active' && detail.tasks.length === 0
        ? t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen')
        : detail.status === 'Active'
          ? 'Yapılmakta'
          : detail.status === 'Completed'
            ? 'Tamamlanmış'
            : getJobStatusLabel(t, detail.status))
  } else {
    status = getExternalUnitOwnerDisplayStatus(t, detail)
      ?? (detail.status === 'Active'
        ? t('jobs.statusLabel.inProgress', 'Yapılmakta')
        : detail.status === 'Completed'
          ? 'Tamamlanmış'
          : getJobStatusLabel(t, detail.status))
  }
  if (shouldShowJobStatusActorName(detail)) {
    status += ` (${detail.statusActorDisplayName})`
  }
  if ((detail.status === 'Cancelled' || detail.status === 'Rejected') && detail.cancelReason) {
    status += ` — İptal Notu: ${detail.cancelReason}`
  }
  if (detail.status === 'Completed' && detail.completionNote) {
    status += ` — Tamamlama Notu: ${richTextToPlainText(detail.completionNote)}`
  }
  return status
}

function buildPrintTaskDetailSections(detail: JobDetail, locale: string, t: TFunction): string {
  if (detail.tasks.length === 0) {
    return '<div class="section"><div class="section-title">Görev Detayları</div><p style="color:#888;font-size:11px">Görev yok</p></div>'
  }

  const taskBlocks = detail.tasks.map((task, index) => {
    const taskLocation = [task.ownerDepartmentName ?? detail.ownerDepartmentName, detail.createdByDisplayName ?? task.createdByDisplayName]
      .filter(Boolean)
      .join(' / ') || '—'
    const taskType = task.jobSourceType === 'Routine'
      ? t('tasks.type.routine', 'Rutin')
      : task.assigningManagerDisplayName
        ? `${t('tasks.type.assigned', 'Atanmış')} (${task.assigningManagerDisplayName})`
        : t('tasks.type.assigned', 'Atanmış')
    const taskNumber = task.taskNumber != null
      ? `G-${task.taskNumberYear ?? new Date().getFullYear()}-${task.taskNumber}`
      : '—'
    const owner = task.assignedUserDisplayName ?? task.ownerDisplayName ?? task.assignedDepartmentName ?? '—'
    let statusText = getTaskStatusLabel(t, task.currentStatus)
    if (task.currentStatus === 'Cancelled' && task.revisionReason) {
      statusText += ` — İptal Notu: ${task.revisionReason}`
    }
    if (task.currentStatus === 'Completed' && task.notes) {
      statusText += ` — Tamamlama Notu: ${richTextToPlainText(task.notes)}`
    }

    const rows: Array<[string, string]> = [
      [t('tasks.columns.taskNo', 'Görev No'), taskNumber],
      [t('tasks.columns.title', 'Görev Başlığı'), task.title],
      [t('tasks.columns.requestLocation', 'Talep Yeri / Oluşturan'), taskLocation],
      [t('tasks.columns.owner', 'Görev Sahibi'), owner],
      [t('tasks.columns.taskType', 'Görev Tipi'), taskType],
      [t('tasks.columns.priority', 'Öncelik'), getPriorityLabel(t, task.priority)],
      [t('tasks.columns.status', 'Durum'), statusText],
      [t('tasks.columns.taskDate', 'Görev Tarihi'), formatDateTime(task.createdAtUtc ?? null, locale)],
    ]
    if (task.currentStatus === 'Completed') {
      rows.push([t('tasks.columns.completedAt', 'Tamamlanma Tarihi'), formatDateTime(task.completedAtUtc ?? null, locale)])
    } else if (task.currentStatus === 'Cancelled') {
      rows.push([t('tasks.columns.cancelledAt', 'İptal Tarihi'), formatDateTime(task.updatedAtUtc ?? null, locale)])
    }
    rows.push([t('tasks.columns.dueDate', 'Son Tarih'), formatDateTime(task.dueDateUtc, locale)])

    const tableRows = rows
      .map(([label, value]) => `<tr><th>${escHtml(label)}</th><td>${escHtml(value)}</td></tr>`)
      .join('')
    const separator = index > 0 ? 'margin-top:1.25rem;padding-top:1.25rem;border-top:1px dashed #cbd5e1' : ''

    return `<div style="${separator}">
      <div class="subsection-title">Görev ${index + 1}</div>
      <table><tbody>${tableRows}</tbody></table>
    </div>`
  }).join('')

  return `<div class="section">
    <div class="section-title">${escHtml(t('tasks.detail.title', 'Görev Detayları'))} (${detail.tasks.length})</div>
    ${taskBlocks}
  </div>`
}

function printJobDetail(
  detail: JobDetail,
  locale: string,
  t: TFunction,
  options?: { incomingTargetView?: boolean; myRequestView?: boolean },
) {
  const fd = (d: string | null | undefined) => formatDateTime(d ?? null, locale)
  const jobDisplayNumber = detail.jobNumber != null && detail.jobNumberYear != null
    ? `T-${detail.jobNumberYear}-${detail.jobNumber}`
    : `T-${detail.jobNumberYear ?? new Date().getFullYear()}-Onay Bekleyen`
  const ownerApprovalDate = detail.departments.find(department => department.role === 'Owner')?.decidedAtUtc ?? null
  const targetApprovalDate = detail.departments.find(department => department.role === 'Target')?.decidedAtUtc ?? null
  const ownerDepartment = detail.departments.find(department => department.role === 'Owner')
  const targetDepartment = detail.departments.find(department => department.role === 'Target')
  const requestDetailRows: Array<[string, string]> = [
    ['Talep No', jobDisplayNumber],
    ['Talep Başlığı', detail.title],
    ['Talep Yeri / Oluşturan', [detail.ownerDepartmentName, detail.createdByDisplayName].filter(Boolean).join(' / ') || '—'],
    ...(options?.myRequestView || !shouldShowRequestApproverField(detail)
      ? []
      : [['Talebi Onaylayan', formatRequestApproverDisplay(detail) ?? '—'] as [string, string]]),
    ['Talep Yapılan Birim', formatJobDestinationsWithAssignees(detail)],
    ['Proje mi', formatJobProjectLabel(detail, t)],
    ['Öncelik', getPriorityLabel(t, detail.priority)],
    ['Durum', buildPrintJobStatusLabel(detail, t, options)],
    ['Talep Tarihi', fd(detail.createdAtUtc)],
    ...(isCitizenRequestJob(detail) ? [] : [['Talebin Birim Yöneticisinin Onay Tarihi', formatApprovalDateText(fd(ownerApprovalDate), ownerDepartment?.approvedByDisplayName)] as [string, string]]),
    ...(shouldShowCitizenTargetApprovalDate(detail)
      ? [['Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi', formatApprovalDateText(fd(targetApprovalDate), targetDepartment?.approvedByDisplayName)] as [string, string]]
      : []),
    ...(detail.status === 'Completed'
      ? [['Tamamlanma Tarihi', fd(detail.completedAtUtc)] as [string, string]]
      : detail.status === 'Cancelled'
        ? [['İptal Tarihi', fd(detail.updatedAtUtc ?? null)] as [string, string]]
        : []),
    ['Son Tarih Bilgisi', fd(detail.dueDateUtc)],
  ]
  const requestDetailTable = requestDetailRows
    .map(([label, value]) => `<tr><th>${escHtml(label)}</th><td>${escHtml(value)}</td></tr>`)
    .join('')
  const addressFields: Array<[string, string | null | undefined]> = [
    ['Mahalle', detail.neighborhood],
    ['Cadde / Sokak / Bulvar', detail.street],
    ['Açık Adres', detail.openAddress],
  ]
  const addressRows = addressFields
    .map(([label, value]) => `<tr><th>${escHtml(label)}</th><td>${escHtml(value?.trim() || '—')}</td></tr>`)
    .join('')
  const managerNote = detail.managerNote?.trim()
  const description = stripHtmlTags(detail.description)
  const taskDetailSections = buildPrintTaskDetailSections(detail, locale, t)
  const attachItems = (detail.attachments ?? []).map(a => `<li>${escHtml(a.fileName)} (${(a.fileSizeBytes / 1024).toFixed(1)} KB)</li>`).join('')
  printHtmlDocument(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${escHtml(jobDisplayNumber)}</title><style>
    @page{margin:0}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:2rem;margin:0}
    h1{font-size:18px;margin:4px 0 8px}
    .kicker{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#666}
    .meta{font-size:11px;color:#444;margin-bottom:1rem;line-height:1.7}
    .section{margin-top:1.5rem}
    .section-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #9ca3af;padding-bottom:3px;margin-bottom:8px;color:#333}
    .subsection-title{font-size:11px;font-weight:bold;color:#475569;margin:10px 0 6px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #9ca3af;padding:4px 8px;text-align:left}
    th{width:34%}
    th{background:#f0f0f0;font-weight:bold}
    .desc{border:1px solid #9ca3af;padding:8px;border-radius:3px;background:#fafafa;font-size:11px;line-height:1.6}
    .footer{margin-top:2rem;font-size:10px;color:#aaa}
    .page-number{display:none}
    @media print{body{padding:1.5cm}.page-number{display:block;position:fixed;bottom:0.6cm;right:1.5cm;font-size:10px;color:#444}}
  </style></head><body>
  <div class="section">
    <div class="section-title">Talep Detayları</div>
    <table><tbody>${requestDetailTable}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Açıklama</div>
    <div class="desc">${description ? escHtml(description).replace(/\n/g, '<br/>') : '<em>Açıklama yok</em>'}</div>
  </div>
  <div class="section">
    <div class="section-title">Adres Bilgileri</div>
    <table><tbody>${addressRows}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Yönetici Notu</div>
    <div class="desc">${managerNote ? escHtml(managerNote).replace(/\n/g, '<br/>') : '<em>Talep için yönetici notu bulunmamaktadır.</em>'}</div>
  </div>
  <div class="section">
    <div class="section-title">Ekler / Fotoğraflar (${(detail.attachments ?? []).length})</div>
    ${attachItems ? `<ul style="font-size:11px;margin:4px 0;padding-left:1.2rem">${attachItems}</ul>` : '<p style="color:#888;font-size:11px">Talep için ek/fotoğraf bulunmamaktadır.</p>'}
  </div>
  ${taskDetailSections}
  <div class="footer">Yazdırma tarihi: ${new Date().toLocaleString(locale)}</div>
  <div class="page-number">1 / 1</div>
  </body></html>`)
}

function getMyRequestsView(value: string | null, isManager: boolean, isReporter: boolean): MyRequestsView {
  if (value === 'returned') return 'rejected'
  if (isManager) {
    // Yöneticiler Taleplerim ekranına girdiğinde varsayılan olarak hedef birim onayı bekleyen
    // birim dışı talepleri görür; personel atanınca kayıt Yapılmakta Olan'a geçer.
    if (value === 'in-progress' || value === 'overdue' || value === 'completed' || value === 'rejected' || value === 'all') return value
    return 'external-pending'
  }
  if (isReporter) {
    return value === 'in-progress' || value === 'overdue' || value === 'completed' || value === 'rejected' || value === 'all' ? value : 'pending'
  }
  return value === 'approved' || value === 'overdue' || value === 'completed' || value === 'rejected' || value === 'all' ? value : 'pending'
}

function getRequestFlowFilter(value: string | null): RequestFlowFilter {
  return value === 'internal' || value === 'external' ? value : 'all'
}

function getDepartmentOutgoingView(value: string | null): DepartmentOutgoingView {
  return value === 'approved' || value === 'in-progress' || value === 'overdue' || value === 'completed' || value === 'rejected' || value === 'all'
    ? value
    : 'pending'
}

function matchesRequestFlow(requestType: JobSummary['requestType'], filter: RequestFlowFilter): boolean {
  if (filter === 'internal') return requestType === 'InternalUnit'
  if (filter === 'external') return requestType === 'ExternalUnit'
  return requestType === 'InternalUnit' || requestType === 'ExternalUnit'
}

function filterMyRequests(jobs: JobSummary[], view: MyRequestsView, isReporter = false, isManager = false): JobSummary[] {
  if (view === 'all') return jobs
  if (view === 'overdue') return jobs.filter(job => !isClosedJobStatus(job.status) && isJobOverdue(job))

  if (view === 'external-pending') {
    // Talep, oluşturan birimde onaylandıktan sonra hedef birim yöneticisinde "Birime Gelen →
    // Onay Bekleyen" durumundayken burada görünür: ya hedef birim onayı bekliyor
    // (PendingExternalApproval) ya da hedef birimin havuzunda personel ataması bekliyor
    // (Active, henüz görev yok). Talep sahibinin aktif birimi hedef değil (sahip) olduğundan
    // hedef-birim eşleşmesi aranmaz (card 459).
    return jobs.filter(job =>
      job.requestType === 'ExternalUnit'
      && (job.status === 'PendingExternalApproval' || (job.status === 'Active' && job.taskCount === 0))
      && !isJobOverdue(job))
  }

  if (view === 'pending') {
    // Üst Düzey Yönetici: oluşturulmuş ama henüz personel atanmamış (görev yok) talepler bekliyor sayılır.
    return jobs.filter(job =>
      (job.status === 'Draft' || job.status === 'PendingOwnerApproval' ||
      job.status === 'PendingExternalApproval' || (isReporter && job.status === 'Active' && job.taskCount === 0))
      && !isJobOverdue(job))
  }

  if (view === 'approved') {
    return jobs.filter(job => job.status === 'Active' && !isJobOverdue(job))
  }

  if (view === 'in-progress') {
    // Yönetici/üst düzey yönetici: hedef birim yöneticisi personel atayıp görev oluşturunca
    // "Yapılmakta Olan"a düşer.
    if (isManager) {
      // Taleplerim → "Yapılmakta Olan Taleplerim" ve Birimden Giden → "Yapılmakta Olan" aynı ölçüt:
      // Aktif + görev oluşmuş. Yönetici kendi birim dışı talebinde aktif birim sahip (hedef değil)
      // olduğundan hedef-birim eşleşmesi aranmaz (card 6a39867b).
      return jobs.filter(job =>
        job.status === 'Active'
        && job.taskCount > 0
        && !isJobOverdue(job))
    }
    if (isReporter) {
      return jobs.filter(job => job.status === 'Active' && job.taskCount > 0 && !isJobOverdue(job))
    }
    // Yönetici/sorumlu: bekleyen (onay) + onaylanmış (aktif) talepler birlikte.
    return jobs.filter(job =>
      (job.status === 'Draft' || job.status === 'PendingOwnerApproval' ||
      job.status === 'PendingExternalApproval' || job.status === 'Active')
      && !isJobOverdue(job))
  }

  if (view === 'completed') {
    return jobs.filter(job => job.status === 'Completed')
  }

  return jobs.filter(job => job.status === 'Rejected' || job.status === 'Cancelled' || job.status === 'RevisionRequested')
}

function filterDepartmentOutgoingRequests(jobs: JobSummary[], view: DepartmentOutgoingView): JobSummary[] {
  if (view === 'all') return jobs
  if (view === 'overdue') return jobs.filter(job => !isClosedJobStatus(job.status) && isJobOverdue(job))

  if (view === 'pending') {
    return jobs.filter(job =>
      job.status === 'PendingOwnerApproval' || job.status === 'PendingExternalApproval')
  }

  if (view === 'approved') {
    return jobs.filter(job => job.status === 'Active' && job.taskCount === 0 && !isJobOverdue(job))
  }

  if (view === 'in-progress') {
    return jobs.filter(job => job.status === 'Active' && job.taskCount > 0 && !isJobOverdue(job))
  }

  if (view === 'completed') {
    return jobs.filter(job => job.status === 'Completed')
  }

  return jobs.filter(job => job.status === 'Rejected' || job.status === 'Cancelled')
}

async function loadJobsForView(scope: JobListScope, departmentId: string | null, includeDepartmentJobs: boolean): Promise<JobSummary[]> {
  const primaryJobs = await api.getJobs(scope, departmentId)
  if (!includeDepartmentJobs) return primaryJobs

  const departmentJobs = await api.getJobs('department-pool')
  const jobsById = new Map<string, JobSummary>()
  for (const job of primaryJobs) jobsById.set(job.jobId, job)
  for (const job of departmentJobs) jobsById.set(job.jobId, job)
  return [...jobsById.values()]
}

interface JobsPageProps {
  fixedScope?: JobListScope
  mode?: 'external' | 'myRequests' | 'departmentOutgoing'
  notificationJobId?: string | null
  detailOnly?: boolean
  detailContextOverride?: 'incoming' | 'social'
  onNotificationDetailClose?: () => void
  socialActions?: {
    goToConversation?: () => void
    edit?: () => void
    editDisabledTitle?: string
    cancel?: () => void
    cancelDisabledTitle?: string
  }
}

export function JobsPage({ fixedScope, mode = 'external', notificationJobId, detailOnly = false, detailContextOverride, onNotificationDetailClose, socialActions }: JobsPageProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  const isReporter = user?.role === 'Reporter'
  // "Başkanlık seviyesi üst düzey yönetici": Üst Düzey Yönetici (Reporter) rolü + Başkanlık birimi (card 645/647).
  const isPresidencyReporter = isReporter && user?.departmentName === 'Başkanlık'
  const locale = getLocale(i18n.language)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeDeptId, setActiveDeptId] = useState(() => getActiveDepartmentId())
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(true)
  const hasLoadedJobsRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [jobsPage, setJobsPage] = useState(1)
  const [jobsPageSize, setJobsPageSize] = useState(10)
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])

  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [citizenSourceMessage, setCitizenSourceMessage] = useState<SocialMessage | null>(null)
  const [conversationModal, setConversationModal] = useState<{
    socialMessageId: string
    citizenHandle: string
    citizenPhone: string | null
  } | null>(null)

  const auditLogQuery = useQuery({
    queryKey: queryKeys.jobs.auditLog(detail?.jobId),
    queryFn: () => api.getJobAuditLog(detail!.jobId),
    enabled: !!detail?.jobId,
  })

  const [editModal, setEditModal] = useState<{
    jobId: string
    title: string
    description: string
    priority: string
    startDateUtc: string
    dueDateUtc: string
  } | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [detailDueDateEdit, setDetailDueDateEdit] = useState<{ jobId: string; value: string; saving: boolean; mode: 'picking' | 'confirm' } | null>(null)
  const [managerNoteDraft, setManagerNoteDraft] = useState('')
  const [managerNoteSaving, setManagerNoteSaving] = useState(false)
  const [managerNoteSaved, setManagerNoteSaved] = useState(false)
  // Mevcut not için Değiştir/Sil moduna geçildi mi (card #727).
  const [managerNoteEditing, setManagerNoteEditing] = useState(false)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [myRequestEditing, setMyRequestEditing] = useState(false)
  const [myRequestEditDraft, setMyRequestEditDraft] = useState<MyRequestEditDraft | null>(null)
  const [myRequestEditSaving, setMyRequestEditSaving] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [cancelModal, setCancelModal] = useState<{ jobId: string; reason: string; saving: boolean } | null>(null)
  const [staffAssignModal, setStaffAssignModal] = useState<{
    jobId: string
    selectedUserIds: string[]
    users: User[]
    saving: boolean
    selfRequestedOwnerUserId: string | null
    approvalRequired: boolean
    targetApprovalRequired: boolean
    targetDepartmentId: string | null
    requiresProjectConfirmation: boolean
    showProjectNotice: boolean
    projectDecision: boolean | null
  } | null>(null)
  const [filterFrom, setFilterFrom] = useState(() => searchParams.get('from') ?? '')
  const [filterTo, setFilterTo] = useState(() => searchParams.get('to') ?? '')
  const [searchText, setSearchText] = useState('')

  const isMyRequestsView = mode === 'myRequests'
  const isDepartmentOutgoingView = mode === 'departmentOutgoing'
  const detailContext = detailContextOverride ?? searchParams.get('context')
  const incomingReturnStatus = searchParams.get('returnStatus')
  const detailHeaderTitle = detailContext === 'social'
    ? t('jobs.detail.citizenRequest', 'Vatandaş Talebi')
    : isMyRequestsView
      ? t('nav.myRequests', 'Taleplerim')
      : isDepartmentOutgoingView
        ? t('nav.outgoingRequests', 'Birimden Giden Talepler')
        : detailContext === 'incoming'
          ? t('nav.incomingRequests', 'Birime Gelen Talepler')
          : t('jobs.detail.title', 'İş Detayı')
  const isIncomingRequestDetail = detailContext === 'incoming'
  const isRequestDetailContext = isMyRequestsView || isDepartmentOutgoingView || isIncomingRequestDetail
  const canManageCoordination = isManagerLike || isReporter
  const canApproveDetail = isRequestDetailContext && isManagerLike && detail?.status === 'PendingOwnerApproval'
  const activeIncomingTarget = detail?.departments?.find(
    department => department.role === 'Target' && department.departmentId === activeDeptId,
  )
  const canApproveTargetDetail = isIncomingRequestDetail
    && isManagerLike
    && (detail?.requestType === 'ExternalUnit' || detail?.requestType === 'Citizen')
    && detail.status === 'PendingExternalApproval'
    && activeIncomingTarget?.approvalStatus === 'Pending'
    && Boolean(activeDeptId)
  // Birime düşmüş dış talepte görev henüz oluşmadıysa griddeki "Onayla" eylemi
  // personel atama penceresini açar. Detay popup'ı da aynı eylemi sunmalıdır.
  const canAssignIncomingDetail = isIncomingRequestDetail
    && isManagerLike
    && (detail?.requestType === 'ExternalUnit' || detail?.requestType === 'Citizen')
    && detail.status === 'Active'
    && (detail.tasks?.length ?? 0) === 0
  // Yönlendirilmiş talebin sebebi hedef kaydın Notes alanında saklanır (card #1406).
  const forwardTarget = detail?.departments?.find(department => department.role === 'Target' && Boolean(department.notes?.trim())) ?? null
  const forwardReason = forwardTarget?.notes?.trim() ?? null
  const forwardSourceUser = forwardTarget?.requestedByUserId
    ? users.find(item => item.userId === forwardTarget.requestedByUserId)
    : null
  const forwardSourceDepartmentName = forwardSourceUser?.departments?.find(department => department.isPrimary)?.name
    ?? forwardSourceUser?.departments?.[0]?.name
    ?? null
  const forwardReasonDisplay = forwardReason ? (
    <span className="text-teal-800">
      {forwardSourceDepartmentName ?? t('jobs.forward.sourceFallback', 'Talebi Yönlendiren Birim')}
      <span aria-hidden="true"> / </span>
      {forwardReason}
    </span>
  ) : null
  // Dış birimden gelen (birime düşen) talep, hedef birim yöneticisi onaylayana (personel atayana) kadar
  // başka birime yönlendirilebilir. Hem onay bekleyen (PendingExternalApproval) hem de otomatik aktifleşmiş
  // ama henüz atanmamış (Active, görev yok) hedefler kapsanır; atama yapılınca buton kaybolur (cards #1405/#1407).
  // Bir kez yönlendirilmiş talep yeniden yönlendirilemez (card #1413).
  const canForwardTargetDetail = detail?.requestType === 'ExternalUnit'
    && (canApproveTargetDetail || canAssignIncomingDetail)
    && !forwardReason
  // Yönlendirme dropdown'ı: mevcut hedef ve talep sahibi birim hariç tüm birimler ("Talebin Gideceği Birim").
  // Başkanlık seviyesi birimler (Başkanlık / Daire) hiçbir zaman listelenmez (card #1410).
  const forwardDepartmentOptions = departments
    .filter(department =>
      department.departmentId !== activeDeptId
      && department.departmentId !== detail?.ownerDepartmentId
      && !isPresidencyLevelDepartment(department))
    .map(department => ({ value: department.departmentId, label: department.name }))
  const incomingPendingCloseTask = isIncomingRequestDetail && isManagerLike
    ? detail?.tasks.find(task => task.currentStatus === 'PendingCloseApproval') ?? null
    : null
  const canApproveIncomingCloseDetail = incomingPendingCloseTask != null
  const isDepartmentOutgoingTargetApprovedDetail = isDepartmentOutgoingView
    && detail != null
    && detail.departments.some(department => department.role === 'Target' && department.approvalStatus === 'Approved')
  // Son tarihi geçmiş kayıtlarda listede gösterilen pasif Onayla düğmesi,
  // detay popup'ında da aynı işleme uygun olmayan durumu açıkça belirtmelidir.
  const shouldShowDisabledIncomingApprove = isIncomingRequestDetail
    && isManagerLike
    && detail != null
    && detail.dueDateUtc != null
    && new Date(detail.dueDateUtc).getTime() < Date.now()
    && !['Completed', 'Cancelled', 'Rejected', 'RevisionRequested'].includes(detail.status)
    && !canApproveDetail
    && !canApproveTargetDetail
    && !canAssignIncomingDetail
  const canCancelDetail = isRequestDetailContext
    && (isManagerLike || isMyRequestsView)
    && detail != null
    && (detail.status === 'PendingOwnerApproval' || detail.status === 'PendingExternalApproval' || detail.status === 'Active')
    && !isDepartmentOutgoingTargetApprovedDetail
  const shouldShowDisabledDepartmentOutgoingCancel = isDepartmentOutgoingTargetApprovedDetail
    && detail != null
    && (detail.status === 'PendingOwnerApproval' || detail.status === 'PendingExternalApproval' || detail.status === 'Active')
  const showWorkflowSections = !isMyRequestsView
    && !isDepartmentOutgoingView
    && detailContext !== 'incoming'
    && detailContext !== 'social'
  const canChangeDetailDueDate = isIncomingRequestDetail
    && isManagerLike
    && detail != null
    && (detail.status === 'Draft' || detail.status === 'PendingOwnerApproval' || detail.status === 'PendingExternalApproval' || detail.status === 'Active')
  // Yönetici Notu: yönetici, kendi gelen/giden talep bağlamında talep tamamlanmadığı
  // veya iptal edilmediği sürece not ekleyebilir, değiştirebilir ya da silebilir.
  const canEditManagerNote = (isMyRequestsView || isDepartmentOutgoingView || isIncomingRequestDetail)
    && (isManagerLike || isReporter)
    && detail != null
    && detail.status !== 'Completed' && detail.status !== 'Cancelled'
  // Yönetici Notu sütunu tüm talep detaylarında görünür (card 468); vatandaş talebinde gizlenir (#895).
  const isCitizenRequestDetail = detail != null && isCitizenRequestJob(detail)
  const showManagerNoteColumn = isRequestDetailContext && !isCitizenRequestDetail
  const currentDepartmentOutgoingView = getDepartmentOutgoingView(searchParams.get('view'))
  const currentRequestFlowFilter = getRequestFlowFilter(searchParams.get('flow'))
  const rawMyRequestsView = getMyRequestsView(searchParams.get('view'), isManagerLike, isReporter)
  const currentMyRequestsView = isManagerLike && currentRequestFlowFilter === 'internal' && rawMyRequestsView === 'external-pending'
    ? 'in-progress'
    : rawMyRequestsView
  const activeJobView = isMyRequestsView ? currentMyRequestsView : currentDepartmentOutgoingView
  const showTaskOwnerColumn = (isMyRequestsView || isDepartmentOutgoingView)
    && ['in-progress', 'completed', 'rejected'].includes(activeJobView)
  const jobsTableColumnCount = useMemo(() => {
    let count = 1
    if (isMyRequestsView || isDepartmentOutgoingView) count += 2
    if (isDepartmentOutgoingView) count += 1
    count += 1
    if (showTaskOwnerColumn) count += 1
    count += 1
    if (!(isMyRequestsView || isDepartmentOutgoingView)) count += 3
    if (!((isMyRequestsView || isDepartmentOutgoingView) && (activeJobView === 'rejected' || activeJobView === 'completed'))) count += 1
    if ((isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'approved') count += 1
    if ((isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'completed') count += 1
    if ((isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'rejected') count += 1
    if ((isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'all') count += 1
    count += 1
    return count
  }, [activeJobView, isDepartmentOutgoingView, isMyRequestsView, showTaskOwnerColumn])
  // Yönetici/sorumlu: Bekleyen + Onaylanmış yerine tek "Yapılmakta Olan Taleplerim".
  const myRequestViews = isManagerLike
    ? MY_REQUEST_VIEWS.filter(view => view.value !== 'pending' && view.value !== 'approved')
    : isReporter
      // Üst Düzey Yönetici: "Bekleyen Taleplerim"den sonra "Yapılmakta Olan Taleplerim".
      ? (['pending', 'in-progress', 'overdue', 'completed', 'rejected', 'all'] as MyRequestsView[])
          .map(value => MY_REQUEST_VIEWS.find(view => view.value === value)!)
      : (['pending', 'approved', 'overdue', 'completed', 'rejected', 'all'] as MyRequestsView[])
          .map(value => MY_REQUEST_VIEWS.find(view => view.value === value)!)
  const reporterDepartmentParam = searchParams.get('departmentId')
  const reporterDepartmentId = isReporter
    ? reporterDepartmentParam === 'all' ? '' : reporterDepartmentParam ?? ''
    : ''
  const currentMyRequestsViewLabel = t(myRequestViews.find(view => view.value === currentMyRequestsView)?.labelKey ?? 'jobs.myViews.pending', 'Bekleyen Taleplerim')
  const currentDepartmentOutgoingViewLabel = t(
    DEPARTMENT_OUTGOING_VIEWS.find(view => view.value === currentDepartmentOutgoingView)?.labelKey ?? 'jobs.outgoingViews.pending',
    'Bekleyen Talepler',
  )
  const detailStatusClass = detail?.status === 'PendingOwnerApproval'
    || detail?.status === 'PendingExternalApproval'
    || (isIncomingRequestDetail
      && detail?.status === 'Active'
      && (detail.tasks?.length ?? 0) === 0)
    ? 'text-sky-500'
    : detail?.status === 'Active'
    ? 'text-[#f97316]'
    : detail?.status === 'Completed'
      ? 'text-emerald-600'
      : (detail?.status === 'Cancelled' || detail?.status === 'Rejected')
        ? 'text-red-600'
        : 'text-slate-900'
  const scope = useMemo<JobListScope>(() => {
    if (fixedScope) return fixedScope
    const raw = (searchParams.get('scope') as JobListScope | null) ?? 'department-pool'
    return EXTERNAL_SCOPES.some(s => s.value === raw) || raw === 'rejected' ? raw : 'department-pool'
  }, [fixedScope, searchParams])
  // Taleplerim yalnızca kullanıcının kendi oluşturduğu talepleri gösterir (backend "mine" scope);
  // departman havuzu merge edilmez — aksi halde başka kullanıcıların talepleri sızıyordu (card 6a3984de).
  const includeDepartmentJobs = false

  // "pending-approval" görünümü "Birime Gelen Talepler" varsayılan sayfasının kopyasıydı;
  // bu eski bağlantılar artık Birime Gelen Talepler'e yönlendirilir.
  useEffect(() => {
    if (!fixedScope && searchParams.get('scope') === 'pending-approval') {
      navigate('/incoming-requests', { replace: true })
    }
  }, [fixedScope, searchParams, navigate])

  // auto-open detail drawer when ?jobId=... is in the URL (e.g. linked from social messages)
  const autoOpenJobId = notificationJobId ?? searchParams.get('jobId')

  // "Birime Gelen Talepler" varsayılan liste görünümü artık /incoming-requests sayfasının
  // kopyasıydı; tek bir talep (jobId) açılmadığında bu eski sayfaya düşülmemesi için
  // gerçek "Birime Gelen Talepler" sayfasına yönlendirilir (card 431).
  useEffect(() => {
    if (mode === 'external' && !autoOpenJobId) {
      navigate('/incoming-requests?kind=all', { replace: true })
    }
  }, [mode, autoOpenJobId, navigate])

  useEffect(() => {
    const handler = () => setActiveDeptId(getActiveDepartmentId())
    window.addEventListener('activeDepartmentChanged', handler)
    return () => window.removeEventListener('activeDepartmentChanged', handler)
  }, [])

  useEffect(() => {
    if (!canManageCoordination) return

    let cancelled = false
    api.getDepartments()
      .then(items => {
        if (!cancelled) setDepartments(items)
      })
      .catch(() => {
        if (!cancelled) setDepartments([])
      })

    return () => { cancelled = true }
  }, [canManageCoordination])

  useEffect(() => {
    if (!detail?.departments.some(department => department.role === 'Target' && Boolean(department.notes?.trim()))) return
    if (users.length > 0) return

    let cancelled = false
    api.getUsers()
      .then(items => {
        if (!cancelled) setUsers(items)
      })
      .catch(() => {
        if (!cancelled) setUsers([])
      })

    return () => { cancelled = true }
  }, [detail?.jobId, detail?.departments, users.length])

  useEffect(() => {
    let cancelled = false
    if (!hasLoadedJobsRef.current) setLoading(true)
    loadJobsForView(scope, reporterDepartmentId, includeDepartmentJobs)
      .then(jobList => {
        if (cancelled) return
        hasLoadedJobsRef.current = true
        setJobs(jobList)
        if (autoOpenJobId) void openDetail(autoOpenJobId)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [scope, t, activeDeptId, reporterDepartmentId, includeDepartmentJobs]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadJobsForView(scope, reporterDepartmentId, includeDepartmentJobs)
        .then(jobList => {
          setJobs(jobList)
          setError(null)
        })
        .catch(err => setError(err instanceof Error ? err.message : t('common.error')))

      if (detail?.jobId) {
        api.getJobById(detail.jobId)
          .then(setDetail)
          .catch(() => undefined)
      }
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [detail?.jobId, scope, t, activeDeptId, reporterDepartmentId, includeDepartmentJobs])

  const reload = async () => {
    try { setJobs(await loadJobsForView(scope, reporterDepartmentId, includeDepartmentJobs)) }
    catch (err) { setError(err instanceof Error ? err.message : t('common.error')) }
  }

  const showRequestFlowFilters = isMyRequestsView && user?.role !== 'SystemAdmin' && !isReporter
  const hideCitizenRequestsFromMyRequests = isMyRequestsView && (user?.role === 'Operator' || hasCitizenRequestManagerRole(user))
  const canMutatePreApprovalJob = (job: JobSummary | JobDetail) => (
    isPreApprovalStatus(job.status) &&
    (user?.role === 'SystemAdmin' || isManagerLike)
  )
  const scopeLabel = scope === 'rejected'
    ? t('jobs.scopes.rejected', 'İptal/Red Edilen')
    : t(EXTERNAL_SCOPES.find(item => item.value === scope)?.labelKey ?? 'jobs.scopes.departmentPool', 'Onaylanmış Talepler')

  type EnrichedJobRow = JobSummary & {
    destinationText: string
    ownerDecidedAtUtc: string | null
    cancelReturnStatus: string
  }

  const enrichJobRow = useCallback((job: JobSummary): EnrichedJobRow => {
    const targets = getTargetJobDepartments(job)
    const destinationText = targets.length > 0
      ? targets.map(d => d.departmentName ?? '').filter(Boolean).join(', ')
      : job.ownerDepartmentName ?? ''
    const ownerDecidedAtUtc = job.departments?.find(d => d.role === 'Owner')?.decidedAtUtc ?? null
    return { ...job, destinationText, ownerDecidedAtUtc, cancelReturnStatus: 'İptal' }
  }, [])

  const getJobColumnValue = useCallback((key: string, row: EnrichedJobRow): string => {
    if (key === 'destinationText') return row.destinationText
    if (key === 'cancelReturnStatus') return row.cancelReturnStatus
    if (key === 'jobNumber') return formatJobDisplayNumber(row)
    if (key === 'status') return getJobDisplayStatus(t, row)
    if (key === 'priority') return getPriorityLabel(t, row.priority)
    if (key === 'createdAtUtc') return formatDateTime(row.createdAtUtc ?? null, locale)
    if (key === 'dueDateUtc') return formatDateTime(row.dueDateUtc ?? null, locale)
    if (key === 'ownerDecidedAtUtc') return formatDateTime(row.ownerDecidedAtUtc ?? null, locale)
    if (key === 'completedAtUtc') return formatDateTime(row.completedAtUtc ?? null, locale)
    if (key === 'updatedAtUtc') return formatDateTime(row.updatedAtUtc ?? null, locale)
    return String((row as unknown as Record<string, unknown>)[key] ?? '')
  }, [t, locale])

  const visibleJobs = useMemo(() => {
    let result: typeof jobs

    if (isMyRequestsView) {
      const myJobs = filterMyRequests(jobs, currentMyRequestsView, isReporter, isManagerLike)
        .filter(job => !hideCitizenRequestsFromMyRequests || !isCitizenRequestJob(job))
      result = showRequestFlowFilters ? myJobs.filter(job => matchesRequestFlow(job.requestType, currentRequestFlowFilter)) : myJobs
    } else if (isDepartmentOutgoingView) {
      result = filterDepartmentOutgoingRequests(jobs, currentDepartmentOutgoingView)
    } else {
      const externalJobs = jobs.filter(job => job.requestType === 'ExternalUnit')
      result = scope === 'department-pool'
        ? externalJobs.filter(job => job.status === 'Active' || job.status === 'Completed')
        : externalJobs
    }

    if (filterFrom || filterTo) {
      const useDueDatePeriod =
        (isMyRequestsView && currentMyRequestsView === 'overdue')
        || (isDepartmentOutgoingView && currentDepartmentOutgoingView === 'overdue')
      result = result.filter(job => {
        const d = (useDueDatePeriod ? job.dueDateUtc : job.createdAtUtc)?.slice(0, 10)
        if (!d) return false
        if (filterFrom && d < filterFrom.slice(0, 10)) return false
        if (filterTo && d > filterTo.slice(0, 10)) return false
        return true
      })
    }

    if (searchText.trim()) {
      result = result.filter(job => matchesBannerSearch(
        searchText,
        JOB_SEARCH_COLUMN_KEYS.map(key => getJobColumnValue(key, enrichJobRow(job))),
      ))
    }

    return result
  }, [currentDepartmentOutgoingView, currentMyRequestsView, currentRequestFlowFilter, enrichJobRow, filterFrom, filterTo, getJobColumnValue, hideCitizenRequestsFromMyRequests, isDepartmentOutgoingView, isManagerLike, isMyRequestsView, isReporter, jobs, scope, searchText, showRequestFlowFilters])

  const { sortKey: jobsSortKey, sortDir: jobsSortDir, toggleSort: _toggleJobsSort, sortItems: sortJobs } = useSortable()
  const { filters: jobFilters, setFilter: setJobFilter, clearFilters: clearJobFilters, matchesFilters: jobMatchesFilters } = useColumnFilters()

  const toggleJobsSort = (key: string) => {
    _toggleJobsSort(key)
    setJobsPage(1)
  }

  const columnFilteredJobs = useMemo(
    () => visibleJobs
      .map(job => ({
        ...enrichJobRow(job),
        statusSortText: getJobDisplayStatus(t, job),
      }))
      .filter(job => jobMatchesFilters(job, getJobColumnValue)),
    [visibleJobs, jobMatchesFilters, enrichJobRow, getJobColumnValue, t],
  )

  useEffect(() => { setJobsPage(1) }, [jobFilters])

  useEffect(() => {
    queueMicrotask(() => {
      setJobsPage(1)
      setFilterFrom('')
      setFilterTo('')
      setSearchText('')
      clearJobFilters()
      setDetail(null)
      setEditModal(null)
      setConfirmDialog(null)
      setError(null)
    })
  }, [activeDeptId, clearJobFilters])

  const pagedJobs = useMemo(
    () => {
      // Tamamlanmış/İptal görünümlerinde tamamlanma/iptal tarihine göre, diğerlerinde talep tarihine
      // göre en yeni en üstte varsayılan sırala (card #722).
      const isCompletedView = (isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'completed'
      const isRejectedView = (isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'rejected'
      const newestFirst = [...columnFilteredJobs].sort((a, b) => {
        const av = isCompletedView ? a.completedAtUtc : isRejectedView ? a.updatedAtUtc : a.createdAtUtc
        const bv = isCompletedView ? b.completedAtUtc : isRejectedView ? b.updatedAtUtc : b.createdAtUtc
        return new Date(bv ?? 0).getTime() - new Date(av ?? 0).getTime()
      })
      return sortJobs(newestFirst).slice((jobsPage - 1) * jobsPageSize, jobsPage * jobsPageSize)
    },
    [columnFilteredJobs, jobsPage, jobsPageSize, sortJobs, isMyRequestsView, isDepartmentOutgoingView, activeJobView],
  )

  const setMyRequestsView = (view: MyRequestsView) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', view)
    setSearchParams(nextParams)
    setJobsPage(1)
    clearJobFilters()
  }

  const setRequestFlowFilter = (filter: RequestFlowFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    if (filter === 'all') nextParams.delete('flow')
    else nextParams.set('flow', filter)
    if (isManagerLike) {
      if (filter === 'internal' && currentMyRequestsView === 'external-pending') {
        nextParams.set('view', 'in-progress')
      } else if (filter !== 'internal') {
        nextParams.set('view', 'external-pending')
      }
    }
    setSearchParams(nextParams)
    setJobsPage(1)
    clearJobFilters()
  }

  const setReporterDepartment = (departmentId: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (departmentId) nextParams.set('departmentId', departmentId)
    else nextParams.set('departmentId', 'all')
    setSearchParams(nextParams)
    setJobsPage(1)
    clearJobFilters()
  }

  const setDepartmentOutgoingView = (view: DepartmentOutgoingView) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', view)
    setSearchParams(nextParams)
    setJobsPage(1)
    clearJobFilters()
  }

  const openDetail = async (jobId: string) => {
    setDetailLoading(true)
    try {
      const d = await api.getJobById(jobId)
      setDetail(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }

  const refreshDetail = async () => {
    if (!detail) return
    try { setDetail(await api.getJobById(detail.jobId)) } catch { /* ignore */ }
    await reload()
  }

  useEffect(() => {
    if (!detail || !isCitizenRequestJob(detail)) {
      setCitizenSourceMessage(null)
      return
    }
    let cancelled = false
    async function loadCitizenSourceMessage() {
      if (detail!.sourceType === 'SocialMessage' && detail!.sourceRefId) {
        try {
          const message = await api.getSocialMessageById(detail!.sourceRefId)
          if (!cancelled) setCitizenSourceMessage(message)
          return
        } catch {
          /* fall through */
        }
      }
      try {
        const messages = await api.getSocialMessages()
        if (!cancelled) {
          setCitizenSourceMessage(messages.find(message => message.jobId === detail!.jobId) ?? null)
        }
      } catch {
        if (!cancelled) setCitizenSourceMessage(null)
      }
    }
    void loadCitizenSourceMessage()
    return () => { cancelled = true }
  }, [detail?.jobId, detail?.sourceRefId, detail?.sourceType])

  const openCitizenConversationModal = () => {
    if (!detail) return
    const socialMessageId = detail.sourceType === 'SocialMessage' && detail.sourceRefId
      ? detail.sourceRefId
      : citizenSourceMessage?.socialMessageId
    if (!socialMessageId) return
    setConversationModal({
      socialMessageId,
      citizenHandle: citizenSourceMessage?.citizenHandle ?? detail.citizenName ?? detail.citizenPhone ?? '',
      citizenPhone: detail.citizenPhone ?? citizenSourceMessage?.citizenPhone ?? null,
    })
  }

  // Yönetici, talep detayında görevin bekleyen ek süre isteğini görüp onaylar/reddeder (card #1395).
  const [jobExtraTimeReview, setJobExtraTimeReview] = useState<{
    jobId: string
    taskId: string
    proposedDueDateUtc: string | null
    loading: boolean
    saving: boolean
  } | null>(null)

  // Dış birimden gelen talebi başka birime yönlendirme penceresi (cards #1405-#1408).
  const [forwardModal, setForwardModal] = useState<{
    jobId: string
    departmentId: string
    note: string
    saving: boolean
  } | null>(null)

  const openJobExtraTimeReview = async () => {
    if (!detail) return
    const pendingTask = detail.tasks.find(task => task.hasPendingExtraTimeRequest)
    if (!pendingTask) return
    setJobExtraTimeReview({ jobId: detail.jobId, taskId: pendingTask.taskId, proposedDueDateUtc: null, loading: true, saving: false })
    try {
      const pendingTaskDetail = await api.getTaskById(pendingTask.taskId)
      const pendingApproval = pendingTaskDetail.approvals.find(approval => approval.subjectType === 'TaskRevision' && approval.decision === 'Pending')
      // İstenen yeni tarih onay yorumundaki ISO damgasından okunur ("Ek süre iste: <tarih>").
      const proposedDueDateUtc = pendingApproval?.comment?.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/)?.[0] ?? null
      setJobExtraTimeReview(current => (current && current.taskId === pendingTask.taskId
        ? { ...current, proposedDueDateUtc, loading: false }
        : current))
    } catch (err) {
      setJobExtraTimeReview(null)
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleJobExtraTimeDecision = async (decision: 'approve' | 'reject') => {
    if (!jobExtraTimeReview) return
    setJobExtraTimeReview(current => (current ? { ...current, saving: true } : current))
    try {
      if (decision === 'approve') {
        await api.approveTaskRevision(jobExtraTimeReview.taskId, t('tasks.actions.extraTimeApproved', 'Onaylanmış ek süre'), jobExtraTimeReview.proposedDueDateUtc)
      } else {
        await api.rejectTaskRevision(jobExtraTimeReview.taskId, t('tasks.actions.extraTimeRejected', 'Ek süre talebi reddedildi.'))
      }
      setJobExtraTimeReview(null)
      await refreshDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setJobExtraTimeReview(current => (current ? { ...current, saving: false } : current))
    }
  }

  const openDetailDueDateEdit = () => {
    if (!detail) return
    setDetailDueDateEdit({
      jobId: detail.jobId,
      value: toDateTimePickerValue(detail.dueDateUtc),
      saving: false,
      mode: 'picking',
    })
  }

  const closeDetailDueDateEdit = () => {
    setDetailDueDateEdit(null)
  }

  const handleDetailDueDateSave = async () => {
    if (!detail || !detailDueDateEdit) return
    setDetailDueDateEdit(current => current ? { ...current, saving: true } : current)
    try {
      await api.updateJob(detailDueDateEdit.jobId, {
        title: detail.title,
        description: detail.description ?? '',
        priority: detail.priority,
        startDateUtc: detail.startDateUtc,
        dueDateUtc: detailDueDateEdit.value ? new Date(detailDueDateEdit.value).toISOString() : null,
        latitude: detail.latitude,
        longitude: detail.longitude,
        isProject: detail.isProject,
        neighborhood: detail.neighborhood,
        street: detail.street,
        openAddress: detail.openAddress,
      })
      invalidateJobs(queryClient, detailDueDateEdit.jobId)
      setDetailDueDateEdit(null)
      await refreshDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setDetailDueDateEdit(current => current ? { ...current, saving: false } : current)
    }
  }

  // Açılan talebin mevcut yönetici notunu forma yükle (card 453); aynı talep yenilenince yazılanı korur.
  useEffect(() => {
    setManagerNoteDraft(detail?.managerNote ?? '')
    setManagerNoteSaved(false)
    setManagerNoteEditing(false)
    setDetailDueDateEdit(null)
    setMyRequestEditing(false)
    setMyRequestEditDraft(null)
    setMyRequestEditSaving(false)
  }, [detail?.jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  const startMyRequestEdit = () => {
    if (!detail) return
    setDetailDueDateEdit(null)
    setMyRequestEditDraft(buildMyRequestEditDraft(detail))
    setMyRequestEditing(true)
  }

  const cancelMyRequestEdit = () => {
    setMyRequestEditing(false)
    setMyRequestEditDraft(null)
  }

  const handleSaveMyRequestEdit = async () => {
    if (!detail || !myRequestEditDraft || !myRequestEditDraft.title.trim()) return
    setMyRequestEditSaving(true)
    setError(null)
    try {
      await api.updateJob(detail.jobId, {
        title: myRequestEditDraft.title.trim(),
        description: myRequestEditDraft.description,
        priority: myRequestEditDraft.priority,
        startDateUtc: detail.startDateUtc,
        dueDateUtc: myRequestEditDraft.dueDateUtc ? new Date(myRequestEditDraft.dueDateUtc).toISOString() : null,
        latitude: detail.latitude,
        longitude: detail.longitude,
        isProject: detail.isProject,
        neighborhood: myRequestEditDraft.neighborhood || null,
        street: myRequestEditDraft.street || null,
        openAddress: myRequestEditDraft.openAddress || null,
      })
      invalidateJobs(queryClient, detail.jobId)
      setMyRequestEditing(false)
      setMyRequestEditDraft(null)
      await refreshDetail()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setMyRequestEditSaving(false)
    }
  }

  const handleSaveManagerNote = async () => {
    if (!detail) return
    setManagerNoteSaving(true)
    setError(null)
    try {
      await api.setJobManagerNote(detail.jobId, managerNoteDraft.trim() || null)
      invalidateJobs(queryClient, detail.jobId)
      await refreshDetail()
      setManagerNoteSaved(true)
      setManagerNoteEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setManagerNoteSaving(false)
    }
  }

  // Yönetici notunu sil — setJobManagerNote(null) (card #727).
  const handleDeleteManagerNote = async () => {
    if (!detail) return
    setManagerNoteSaving(true)
    setError(null)
    try {
      await api.setJobManagerNote(detail.jobId, null)
      invalidateJobs(queryClient, detail.jobId)
      await refreshDetail()
      setManagerNoteDraft('')
      setManagerNoteSaved(false)
      setManagerNoteEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setManagerNoteSaving(false)
    }
  }

  // Detayı kapatınca, kaldırılan bağımsız "Birime Gelen Talepler" liste sayfasında
  // takılı kalınmaması için bağlama göre ilgili listeye dönülür (card 431).
  const closeDetail = () => {
    setDetail(null)
    setMyRequestEditing(false)
    setMyRequestEditDraft(null)
    if (notificationJobId) {
      onNotificationDetailClose?.()
      return
    }
    if (mode === 'external') {
      const returnToIncoming = incomingReturnStatus === 'overdue'
        || incomingReturnStatus === 'approved'
        || incomingReturnStatus === 'completed'
        || incomingReturnStatus === 'cancelled'
        || incomingReturnStatus === 'all'
        ? `/incoming-requests?kind=all&status=${incomingReturnStatus}`
        : '/incoming-requests?kind=all'
      navigate(detailContext === 'social' ? '/social' : returnToIncoming, { replace: true })
    }
  }

  // Talep oluştururken opsiyonel olarak girilen adres alanlarını gösterir; veri yoksa boş durum (card 442).
  const renderJobAddressInfo = (job: JobDetail) => (
    <AddressDetailFields
      neighborhood={job.neighborhood}
      street={job.street}
      openAddress={job.openAddress}
    />
  )

  const handleDownloadTaskAttachment = async (attachmentId: string, fileName: string) => {
    try {
      const file = await api.downloadAttachment(attachmentId)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('attachments.downloadFailed', 'Ek indirilemedi.'))
    }
  }

  const handleCancel = (jobId: string) => {
    setCancelModal({ jobId, reason: '', saving: false })
  }

  const handleCancelConfirm = async () => {
    if (!cancelModal || !cancelModal.reason.trim()) return
    setCancelModal(m => m ? { ...m, saving: true } : null)
    try {
      await api.cancelJob(cancelModal.jobId, cancelModal.reason.trim())
      invalidateJobs(queryClient, cancelModal.jobId)
      setCancelModal(null)
      await refreshDetail()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setCancelModal(m => m ? { ...m, saving: false } : null)
    }
  }
  const handleApproveOwner = async (jobId: string) => {
    setError(null)
    try {
      const jobDetail = detail?.jobId === jobId ? detail : await api.getJobById(jobId)
      if (jobDetail.status === 'PendingOwnerApproval') {
        const departmentId = activeDeptId ?? jobDetail.ownerDepartmentId
        const users = await api.getUsers()
        setStaffAssignModal({
          jobId,
          selectedUserIds: [],
          users: users.filter(u => isAssignableDepartmentUser(u, departmentId, user?.userId)),
          saving: false,
          selfRequestedOwnerUserId: getSelfRequestedOwnerUserId(jobDetail),
          approvalRequired: true,
          targetApprovalRequired: false,
          targetDepartmentId: null,
          requiresProjectConfirmation: jobDetail.isProjectCreatorRequested === true,
          showProjectNotice: false,
          projectDecision: null,
        })
        return
      }
      if (
        (jobDetail.requestType === 'ExternalUnit' || jobDetail.requestType === 'Citizen')
        && jobDetail.status === 'Active'
        && (jobDetail.tasks?.length ?? 0) === 0
      ) {
        const departmentId = activeDeptId
          ?? jobDetail.departments.find(department => department.role === 'Target')?.departmentId
          ?? jobDetail.ownerDepartmentId
        const users = await api.getUsers()
        setStaffAssignModal({
          jobId,
          selectedUserIds: [],
          users: users.filter(u => isAssignableDepartmentUser(u, departmentId, user?.userId)),
          saving: false,
          selfRequestedOwnerUserId: getSelfRequestedOwnerUserId(jobDetail),
          approvalRequired: false,
          targetApprovalRequired: false,
          targetDepartmentId: null,
          requiresProjectConfirmation: false,
          showProjectNotice: jobDetail.isProject === true,
          projectDecision: null,
        })
        return
      }

      setConfirmDialog({
        title: isDepartmentOutgoingView ? 'Birimden Giden Talep' : undefined,
        titleCompact: isDepartmentOutgoingView,
        titleDivider: isDepartmentOutgoingView,
        message: t('jobs.approveOwnerConfirm', 'Bu talebi onaylamak istediğinizden emin misiniz?'),
        variant: 'primary',
        confirmLabel: t('common.approve', 'Onayla'),
        onConfirm: async () => {
          setError(null)
          try {
            await api.approveJobOwner(jobId)
            invalidateJobs(queryClient, jobId)
            await refreshDetail()
            await reload()
          } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'))
          }
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleApproveTarget = async (jobId: string, departmentId: string) => {
    setError(null)
    try {
      const jobDetail = detail?.jobId === jobId ? detail : await api.getJobById(jobId)
      const users = await api.getUsers()
      setStaffAssignModal({
        jobId,
        selectedUserIds: [],
        users: users.filter(u => isAssignableDepartmentUser(u, departmentId, user?.userId)),
        saving: false,
        selfRequestedOwnerUserId: getSelfRequestedOwnerUserId(jobDetail),
        approvalRequired: false,
        targetApprovalRequired: true,
        targetDepartmentId: departmentId,
        requiresProjectConfirmation: false,
        showProjectNotice: jobDetail.isProject === true,
        projectDecision: null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const openForwardModal = () => {
    if (!detail) return
    setError(null)
    setForwardModal({ jobId: detail.jobId, departmentId: '', note: '', saving: false })
  }

  const handleForwardConfirm = async () => {
    if (!forwardModal || !forwardModal.departmentId || !forwardModal.note.trim()) return
    setForwardModal(current => (current ? { ...current, saving: true } : current))
    try {
      await api.forwardJobTarget(forwardModal.jobId, forwardModal.departmentId, forwardModal.note.trim())
      invalidateJobs(queryClient, forwardModal.jobId)
      setForwardModal(null)
      // Yönlendirildikten sonra Birime Gelen Talepler sayfasına dön (card #1408).
      closeDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setForwardModal(current => (current ? { ...current, saving: false } : current))
    }
  }

  const handleStaffAssignConfirm = async () => {
    if (!staffAssignModal) return
    const { jobId, selectedUserIds, approvalRequired, targetApprovalRequired, targetDepartmentId, requiresProjectConfirmation, projectDecision } = staffAssignModal
    if (requiresProjectConfirmation && projectDecision === null) {
      setError(t('jobs.projectConfirmationRequired', 'Proje niteliği onayı zorunludur.'))
      return
    }
    setStaffAssignModal(current => current ? { ...current, saving: true } : null)
    try {
      if (approvalRequired) {
        await api.approveJobOwner(jobId, null, requiresProjectConfirmation ? projectDecision : null)
        invalidateJobs(queryClient, jobId)
      }
      if (targetApprovalRequired && targetDepartmentId) {
        await api.approveJobTarget(jobId, targetDepartmentId)
        invalidateJobs(queryClient, jobId)
      }
      if (selectedUserIds.length > 0) {
        const jobDetail = await api.getJobById(jobId)
        const taskIds = jobDetail.tasks.map(task => task.taskId)
        if (taskIds.length === 0) {
          await Promise.all(
            selectedUserIds.map(userId =>
              api.createTask({
                jobId,
                title: jobDetail.title,
                description: jobDetail.description,
                priority: jobDetail.priority,
                startDateUtc: jobDetail.startDateUtc,
                dueDateUtc: null,
                assignedUserId: userId,
              })
            )
          )
        } else {
          await Promise.all(
            taskIds.map((taskId, index) =>
              api.assignTask(taskId, undefined, selectedUserIds[index % selectedUserIds.length])
            )
          )
        }
        invalidateTasks(queryClient, undefined, jobId)
      }
      setStaffAssignModal(null)
      await refreshDetail()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setStaffAssignModal(current => current ? { ...current, saving: false } : null)
    }
  }

  const handleApproveIncomingCloseDetail = (taskId: string) => {
    setConfirmDialog({
      message: t('tasks.approveCloseConfirm', 'Bu görevi tamamlandı olarak onaylamak istediğinizden emin misiniz?'),
      variant: 'primary',
      confirmLabel: t('common.approve', 'Onayla'),
      onConfirm: async () => {
        setError(null)
        try {
          await api.approveTaskClose(taskId)
          invalidateTasks(queryClient, taskId, detail?.jobId)
          if (detail) invalidateJobs(queryClient, detail.jobId)
          await refreshDetail()
        } catch (err) {
          setError(err instanceof Error ? err.message : t('common.error'))
        }
      },
    })
  }

  const handleDelete = (jobId: string) => {
    setConfirmDialog({
      message: t('jobs.deleteConfirm', 'Bu iş kaydı kalıcı olarak silinecek. Emin misiniz?'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await api.deleteJob(jobId)
          invalidateJobs(queryClient, jobId)
          if (detail?.jobId === jobId) setDetail(null)
          await reload()
        } catch (err) {
          setError(err instanceof Error ? err.message : t('common.error'))
        }
      },
    })
  }

  const openEditModal = async (job: JobSummary | JobDetail) => {
    const editableJob = 'description' in job ? job : await api.getJobById(job.jobId)
    setEditModal({
      jobId: editableJob.jobId,
      title: editableJob.title,
      description: editableJob.description ?? '',
      priority: editableJob.priority,
      startDateUtc: editableJob.startDateUtc ? new Date(editableJob.startDateUtc).toISOString().slice(0, 16) : '',
      dueDateUtc: editableJob.dueDateUtc ? new Date(editableJob.dueDateUtc).toISOString().slice(0, 16) : '',
    })
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editModal) return
    setEditSaving(true)
    try {
      await api.updateJob(editModal.jobId, {
        title: editModal.title,
        description: editModal.description,
        priority: editModal.priority,
        startDateUtc: editModal.startDateUtc ? new Date(editModal.startDateUtc).toISOString() : null,
        dueDateUtc: editModal.dueDateUtc ? new Date(editModal.dueDateUtc).toISOString() : null,
      })
      invalidateJobs(queryClient, editModal.jobId)
      setEditModal(null)
      await reload()
      if (detail?.jobId === editModal.jobId) await refreshDetail()
    } finally {
      setEditSaving(false)
    }
  }

  const renderJobDepartments = (job: JobSummary) => {
    const departmentsForJob = sortJobDepartments(job.departments ?? [])
    const owner = departmentsForJob.find(department => department.role === 'Owner')
    const related = departmentsForJob.filter(department => department.role !== 'Owner')
    const visibleRelated = related.slice(0, 3)
    const hiddenRelatedCount = related.length - visibleRelated.length
    const ownerName = owner?.departmentName ?? job.ownerDepartmentName ?? '—'

    return (
      <div className="min-w-[14rem] max-w-[24rem] space-y-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-500">{t('jobs.roles.Owner')}</span>
          <span className="truncate font-semibold text-slate-950" title={ownerName}>{ownerName}</span>
        </div>
        {related.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {visibleRelated.map(department => {
              const roleLabel = t(`jobs.roles.${department.role}`, department.role)
              const departmentName = department.departmentName ?? '—'
              const label = `${roleLabel}: ${departmentName}`
              return (
                <StatusPill key={department.jobDepartmentId} tone={getDepartmentRoleTone(department.role)} title={label} className="max-w-[11rem]">
                  <span className="truncate">{label}</span>
                </StatusPill>
              )
            })}
            {hiddenRelatedCount > 0 ? (
              <StatusPill tone="neutral">{t('jobs.departmentsMore', { count: hiddenRelatedCount, defaultValue: '+{{count}} müdürlük' })}</StatusPill>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  const renderOutgoingDestination = (job: JobSummary) => {
    const targetDepartments = getTargetJobDepartments(job)
    if (targetDepartments.length === 0) {
      // Birim içi talep: müdürlük üstte, görevin atandığı personel altında.
      return (
        <div className="text-center">
          <div className="font-medium text-slate-700">{job.ownerDepartmentName ?? '—'}</div>
          {job.assignedUserDisplayName ? (
            <div className="text-xs text-slate-500">{job.assignedUserDisplayName}</div>
          ) : null}
        </div>
      )
    }

    const visibleTargets = targetDepartments.slice(0, 3)
    const hiddenTargetCount = targetDepartments.length - visibleTargets.length
    return (
      <div className="mx-auto flex min-w-[12rem] max-w-[24rem] flex-wrap justify-center gap-1.5">
        {visibleTargets.map(department => (
          <StatusPill key={department.jobDepartmentId} tone="success" className="max-w-[12rem]">
            <span className="truncate">{department.departmentName ?? '—'}</span>
          </StatusPill>
        ))}
        {hiddenTargetCount > 0 ? (
          <StatusPill tone="neutral">{t('jobs.departmentsMore', { count: hiddenTargetCount, defaultValue: '+{{count}} müdürlük' })}</StatusPill>
        ) : null}
      </div>
    )
  }

  const canReporterEditMyRequest = isPresidencyReporter && (currentMyRequestsView === 'pending' || currentMyRequestsView === 'in-progress')
  const canEditMyRequestDetailJob = detail != null && (
    canReporterEditMyRequest
    || canOperatorEditPendingExternalJob(user?.role, { ...detail, taskCount: detail.tasks?.length ?? 0 })
    || isPreApprovalStatus(detail.status)
    || (isManagerLike && (
      (detail.requestType === 'ExternalUnit' && detail.status === 'PendingExternalApproval')
      || (detail.requestType === 'InternalUnit' && detail.status === 'Active')
      || (detail.status === 'Active' && (detail.tasks?.length ?? 0) === 0)
    ))
  )
  const showMyRequestEditDisabled = isMyRequestsView && detail != null && !canEditMyRequestDetailJob && (isManagerLike || isPresidencyReporter)
  const canPresidencyEditMyRequestAttachments = isPresidencyReporter && isMyRequestsView
    && (currentMyRequestsView === 'pending' || currentMyRequestsView === 'in-progress' || currentMyRequestsView === 'overdue')
  const canEditMyRequestAttachments = detail != null && (
    (isPreApprovalStatus(detail.status) && isMyRequestsView)
    || canPresidencyEditMyRequestAttachments
  )
  const isTerminalMyRequestStatus = detail != null && (detail.status === 'Completed' || detail.status === 'Cancelled' || detail.status === 'Rejected')
  const showMyRequestAttachmentLockNotice = detail != null && !canEditMyRequestAttachments && isTerminalMyRequestStatus
  const myRequestAttachmentLockText = detail?.status === 'Completed'
    ? t('attachments.lockedCompletedRequest', 'Talep tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')
    : (detail?.status === 'Cancelled' || detail?.status === 'Rejected')
      ? t('attachments.lockedCancelled', 'Talep iptal edildiği için sonradan Ek/Fotoğraf eklenemez.')
      : t('attachments.lockedApproved', 'Talep onaylandığı için sonradan Ek/Fotoğraf eklenemez.')
  const myRequestStatusLabel = detail != null ? (
    isCitizenRequestDetail
      ? getCitizenRequestStatusLabel(t, detail)
      : getExternalUnitOwnerDisplayStatus(t, detail)
        ?? (detail.status === 'Active'
          ? t('jobs.statusLabel.inProgress', 'Yapılmakta')
          : detail.status === 'Completed'
            ? t('jobs.statusLabel.completed', 'Tamamlanmış')
            : getJobStatusLabel(t, detail.status))
  ) : null
  const myRequestStatusNoteContent = null
  const myRequestStatusContent = detail != null ? (
    <>
      {myRequestStatusLabel}
    </>
  ) : null

  return (
    <div className={detailOnly ? 'hidden' : 'page-stack desktop-page-shell'}>
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{isMyRequestsView ? currentMyRequestsViewLabel : isDepartmentOutgoingView ? t('nav.outgoingRequests', 'Birimden Giden Talepler') : scopeLabel}</div>
            <h1 className="page-title">{isMyRequestsView ? t('nav.myRequests', 'Taleplerim') : isDepartmentOutgoingView ? t('nav.outgoingRequests', 'Birimden Giden Talepler') : t('nav.jobs', 'Birime Gelen Talepler')}</h1>
            <p className="page-subtitle">
              {isMyRequestsView
                ? t('jobs.myRequestsSubtitle', 'Oluşturduğunuz talepleri durumlarına göre takip edin.')
                : isDepartmentOutgoingView
                  ? t('jobs.outgoingSubtitle', 'Biriminizden diğer birimlere gönderilen talepleri durumlarına göre takip edin.')
                  : t('jobs.subtitle', 'Birim dışı gelen talepleri izleyin ve görevleri takip edin.')}
            </p>
          </div>
          <div className="ml-auto mt-auto shrink-0">
            <ScopeChipFilters
              searchText={searchText}
              filterFrom={filterFrom}
              filterTo={filterTo}
              onSearch={setSearchText}
              onFromChange={setFilterFrom}
              onToChange={setFilterTo}
            />
          </div>
        </div>
      </header>

      {isMyRequestsView ? (
        <nav className="scope-chips" aria-label={t('nav.myRequests', 'Taleplerim')}>
          {myRequestViews.map(view => {
            const isDisabledExternalPending = isManagerLike
              && currentRequestFlowFilter === 'internal'
              && view.value === 'external-pending'
            return (
              <button
                key={view.value}
                type="button"
                className={`scope-chip ${view.value === 'in-progress' && isManagerLike ? 'scope-chip--in-progress-yellow' : getScopeChipColorClass(view.value)}${view.value === currentMyRequestsView ? ' active' : ''}`}
                disabled={isDisabledExternalPending}
                onClick={() => setMyRequestsView(view.value)}
              >
                {t(view.labelKey)}
              </button>
            )
          })}
          {showRequestFlowFilters ? (
            <>
              <span className="scope-chip-divider" aria-hidden="true">|</span>
              {REQUEST_FLOW_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  type="button"
                  className={`scope-chip scope-chip--${filter.value}${filter.value === currentRequestFlowFilter ? ' active' : ''}`}
                  onClick={() => setRequestFlowFilter(filter.value)}
                >
                  {t(filter.labelKey)}
                </button>
              ))}
            </>
          ) : null}
          {isReporter ? (
            <>
              <span className="scope-chip-divider" aria-hidden="true">|</span>
              <label className="sr-only" htmlFor="reporter-department-filter">
                {t('jobs.departmentFilter', 'Departman Seçimi')}
              </label>
              <select
                id="reporter-department-filter"
                className="field-select h-[1.95rem] min-h-0 w-auto min-w-52 py-1 text-xs"
                value={reporterDepartmentId}
                onChange={event => setReporterDepartment(event.target.value)}
              >
                <option value="">{t('jobs.allDepartments', 'Tüm Departmanlar')}</option>
                {departments
                  .filter(department => department.departmentId !== user?.departmentId)
                  .map(department => (
                    <option key={department.departmentId} value={department.departmentId}>
                      {department.name}
                    </option>
                  ))}
              </select>
            </>
          ) : null}
        </nav>
      ) : isDepartmentOutgoingView ? (
        <nav className="scope-chips" aria-label={t('nav.outgoingRequests', 'Birimden Giden Talepler')}>
          {DEPARTMENT_OUTGOING_VIEWS.map(view => (
            <button
              key={view.value}
              type="button"
              className={`scope-chip ${getScopeChipColorClass(view.value)}${view.value === currentDepartmentOutgoingView ? ' active' : ''}`}
              onClick={() => setDepartmentOutgoingView(view.value)}
            >
              {t(view.labelKey)}
            </button>
          ))}
        </nav>
      ) : !fixedScope ? (
        <nav className="scope-chips">
          {EXTERNAL_SCOPES.map(s => (
            <button
              key={s.value}
              type="button"
              className={`scope-chip${s.value === scope ? ' active' : ''}`}
              onClick={() => setSearchParams({ scope: s.value })}
            >
              {t(s.labelKey, s.value)}
            </button>
          ))}
        </nav>
      ) : null}

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className="table-wrap desktop-panel-scroll">
            <table className={`data-table jobs-table${isMyRequestsView || isDepartmentOutgoingView ? ' my-requests-table' : ''}${isMyRequestsView || isDepartmentOutgoingView ? ' data-table--zebra' : ''}`}>
              {(isMyRequestsView || isDepartmentOutgoingView) && (
                <colgroup>
                  <col className="grid-col-row-no" />
                  <col className="grid-col-request-no" />
                  <col className="grid-col-date" />
                  {isDepartmentOutgoingView && <col className="grid-col-created-by" />}
                  <col className="grid-col-title" />
                  {showTaskOwnerColumn && <col className="grid-col-task-owner" />}
                  <col className="grid-col-destination" />
                  {!((isMyRequestsView || isDepartmentOutgoingView) && (activeJobView === 'rejected' || activeJobView === 'completed')) && <col className="grid-col-due" />}
                  {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'approved' && <col className="grid-col-status-date" />}
                  {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'completed' && <col className="grid-col-status-date" />}
                  {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'rejected' && <col className="grid-col-status-date" />}
                  {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'all' && <col className="grid-col-status" />}
                  <col className="grid-col-actions" />
                </colgroup>
              )}
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  {(isMyRequestsView || isDepartmentOutgoingView) && <FilterableTh filterKey="jobNumber" filterValue={jobFilters['jobNumber'] ?? ''} onFilter={setJobFilter} sortKey="jobNumber" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.requestNo', 'Talep No')}</FilterableTh>}
                  {(isMyRequestsView || isDepartmentOutgoingView) && <FilterableTh filterKey="createdAtUtc" filterValue={jobFilters['createdAtUtc'] ?? ''} onFilter={setJobFilter} sortKey="createdAtUtc" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.requestDate', 'Talep Tarihi')}</FilterableTh>}
                  {isDepartmentOutgoingView && <FilterableTh filterKey="createdByDisplayName" filterValue={jobFilters['createdByDisplayName'] ?? ''} onFilter={setJobFilter} sortKey="createdByDisplayName" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.createdBy', 'Oluşturan')}</FilterableTh>}
                  <FilterableTh filterKey="title" filterValue={jobFilters['title'] ?? ''} onFilter={setJobFilter} sortKey="title" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.title')}</FilterableTh>
                  {showTaskOwnerColumn && <FilterableTh filterKey="assignedUserDisplayName" filterValue={jobFilters['assignedUserDisplayName'] ?? ''} onFilter={setJobFilter} sortKey="assignedUserDisplayName" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('tasks.columns.owner', 'Görev Sahibi')}</FilterableTh>}
                  {(isMyRequestsView || isDepartmentOutgoingView)
                    ? <FilterableTh filterKey="destinationText" filterValue={jobFilters['destinationText'] ?? ''} onFilter={setJobFilter} sortKey="destinationText" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.destination', 'Gittiği Yer')}</FilterableTh>
                    : <th>{t('jobs.columns.departments')}</th>
                  }
                  {!(isMyRequestsView || isDepartmentOutgoingView) && <FilterableTh filterKey="priority" filterValue={jobFilters['priority'] ?? ''} onFilter={setJobFilter} sortKey="priority" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.priority')}</FilterableTh>}
                  {!isMyRequestsView && !isDepartmentOutgoingView && <th>{t('jobs.columns.project', 'Proje mi')}</th>}
                  {!isMyRequestsView && !isDepartmentOutgoingView && <th>{t('jobs.columns.taskCount')}</th>}
                  {!((isMyRequestsView || isDepartmentOutgoingView) && (activeJobView === 'rejected' || activeJobView === 'completed')) && <FilterableTh filterKey="dueDateUtc" filterValue={jobFilters['dueDateUtc'] ?? ''} onFilter={setJobFilter} sortKey="dueDateUtc" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.dueDate')}</FilterableTh>}
                  {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'approved' && <FilterableTh filterKey="ownerDecidedAtUtc" filterValue={jobFilters['ownerDecidedAtUtc'] ?? ''} onFilter={setJobFilter} sortKey="ownerDecidedAtUtc" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.approvedAt', 'Onay Tarihi')}</FilterableTh>}
                  {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'completed' && <FilterableTh filterKey="completedAtUtc" filterValue={jobFilters['completedAtUtc'] ?? ''} onFilter={setJobFilter} sortKey="completedAtUtc" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.completedAt', 'Tamamlanma Tarihi')}</FilterableTh>}
                  {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'rejected' && <FilterableTh filterKey="updatedAtUtc" filterValue={jobFilters['updatedAtUtc'] ?? ''} onFilter={setJobFilter} sortKey="updatedAtUtc" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.cancelledAt', 'İptal Tarihi')}</FilterableTh>}
                  {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'all' && <FilterableTh filterKey="status" filterValue={jobFilters['status'] ?? ''} onFilter={setJobFilter} sortKey="statusSortText" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.status', 'Durum')}</FilterableTh>}
                  <th>{t('jobs.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedJobs.length === 0 && (
                  <TableEmptyStateRows
                    columnCount={jobsTableColumnCount}
                    message={
                      isMyRequestsView
                        ? t('jobs.myViews.empty', { view: currentMyRequestsViewLabel, defaultValue: `${currentMyRequestsViewLabel} bulunmuyor` })
                        : isDepartmentOutgoingView
                          ? t('jobs.outgoingViews.empty', { view: currentDepartmentOutgoingViewLabel, defaultValue: `${currentDepartmentOutgoingViewLabel} bulunmuyor` })
                          : t('jobs.empty')
                    }
                  />
                )}
                {pagedJobs.map((job, index) => {
                  const isOutgoingTargetApproved = isDepartmentOutgoingView &&
                    job.departments.some(d => d.role === 'Target' && d.approvalStatus === 'Approved')
                  // Reporter kendi Taleplerim gridinde kendi taleplerini turuncu görmez (card #1346).
                  const isReporterJob = isReporterCreated(job.createdByRoleCode) && !(isMyRequestsView && isReporter)
                  const reporterNumberClass = isReporterJob && hasConcreteNumberDisplay(formatJobDisplayNumber(job))
                    ? reporterGridValueClass(true)
                    : ''
                  // Ek süre işaretleri: aktif talepte Son Tarih, tamamlanmışta Tamamlanma Tarihi,
                  // iptalde İptal Tarihi altında; Tüm görünümünde terminal satırda Durum altında
                  // (görev gridindeki ile aynı kural — cards #1385/#1388).
                  const isTerminalJob = job.status === 'Completed' || job.status === 'Cancelled' || job.status === 'Rejected'
                  const jobExtraTimeMarkers = (
                    <GridExtraTimeMarkers
                      hasPending={job.hasPendingExtraTimeRequest}
                      lastDecision={job.lastExtraTimeRequestDecision}
                    />
                  )
                  return (
                  <tr key={job.jobId}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(jobsPage - 1) * jobsPageSize + index + 1}</td>
                    {(isMyRequestsView || isDepartmentOutgoingView) && (
                    <td className="table-number-cell font-mono text-xs text-slate-500">
                      <div className={`table-number-cell__value ${reporterNumberClass}`}>{formatJobDisplayNumber(job)}</div>
                      <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(job.priority)}`}>(Öncelik:{getPriorityLabel(t, job.priority)})</div>
                    </td>
                    )}
                    {(isMyRequestsView || isDepartmentOutgoingView) && <td><DateCell value={job.createdAtUtc ?? null} locale={locale} highlight={isReporterJob && Boolean(job.createdAtUtc)} /></td>}
                    {isDepartmentOutgoingView && <td>{job.createdByDisplayName ?? '—'}</td>}
                    <td className="font-semibold"><span className={`cell-title ${isReporterJob ? 'text-[#f97316]' : ''}`}>{job.title}</span></td>
                    {showTaskOwnerColumn && <td>{job.assignedUserDisplayName ?? '—'}</td>}
                    <td>
                      {isMyRequestsView || isDepartmentOutgoingView ? (
                        renderOutgoingDestination(job)
                      ) : renderJobDepartments(job)}
                    </td>
                    {!(isMyRequestsView || isDepartmentOutgoingView) && <td>{getPriorityLabel(t, job.priority)}</td>}
                    {!isMyRequestsView && !isDepartmentOutgoingView && (
                      <td><JobProjectValue job={job} t={t} /></td>
                    )}
                    {!isMyRequestsView && !isDepartmentOutgoingView && <td>{job.taskCount}</td>}
                    {!((isMyRequestsView || isDepartmentOutgoingView) && (activeJobView === 'rejected' || activeJobView === 'completed')) && (
                      <td>
                        <DueDatePill value={job.dueDateUtc} completedAtUtc={job.completedAtUtc} locale={locale} highlightReporter={isReporterJob} />
                        {!isTerminalJob && jobExtraTimeMarkers}
                      </td>
                    )}
                    {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'approved' && <td><DateCell value={job.ownerDecidedAtUtc} locale={locale} /></td>}
                    {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'completed' && (
                      <td>
                        <DateCell value={job.completedAtUtc} locale={locale} tone="success" />
                        {jobExtraTimeMarkers}
                      </td>
                    )}
                    {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'rejected' && (
                      <td>
                        <DateCell value={job.updatedAtUtc ?? null} locale={locale} tone="danger" />
                        {jobExtraTimeMarkers}
                      </td>
                    )}
                    {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'all' && (() => {
                      // Tarih durum pill'inin İÇİNDE alt satırda gösterilir (card #714).
                      const statusDate = job.status === 'Completed' ? job.completedAtUtc
                        : job.status === 'Cancelled' ? job.updatedAtUtc
                        : null
                      return (
                        <td>
                          <StatusPill className={getStatusPillClass(getJobStatusTone(job))}>
                            {statusDate
                              ? <span className="flex flex-col items-center leading-tight">
                                  <span>{getJobDisplayStatus(t, job)}</span>
                                  <span className={`text-[0.68rem] font-bold ${job.status === 'Completed' ? 'text-emerald-700' : 'text-red-700'}`}>{formatDateTime(statusDate, locale)}</span>
                                </span>
                              : getJobDisplayStatus(t, job)}
                          </StatusPill>
                          {isTerminalJob && jobExtraTimeMarkers}
                        </td>
                      )
                    })()}
                    <td className="actions-cell">
                      <div className="request-actions">
                        <Button size="sm" variant="secondary" onClick={() => openDetail(job.jobId)}>{t('jobs.actions.details')}</Button>
                        {!isMyRequestsView && !isDepartmentOutgoingView && isManagerLike && job.status === 'PendingOwnerApproval' && (
                          <Button size="sm" variant="success" onClick={() => void handleApproveOwner(job.jobId)}>{t('jobs.actions.approveOwner')}</Button>
                        )}
                        {!isMyRequestsView && !isDepartmentOutgoingView && isManagerLike && job.status === 'Active' && (
                          <Button size="sm" variant="destructive" onClick={() => handleCancel(job.jobId)}>{t('jobs.actions.cancel')}</Button>
                        )}
                        {/* Birimden Giden → Bekleyen: Yönetici onayı. Onaylanınca hedef birimin havuzuna düşer. */}
                        {isDepartmentOutgoingView && currentDepartmentOutgoingView === 'pending' && isManagerLike && job.status === 'PendingOwnerApproval' && (
                          <Button size="sm" variant="success" onClick={() => void handleApproveOwner(job.jobId)}>{t('jobs.actions.approveOwner', 'Onayla')}</Button>
                        )}
                        {/* Birimden Giden → Bekleyen: İptal butonu */}
                        {isDepartmentOutgoingView && currentDepartmentOutgoingView === 'pending' && (
                          isOutgoingTargetApproved ? (
                            <span
                              title="Talep onaylandığı için iptal edilemez"
                              className="inline-block cursor-not-allowed"
                            >
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled
                                style={{ pointerEvents: 'none' }}
                              >
                                {t('jobs.actions.cancel', 'İptal')}
                              </Button>
                            </span>
                          ) : (
                            <Button size="sm" variant="destructive" onClick={() => handleCancel(job.jobId)}>
                              {t('jobs.actions.cancel', 'İptal')}
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            className={isMyRequestsView ? 'my-requests-pagination' : undefined}
            totalCount={columnFilteredJobs.length}
            pageSize={jobsPageSize}
            currentPage={jobsPage}
            onPageSizeChange={setJobsPageSize}
            onPageChange={setJobsPage}
          />
        </section>
      )}

      {detail && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
        >
          {isMyRequestsView ? (
            <MyRequestDetailModal
              detail={detail}
              title={detailHeaderTitle}
              locale={locale}
              detailLoading={detailLoading}
              citizenSourceMessage={citizenSourceMessage}
              detailStatusClass={detailStatusClass}
              statusContent={myRequestStatusContent}
              statusLabel={myRequestStatusLabel}
              statusNoteContent={myRequestStatusNoteContent}
              canChangeDueDate={canChangeDetailDueDate}
              detailDueDateEdit={detailDueDateEdit}
              onOpenDueDateEdit={openDetailDueDateEdit}
              onCloseDueDateEdit={closeDetailDueDateEdit}
              onDueDateChange={value => setDetailDueDateEdit(current => current ? { ...current, value, mode: 'confirm' } : current)}
              onDueDateSave={() => void handleDetailDueDateSave()}
              jobExtraTimeReview={jobExtraTimeReview}
              onOpenExtraTimeReview={() => void openJobExtraTimeReview()}
              onExtraTimeDecision={decision => void handleJobExtraTimeDecision(decision)}
              onCancelExtraTimeReview={() => setJobExtraTimeReview(null)}
              onClose={closeDetail}
              onPrint={() => printJobDetail(detail, locale, t, { incomingTargetView: isIncomingRequestDetail, myRequestView: isMyRequestsView })}
              onCancel={socialActions?.cancel ?? (canCancelDetail ? () => handleCancel(detail.jobId) : undefined)}
              showCancelDisabled={Boolean(socialActions && !socialActions.cancel)}
              cancelDisabledTitle={socialActions?.cancelDisabledTitle}
              onEdit={socialActions?.editDisabledTitle ? undefined : (socialActions?.edit ?? (canEditMyRequestDetailJob && !myRequestEditing ? startMyRequestEdit : undefined))}
              showEditDisabled={socialActions ? Boolean(!socialActions.edit && socialActions.editDisabledTitle) : (showMyRequestEditDisabled && !myRequestEditing)}
              editDisabledTitle={socialActions?.editDisabledTitle}
              onGoToConversation={socialActions?.goToConversation ?? (isCitizenRequestDetail && canShowCitizenWhatsAppConversation(detail, citizenSourceMessage) ? openCitizenConversationModal : undefined)}
              showManagerNoteColumn={showManagerNoteColumn}
              canEditManagerNote={canEditManagerNote}
              canManageCoordination={canManageCoordination}
              managerNoteDraft={managerNoteDraft}
              managerNoteEditing={managerNoteEditing}
              managerNoteSaved={managerNoteSaved}
              managerNoteSaving={managerNoteSaving}
              onManagerNoteDraftChange={value => {
                setManagerNoteDraft(value)
                setManagerNoteSaved(false)
              }}
              onManagerNoteEditStart={() => {
                setManagerNoteDraft(detail.managerNote ?? '')
                setManagerNoteEditing(true)
                setManagerNoteSaved(false)
              }}
              onManagerNoteSave={() => void handleSaveManagerNote()}
              onManagerNoteDeleteConfirm={() => void handleDeleteManagerNote()}
              setConfirmDialog={setConfirmDialog}
              canEditJobAttachments={canEditMyRequestAttachments}
              showAttachmentLockNotice={showMyRequestAttachmentLockNotice}
              attachmentLockText={myRequestAttachmentLockText}
              attachmentUploading={attachmentUploading}
              onAttachmentUpload={async (file, onProgress) => {
                setAttachmentUploading(true)
                try {
                  await api.uploadJobAttachment(detail.jobId, file, onProgress)
                  invalidateJobs(queryClient, detail.jobId)
                  await refreshDetail()
                } finally {
                  setAttachmentUploading(false)
                }
              }}
              onAttachmentDelete={async (id) => {
                await api.deleteAttachment(id)
                invalidateJobs(queryClient, detail.jobId)
                await refreshDetail()
              }}
              onDownloadTaskAttachment={(attachmentId, fileName) => void handleDownloadTaskAttachment(attachmentId, fileName)}
              isEditing={myRequestEditing}
              editDraft={myRequestEditDraft ?? undefined}
              onEditDraftChange={patch => setMyRequestEditDraft(current => current ? { ...current, ...patch } : current)}
              editSaving={myRequestEditSaving}
              onSaveEdit={() => void handleSaveMyRequestEdit()}
              onCancelEdit={cancelMyRequestEdit}
            />
          ) : (
          <section
            className="detail-modal-shell flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className="detail-modal-header-mobile flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
              <div className="detail-modal-header-title min-w-0">
                <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-slate-600">
                  {detailHeaderTitle}
                </div>
              </div>
              <div className="detail-modal-header-actions flex shrink-0 items-center gap-2">
                {isCitizenRequestDetail && canShowCitizenWhatsAppConversation(detail, citizenSourceMessage) && (
                  <Button
                    type="button"
                    size="lg"
                    className="inline-flex items-center gap-1.5 !bg-sky-400 !text-white hover:!bg-sky-500"
                    onClick={openCitizenConversationModal}
                  >
                    <MessageSquareText className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('social.goToConversation', 'Yazışmaya Git')}
                  </Button>
                )}
                {(canApproveDetail || canAssignIncomingDetail) && (
                  <Button type="button" size="lg" variant="success" className="inline-flex items-center gap-1.5" onClick={() => void handleApproveOwner(detail.jobId)}>
                    <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('jobs.actions.approveOwner', 'Onayla')}
                  </Button>
                )}
                {canApproveTargetDetail && activeDeptId && (
                  <Button type="button" size="lg" variant="success" className="inline-flex items-center gap-1.5" onClick={() => handleApproveTarget(detail.jobId, activeDeptId)}>
                    <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('jobs.actions.approveOwner', 'Onayla')}
                  </Button>
                )}
                {canApproveIncomingCloseDetail && incomingPendingCloseTask && (
                  <Button type="button" size="lg" variant="success" className="inline-flex items-center gap-1.5" onClick={() => handleApproveIncomingCloseDetail(incomingPendingCloseTask.taskId)}>
                    <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('tasks.actions.approveClose', 'Onayla')}
                  </Button>
                )}
                {shouldShowDisabledIncomingApprove && (
                  <DisabledActionButton
                    size="lg"
                    variant="success"
                    className="inline-flex items-center gap-1.5"
                    hoverTitle={t('jobs.actions.approveUnavailable', 'Bu kayıtta onay işlemi yapılamaz')}
                  >
                    <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('jobs.actions.approveOwner', 'Onayla')}
                  </DisabledActionButton>
                )}
                {/* Taleplerim detayında, "Talebi İptal Et"in soluna Düzenle — tüm kullanıcı tiplerinde.
                    Aktif/pasif koşulu ve teal arka plan rengi gridview'daki Düzenle ile birebir aynı
                    (card 648/653/654). */}
                {isMyRequestsView && detail != null && (() => {
                  const canReporterEdit = isPresidencyReporter && (currentMyRequestsView === 'pending' || currentMyRequestsView === 'in-progress')
                  const canEditDetailJob = canReporterEdit
                    || canOperatorEditPendingExternalJob(user?.role, { ...detail, taskCount: detail.tasks?.length ?? 0 })
                    || isPreApprovalStatus(detail.status)
                    || (isManagerLike && (
                    (detail.requestType === 'ExternalUnit' && detail.status === 'PendingExternalApproval')
                    || (detail.requestType === 'InternalUnit' && detail.status === 'Active')
                    || (detail.status === 'Active' && (detail.tasks?.length ?? 0) === 0)
                  ))
                  return canEditDetailJob ? (
                    <Button
                      type="button"
                      size="lg"
                      className="inline-flex items-center gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
                      onClick={() => navigate(getRequestEditPath(detail))}
                    >
                      <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                      {t('jobs.actions.edit', 'Düzenle')}
                    </Button>
                  ) : isManagerLike || isPresidencyReporter ? (
                    <DisabledActionButton size="lg" className="inline-flex items-center gap-1.5 bg-teal-700 text-white" hoverTitle={t('jobs.actions.editUnavailable', 'Bu kayıtta düzenleme yapılamaz')}>
                      <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                      {t('jobs.actions.edit', 'Düzenle')}
                    </DisabledActionButton>
                  ) : null
                })()}
                {canForwardTargetDetail && (
                  <Button
                    type="button"
                    size="lg"
                    className="inline-flex items-center gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
                    onClick={openForwardModal}
                  >
                    <Send className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('jobs.actions.forward', 'Talebi Yönlendir')}
                  </Button>
                )}
                {canCancelDetail && (
                  <Button
                    type="button"
                    size="lg"
                    variant="destructive"
                    className="inline-flex items-center gap-1.5"
                    onClick={() => handleCancel(detail.jobId)}
                  >
                    <XCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('jobs.actions.cancel', 'İptal Et')}
                  </Button>
                )}
                {shouldShowDisabledDepartmentOutgoingCancel && (
                  <DisabledActionButton
                    size="lg"
                    variant="destructive"
                    className="inline-flex items-center gap-1.5"
                    hoverTitle={t('jobs.actions.cancelUnavailableApproved', 'Talep onaylandığı için iptal edilemez')}
                  >
                    <XCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('jobs.actions.cancel', 'İptal Et')}
                  </DisabledActionButton>
                )}
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  className="detail-print-action inline-flex items-center gap-1.5 text-slate-700 hover:bg-slate-100"
                  onClick={() => printJobDetail(detail, locale, t, { incomingTargetView: isIncomingRequestDetail })}
                  aria-label={t('common.print', 'Yazdır')}
                >
                  <Printer className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  {t('common.print', 'Yazdır')}
                </Button>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="detail-modal-header-close flex size-9 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
                  aria-label={t('common.close', 'Kapat')}
                >
                  <XIcon className="size-5" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Talep Detayları başlığı, Görev popup'undaki "İlgili Talep Detayları"/"Görev Detayları"
                  kutularıyla aynı kart tasarımı (form-card page-stack) — üstte sadece çizgi yerine tam
                  kenarlıklı kart (card 650/386). */}
              <section className="my-request-detail-main form-card page-stack mb-5">
                <MyRequestSectionHeading icon={ClipboardList} tone="primary">
                  {t('jobs.detail.requestInfo', 'Talep Detayları')}
                </MyRequestSectionHeading>
                {/* İlk satır Taleplerim gibi yekpare tek dış çerçeve (card #1536); kolon içleri border-r ile ayrılır. */}
                <div className="my-request-detail-main__grid overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
                  {/* Kolon 1: başlık + talep no/tip (sağa hizalı, card #1534) + açıklama */}
                  <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                    <MyRequestSectionHeading icon={FileText} className="my-request-title-heading">
                      <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 font-semibold text-slate-900">
                          {normalizeTitleCaseField(detail.title)}
                        </span>
                        <span className="ml-auto flex max-w-full flex-col items-end justify-center gap-1 text-right">
                          <span className="max-w-full break-words text-xs font-semibold leading-tight text-slate-500">
                            {isCitizenRequestDetail
                              ? formatCitizenRequestNumber(citizenSourceMessage ?? { createdAtUtc: detail.createdAtUtc }, locale)
                              : formatJobDisplayNumberText(detail, locale)}
                          </span>
                          {isCitizenRequestDetail ? (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold leading-tight text-orange-600">
                              {t('jobs.detail.citizenRequest', 'Vatandaş Talebi')}
                            </span>
                          ) : (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold leading-tight text-orange-600">
                              {detail.requestType === 'ExternalUnit'
                                ? t('jobs.requestType.external', 'Birim Dışı')
                                : t('jobs.requestType.internal', 'Birim İçi')}
                            </span>
                          )}
                          {forwardReason ? (
                            <span className="text-xs font-bold text-teal-700">({t('jobs.forward.badge', 'Yönlendirilen Talep')})</span>
                          ) : null}
                        </span>
                      </span>
                    </MyRequestSectionHeading>
                    <RichTextContent
                      value={detail.description}
                      emptyText={t('common.none')}
                      className="rich-text-content mt-1.5 text-xs leading-5 text-slate-900"
                    />
                  </div>
                  <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                    <MyRequestSectionHeading icon={Info} className="job-detail-card-title--spread">
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span>{t('jobs.detail.requestInfoFields', 'Talep Bilgileri')}</span>
                        {/* Vatandaş kanalı: başlık satırında sağa hizalı ikon + kanal adı (card #1532). */}
                        {isCitizenRequestDetail ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold"
                            style={{ color: getChannelLabelColor(citizenSourceMessage?.channel ?? 'WhatsApp') }}
                          >
                            <ChannelIcon channel={citizenSourceMessage?.channel ?? 'WhatsApp'} className="size-3.5 shrink-0" />
                            {getSocialChannelLabel(t, citizenSourceMessage?.channel ?? 'WhatsApp')}
                          </span>
                        ) : null}
                      </span>
                    </MyRequestSectionHeading>
                    <div className="my-request-detail-fields divide-y divide-slate-100">
                    {(isCitizenRequestDetail ? [
                      {
                        label: 'Vatandaş Adı / Telefon No',
                        value: [detail.citizenName, formatCitizenPhoneDisplay(detail.citizenPhone)].filter(Boolean).join(' / ') || '—',
                      },
                      {
                        label: 'Talep Yeri / Oluşturan',
                        value: [detail.ownerDepartmentName, detail.createdByDisplayName].filter(Boolean).join(' / ') || '—',
                      },
                      ...(shouldShowRequestApproverField(detail) ? [{
                        label: t('jobs.detail.requestApprover', 'Talebi Onaylayan'),
                        value: formatRequestApproverDisplay(detail) ?? '—',
                      }] : []),
                      {
                        label: 'Talep Yapılan Birim',
                        value: formatJobDestinationsWithAssignees(detail),
                      },
                      { label: 'Öncelik', value: getPriorityLabel(t, detail.priority) },
                    ] : [
                      {
                        label: 'Talep Yeri / Oluşturan',
                        value: [detail.ownerDepartmentName, detail.createdByDisplayName].filter(Boolean).join(' / ') || '—',
                      },
                      ...(shouldShowRequestApproverField(detail) ? [{
                        label: t('jobs.detail.requestApprover', 'Talebi Onaylayan'),
                        value: formatRequestApproverDisplay(detail) ?? '—',
                      }] : []),
                      {
                        label: 'Talep Yapılan Birim',
                        value: formatJobDestinationsWithAssignees(detail),
                      },
                      { label: 'Proje mi', value: <JobProjectValue job={detail} t={t} /> },
                      { label: 'Öncelik', value: getPriorityLabel(t, detail.priority) },
                      ...(forwardReasonDisplay ? [{ label: t('jobs.forward.reasonLabel', 'Talep Yönlenme Sebebi'), value: forwardReasonDisplay }] : []),
                    ]).map(({ label, value }) => (
                      <div key={label} className="job-detail-field-row job-detail-field-row--request-info">
                        <div className="job-detail-field-row__label">{label}</div>
                        <div className={`job-detail-field-row__value ${typeof value === 'string' ? 'text-slate-900' : ''}`}>{value}</div>
                      </div>
                    ))}
                    </div>
                  </div>
                  <div className="min-w-0 p-4">
                    {(() => {
                      // Birime Gelen / Birimden Giden Süreç kolonu Taleplerim timeline tasarımını kullanır (card #1527).
                      const processSteps = buildJobProcessSteps(t, detail, locale, {
                        hideOwnerApproval: true,
                        // Birime Gelen: Active + görev yok da UI'da Onay Bekleyen (card #1535).
                        unassignedActiveAsPending: isIncomingRequestDetail,
                      })
                      const incomingOutgoingStatusLabel = isCitizenRequestDetail
                        ? getCitizenRequestStatusLabel(t, detail)
                        : isIncomingRequestDetail
                          ? (
                            getExternalUnitTargetDisplayStatus(t, detail)
                            ?? (detail.status === 'Active' && (detail.tasks?.length ?? 0) === 0
                              ? t('jobs.statusLabel.pendingApproval', 'Onay Bekleyen')
                              : detail.status === 'Active'
                                ? t('jobs.statusLabel.inProgress', 'Yapılmakta')
                                : detail.status === 'Completed'
                                  ? t('jobs.statusLabel.completed', 'Tamamlanmış')
                                  : getJobStatusLabel(t, detail.status))
                          )
                          : getExternalUnitOwnerDisplayStatus(t, detail)
                            ?? (detail.status === 'Active'
                              ? t('jobs.statusLabel.inProgress', 'Yapılmakta')
                              : detail.status === 'Completed'
                                ? t('jobs.statusLabel.completed', 'Tamamlanmış')
                                : getJobStatusLabel(t, detail.status))
                      const dueDateContent = detailDueDateEdit?.jobId === detail.jobId ? (
                        <div className="mt-1 flex flex-col gap-1.5">
                          <DateTimePicker
                            value={detailDueDateEdit.value}
                            onChange={dateValue => setDetailDueDateEdit(current => current ? { ...current, value: dateValue, mode: 'confirm' } : current)}
                            placeholder={t('jobs.form.dueDate', 'Bitiş Tarihi')}
                            className={detailDueDateEdit.mode === 'picking' ? 'h-0 overflow-visible [&>button:first-of-type]:sr-only [&>button:nth-of-type(2)]:hidden' : 'hidden'}
                            forceUp
                            autoOpen
                            onClose={detailDueDateEdit.mode === 'picking' ? closeDetailDueDateEdit : undefined}
                          />
                          {detailDueDateEdit.mode === 'confirm' && (
                            <div className="flex max-w-[18rem] flex-col gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                              <span className="text-xs font-semibold text-slate-900">
                                {detailDueDateEdit.value
                                  ? formatDateTime(new Date(detailDueDateEdit.value).toISOString(), locale)
                                  : t('common.none')}
                              </span>
                              <div className="inline-actions justify-start gap-1.5">
                                <Button type="button" size="sm" variant="success" disabled={detailDueDateEdit.saving} onClick={() => void handleDetailDueDateSave()}>
                                  {detailDueDateEdit.saving ? t('common.loading') : t('common.save', 'Kaydet')}
                                </Button>
                                <Button type="button" size="sm" variant="secondary" disabled={detailDueDateEdit.saving} onClick={closeDetailDueDateEdit}>
                                  {t('common.cancel', 'Vazgeç')}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : jobExtraTimeReview?.jobId === detail.jobId ? (
                        <div className="mt-1 flex max-w-[20rem] flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                          <span className="text-xs font-semibold text-slate-900">
                            {jobExtraTimeReview.loading
                              ? t('common.loading')
                              : jobExtraTimeReview.proposedDueDateUtc
                                ? `${t('tasks.actions.extraTimeRequest', 'Ek süre iste')}: ${formatDateTime(jobExtraTimeReview.proposedDueDateUtc, locale)}`
                                : t('tasks.actions.extraTimePendingMarker', '(Ek süre talebi)')}
                          </span>
                          <div className="inline-actions justify-start gap-1.5">
                            <Button type="button" size="sm" variant="success" disabled={jobExtraTimeReview.saving || jobExtraTimeReview.loading} onClick={() => void handleJobExtraTimeDecision('approve')}>
                              {jobExtraTimeReview.saving ? t('common.loading') : t('common.approve', 'Onayla')}
                            </Button>
                            <Button type="button" size="sm" variant="destructive" disabled={jobExtraTimeReview.saving || jobExtraTimeReview.loading} onClick={() => void handleJobExtraTimeDecision('reject')}>
                              {t('common.reject', 'Reddet')}
                            </Button>
                            <Button type="button" size="sm" variant="secondary" disabled={jobExtraTimeReview.saving} onClick={() => setJobExtraTimeReview(null)}>
                              {t('common.cancel', 'Vazgeç')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{formatDueDateTime(detail.dueDateUtc, locale)}</span>
                          {canChangeDetailDueDate && (
                            <button
                              type="button"
                              className="text-xs font-bold text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
                              onClick={openDetailDueDateEdit}
                            >
                              {t('common.change', 'Değiştir')}
                            </button>
                          )}
                          {isManagerLike && detail.tasks.some(task => task.hasPendingExtraTimeRequest) && (
                            <button
                              type="button"
                              className="text-xs font-bold text-amber-600 underline underline-offset-2 hover:text-amber-700"
                              onClick={() => void openJobExtraTimeReview()}
                            >
                              {t('tasks.actions.viewExtraTimeRequest', 'Ek süre talebini gör')}
                            </button>
                          )}
                        </div>
                      )
                      return (
                        <JobProcessTimeline
                          steps={processSteps}
                          locale={locale}
                          recoveredFromCancellation={isJobRecoveredFromCancellation(detail)}
                          statusContent={(
                            <span className={`inline ${detailStatusClass}`}>
                              {incomingOutgoingStatusLabel}
                            </span>
                          )}
                          statusActorName={shouldShowJobStatusActorName(detail) ? detail.statusActorDisplayName : null}
                          dueDateContent={dueDateContent}
                        />
                      )
                    })()}
                  </div>
                </div>
                {isRequestDetailContext && canManageCoordination && (
                  <div className={`mt-4 grid gap-4 ${showManagerNoteColumn ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                    {/* Adres Bilgileri — talep oluştururken girilen opsiyonel adres alanları (card 442) */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                        {t('address.detailSectionTitle', 'Adres Bilgileri')}
                      </h3>
                      {renderJobAddressInfo(detail)}
                    </div>
                    {/* 3. sütun: Yönetici Notu — aktif gelen/giden talepte yönetici tarafından düzenlenebilir. */}
                    {showManagerNoteColumn && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">{t('jobs.managerNote.title', 'Yönetici Notu')}</h3>
                        {!canEditManagerNote ? (
                          // Salt-okunur: terminal durum veya yetkisiz kullanıcı.
                          detail.managerNote ? (
                            <p className="whitespace-pre-wrap text-sm text-slate-800">{detail.managerNote}</p>
                          ) : (
                            <p className="text-sm text-slate-400">{t('jobs.managerNote.empty', 'Talep için yönetici notu bulunmamaktadır.')}</p>
                          )
                        ) : (detail.managerNote && !managerNoteEditing) ? (
                          // Not var, düzenleme kapalı: notu göster + "Değiştir/Sil" tetikleyici (card #727)
                          <>
                            <p className="whitespace-pre-wrap text-sm text-slate-800">{detail.managerNote}</p>
                            <div className="mt-3 flex justify-end">
                              <Button
                                type="button"
                                size="sm"
                                className="bg-teal-700 text-white hover:bg-teal-800"
                                onClick={() => {
                                  setManagerNoteDraft(detail.managerNote ?? '')
                                  setManagerNoteEditing(true)
                                  setManagerNoteSaved(false)
                                }}
                              >
                                {t('jobs.managerNote.editOrDelete', 'Değiştir/Sil')}
                              </Button>
                            </div>
                          </>
                        ) : (
                          // Ekleme (not yok) veya düzenleme (not var + editing): textbox + butonlar (card #727)
                          <>
                            {managerNoteSaved ? (
                              <p className="mb-3 text-sm font-semibold text-emerald-600">{t('jobs.managerNote.saved', 'Notunuz Eklendi')}</p>
                            ) : null}
                            <textarea
                              className="field-textarea manager-note-textarea min-h-24 w-full text-xs placeholder:text-xs"
                              rows={3}
                              value={managerNoteDraft}
                              onChange={e => {
                                setManagerNoteDraft(e.target.value)
                                setManagerNoteSaved(false)
                              }}
                              placeholder={t('jobs.managerNote.placeholder', 'Yönetici notu girin...')}
                            />
                            <div className="mt-3 flex justify-end gap-2">
                              {managerNoteEditing ? (
                                <>
                                  <Button type="button" variant="success" size="sm" disabled={managerNoteSaving || !managerNoteDraft.trim()} onClick={() => void handleSaveManagerNote()}>
                                    {t('common.change', 'Değiştir')}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    disabled={managerNoteSaving}
                                    onClick={() => setConfirmDialog({
                                      title: t('common.delete', 'Sil'),
                                      message: 'Notu silmek istediğinize emin misiniz?',
                                      variant: 'destructive',
                                      confirmLabel: t('common.delete', 'Sil'),
                                      cancelLabel: t('common.cancel', 'İptal'),
                                      onConfirm: () => void handleDeleteManagerNote(),
                                    })}
                                  >
                                    {t('common.delete', 'Sil')}
                                  </Button>
                                </>
                              ) : (
                                <Button type="button" variant="success" size="sm" disabled={managerNoteSaving || !managerNoteDraft.trim()} onClick={() => void handleSaveManagerNote()}>
                                  {t('jobs.managerNote.add', 'Not Ekle')}
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {/* 4. sütun: Ekler / Fotoğraflar — yalnızca Birimden Giden Onay Bekleyen/Taleplerim
                        (onay öncesi) talepte düzenlenebilir; onaylanmış/birime gelen talepte salt-okunur (card 537/540). */}
                    {(() => {
                      // Başkanlık seviyesi üst düzey yönetici (Reporter + Başkanlık birimi): Taleplerim →
                      // Bekleyen/Yapılmakta Olan/Son Tarihi Geçmiş detayında, talep onaylanmış/aktif olsa da
                      // Ek/Fotoğraf ekleyebilir; kilit uyarısı yerine "Dosya ekle" gösterilir (card 646).
                      const canPresidencyEditAttachments = isPresidencyReporter && isMyRequestsView
                        && (currentMyRequestsView === 'pending' || currentMyRequestsView === 'in-progress' || currentMyRequestsView === 'overdue')
                      const canEditJobAttachments = (isPreApprovalStatus(detail.status) && (isDepartmentOutgoingView || isMyRequestsView))
                        || canPresidencyEditAttachments
                      // Birime gelen (incoming) talepte kilit uyarısı yalnızca talep gerçekten kapandığında
                      // gösterilir; onay bekleyen/aktif incoming talepte "Talep onaylandığı için..." yer almasın (card 632).
                      const isTerminalRequestStatus = detail.status === 'Completed' || detail.status === 'Cancelled' || detail.status === 'Rejected'
                      const showAttachmentLockNotice = !canEditJobAttachments
                        && (isRequestDetailContext ? isTerminalRequestStatus : !isPreApprovalStatus(detail.status))
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                            {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
                          </h3>
                          <AttachmentSection
                            attachments={detail.attachments ?? []}
                            readOnly={!canEditJobAttachments}
                            displayMode="rich-list"
                            emptyText={t('attachments.requestEmpty', 'Talep için ek/fotoğraf bulunmamaktadır.')}
                            onUpload={canEditJobAttachments ? async (file, onProgress) => {
                              setAttachmentUploading(true)
                              try {
                                await api.uploadJobAttachment(detail.jobId, file, onProgress)
                                invalidateJobs(queryClient, detail.jobId)
                                await refreshDetail()
                              } finally {
                                setAttachmentUploading(false)
                              }
                            } : undefined}
                            onDelete={canEditJobAttachments ? async (id) => {
                              await api.deleteAttachment(id)
                              invalidateJobs(queryClient, detail.jobId)
                              await refreshDetail()
                            } : undefined}
                            disabled={attachmentUploading}
                          />
                          {showAttachmentLockNotice && (
                            <p className="mt-2 text-xs font-medium text-amber-600">
                              {detail.status === 'Completed'
                                ? t('attachments.lockedCompletedRequest', 'Talep tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')
                                : (detail.status === 'Cancelled' || detail.status === 'Rejected')
                                  ? t('attachments.lockedCancelled', 'Talep iptal edildiği için sonradan Ek/Fotoğraf eklenemez.')
                                  : t('attachments.lockedApproved', 'Talep onaylandığı için sonradan Ek/Fotoğraf eklenemez.')}
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
                {!isRequestDetailContext && (isManagerLike || canMutatePreApprovalJob(detail)) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canMutatePreApprovalJob(detail) && (
                      <Button type="button" variant="secondary" className="inline-flex items-center gap-1.5" onClick={() => void openEditModal(detail)}>
                        <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t('jobs.actions.edit', 'Düzenle')}
                      </Button>
                    )}
                    {canMutatePreApprovalJob(detail) && (
                      <Button type="button" variant="destructive" onClick={() => handleDelete(detail.jobId)}>{t('jobs.actions.delete')}</Button>
                    )}
                  </div>
                )}
              </section>
               
              {detailLoading && <div className="loading">{t('common.loading')}</div>}

            {showWorkflowSections && <section className="mb-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">{t('jobs.detail.departments')}</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('departments.name', 'Müdürlük')}</th>
                    <th>{t('jobs.detail.role')}</th>
                    <th>{t('jobs.detail.approvalStatus', 'Onay Durumu')}</th>
                    <th>{isDepartmentOutgoingView ? t('jobs.detail.approvalDateOutgoing', 'Talep Sahibi Birim Onay Tarihi') : t('jobs.detail.ownerApprovalDate', 'Talebi Yapan Birim Onay Tarihi')}</th>
                    <th>{isDepartmentOutgoingView ? t('jobs.detail.approverOutgoing', 'Talep Sahibi Birim Onaycısı') : t('jobs.detail.ownerApprover', 'Talebi Yapan Birim Onaycısı')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.departments.map(d => (
                    <tr key={d.jobDepartmentId}>
                      <td>{d.departmentName ?? '—'}</td>
                      <td>{t(`jobs.roles.${d.role}`, d.role)}</td>
                      <td>{t(`jobs.approvalStatuses.${d.approvalStatus}`, d.approvalStatus)}</td>
                      <td>{formatDateTime(d.decidedAtUtc, locale)}</td>
                      <td>{d.approvedByDisplayName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </section>}

            {detail.latitude != null && detail.longitude != null && (
              <section className="mb-5">
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                  {t('location.mapSectionTitle', 'Konum')}
                </h3>
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${(detail.longitude - 0.005).toFixed(6)},${(detail.latitude - 0.005).toFixed(6)},${(detail.longitude + 0.005).toFixed(6)},${(detail.latitude + 0.005).toFixed(6)}&layer=mapnik&marker=${detail.latitude},${detail.longitude}`}
                    className="h-64 w-full"
                    title={t('location.mapTitle', 'Konum Haritası')}
                    allowFullScreen
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {detail.latitude.toFixed(6)}, {detail.longitude.toFixed(6)}
                </p>
              </section>
            )}

            {showWorkflowSections && <section className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">{t('jobs.detail.tasks')}</h3>
              </div>
              {detail.tasks.length === 0 ? (
                <div className="empty-state">{t('jobs.detail.noTasks')}</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('tasks.columns.title', 'Başlık')}</th>
                      <th>{t('tasks.columns.assignedTo', 'Atanan')}</th>
                      <th>{t('tasks.columns.owner', 'Sahip')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.tasks.map(tk => (
                      <tr key={tk.taskId}>
                        <td><span className="cell-title">{tk.title}</span></td>
                        <td>{tk.assignedUserDisplayName ?? tk.assignedDepartmentName ?? '—'}</td>
                        <td>{tk.ownerDisplayName ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>}

            {/* Yöneticisi/koordinasyon yetkisi olmayan kullanıcılar için ikinci satır standart iki kolon tasarımı. */}
            {isRequestDetailContext && !canManageCoordination && (() => {
              // Incoming talepte kilit uyarısı yalnızca talep kapandığında gösterilir (card 632).
              const showAttachmentLockNotice = detail.status === 'Completed' || detail.status === 'Cancelled' || detail.status === 'Rejected'
              const requestAttachmentLockText = detail.status === 'Completed'
                ? t('attachments.lockedCompletedRequest', 'Talep tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')
                : (detail.status === 'Cancelled' || detail.status === 'Rejected')
                  ? t('attachments.lockedCancelled', 'Talep iptal edildiği için sonradan Ek/Fotoğraf eklenemez.')
                  : t('attachments.lockedApproved', 'Talep onaylandığı için sonradan Ek/Fotoğraf eklenemez.')
              return (
                <div className={`mb-5 grid gap-4 ${isCitizenRequestDetail ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                      {t('address.detailSectionTitle', 'Adres Bilgileri')}
                    </h3>
                    {renderJobAddressInfo(detail)}
                  </section>
                  {!isCitizenRequestDetail ? (
                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                      {t('jobs.managerNote.title', 'Yönetici Notu')}
                    </h3>
                    {detail.managerNote ? (
                      <p className="whitespace-pre-wrap text-sm text-slate-800">{detail.managerNote}</p>
                    ) : (
                      <p className="text-sm text-slate-400">{t('jobs.managerNote.empty', 'Talep için yönetici notu bulunmamaktadır.')}</p>
                    )}
                  </section>
                  ) : null}
                  <section className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                      {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
                    </h3>
                    <AttachmentSection
                      attachments={detail.attachments ?? []}
                      readOnly
                      displayMode="rich-list"
                      emptyText={t('attachments.requestEmpty', 'Talep için ek/fotoğraf bulunmamaktadır.')}
                    />
                    {showAttachmentLockNotice && (
                      <p className="mt-2 text-xs font-medium text-amber-600">
                        {requestAttachmentLockText}
                      </p>
                    )}
                  </section>
                </div>
              )
            })()}

            {!isRequestDetailContext && (() => {
              const readOnlyRequestAttachments = isRequestDetailContext
              const requestAttachmentLockText = detail.status === 'Completed'
                ? t('attachments.lockedCompletedRequest', 'Talep tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')
                : (detail.status === 'Cancelled' || detail.status === 'Rejected')
                  ? t('attachments.lockedCancelled', 'Talep iptal edildiği için sonradan Ek/Fotoğraf eklenemez.')
                  : t('attachments.lockedApproved', 'Talep onaylandığı için sonradan Ek/Fotoğraf eklenemez.')
              return (
                <section className="mb-5">
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                    {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
                  </h3>
                  <AttachmentSection
                    attachments={detail.attachments ?? []}
                    readOnly={readOnlyRequestAttachments}
                    displayMode="rich-list"
                    emptyText={readOnlyRequestAttachments ? t('attachments.requestEmpty', 'Talep için ek/fotoğraf bulunmamaktadır.') : undefined}
                    onUpload={!readOnlyRequestAttachments ? async (file, onProgress) => {
                      setAttachmentUploading(true)
                      try {
                        await api.uploadJobAttachment(detail.jobId, file, onProgress)
                        invalidateJobs(queryClient, detail.jobId)
                        await refreshDetail()
                      } finally {
                        setAttachmentUploading(false)
                      }
                    } : undefined}
                    onDelete={!readOnlyRequestAttachments ? async (id) => {
                      await api.deleteAttachment(id)
                      invalidateJobs(queryClient, detail.jobId)
                      await refreshDetail()
                    } : undefined}
                    disabled={attachmentUploading}
                  />
                  {readOnlyRequestAttachments && (
                    <p className="mt-2 text-xs font-medium text-amber-600">
                      {requestAttachmentLockText}
                    </p>
                  )}
                </section>
              )
            })()}

            {showWorkflowSections && <section className="mb-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                {t('auditLog.title', 'Denetim İzi')}
              </h3>
              {auditLogQuery.isLoading ? (
                <div className="loading">{t('common.loading')}</div>
              ) : !auditLogQuery.data || auditLogQuery.data.length === 0 ? (
                <div className="empty-state">{t('auditLog.empty', 'Henüz denetim kaydı bulunmuyor')}</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('auditLog.columns.date', 'Tarih')}</th>
                      <th>{t('auditLog.columns.action', 'İşlem')}</th>
                      <th>{t('auditLog.columns.actor', 'Kullanıcı')}</th>
                      <th>{t('auditLog.columns.notes', 'Notlar')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogQuery.data.map(entry => (
                      <tr key={entry.auditLogId}>
                        <td className="text-xs text-slate-500">{new Date(entry.eventTimeUtc).toLocaleString(locale)}</td>
                        <td className="font-semibold">{getAuditActionLabel(t, entry.action)}</td>
                        <td>{entry.actorDisplayName}</td>
                        <td className="text-xs text-slate-500">{entry.notes ? formatAuditNotes(t, entry.notes) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>}

            {/* Görev Detayları — Taleplerim ile aynı ikonlu boxed-kart bileşeni, kod tekrarı yerine
                doğrudan paylaşılan bileşen kullanılıyor (card #1524, ikinci reopen). */}
            {isRequestDetailContext && (
              <MyRequestTaskDetailsSection
                detail={detail}
                locale={locale}
                onDownloadTaskAttachment={(attachmentId, fileName) => void handleDownloadTaskAttachment(attachmentId, fileName)}
              />
            )}
           </div>
          </section>
          )}
        </div>,
        document.body
      )}

      {editModal && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
        >
          <form
            className="w-full max-w-lg rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
            onSubmit={e => void handleSaveEdit(e)}
          >
            <h2 className="mb-4 text-lg font-bold">{t('jobs.editModal.title', 'Talebi Düzenle')}</h2>
            <div className="page-stack">
              <div className="form-group">
                <label className="form-label">{t('jobs.form.title', 'Başlık')}</label>
                <input
                  className="input"
                  value={editModal.title}
                  onChange={e => setEditModal(m => m && ({ ...m, title: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.form.description', 'Açıklama')} <span className="text-xs font-normal text-slate-400">(max 400 karakter)</span> <span className="text-red-500">*</span></label>
                <RichTextEditor
                  value={editModal.description}
                  onChange={val => setEditModal(m => m && ({ ...m, description: val }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('jobs.form.priority', 'Öncelik')}</label>
                <select
                  className="input"
                  value={editModal.priority}
                  onChange={e => setEditModal(m => m && ({ ...m, priority: e.target.value }))}
                >
                  <option value="Low">{t('enum.priority.Low', 'Düşük')}</option>
                  <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
                  <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                  <option value="VeryHigh">{t('enum.priority.VeryHigh', 'Çok Yüksek')}</option>
                  <option value="Critical">{t('enum.priority.Critical', 'Kritik')}</option>
                </select>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">{t('jobs.form.startDate', 'Başlangıç Tarihi')}</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={editModal.startDateUtc}
                    onChange={e => setEditModal(m => m && ({ ...m, startDateUtc: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('jobs.form.dueDate', 'Bitiş Tarihi')}</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={editModal.dueDateUtc}
                    onChange={e => setEditModal(m => m && ({ ...m, dueDateUtc: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditModal(null)}>
                {t('common.cancel', 'İptal')}
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? t('common.saving', 'Kaydediliyor...') : t('common.save', 'Kaydet')}
              </Button>
            </div>
          </form>
        </div>,
        document.body
      )}
      {staffAssignModal && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
        >
          <div className="relative w-full max-w-sm rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setStaffAssignModal(null)} aria-label={t('common.close', 'Kapat')} className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
              <XIcon className="size-4" />
            </button>
            <h3 className="mb-3 border-b border-slate-200 pb-3 text-base font-bold text-slate-950">
              {t('jobs.actions.approveAndAssign', 'Onayla ve Personel Ata')}
            </h3>
            {staffAssignModal.requiresProjectConfirmation ? (
              <JobProjectConfirmationPrompt
                t={t}
                name="project-confirmation"
                decision={staffAssignModal.projectDecision}
                onDecisionChange={value => setStaffAssignModal(current => current ? { ...current, projectDecision: value } : current)}
              />
            ) : null}
            {staffAssignModal.showProjectNotice ? (
              <JobProjectDeclaredNotice t={t} />
            ) : null}
            <p className="mb-4 text-sm text-slate-600">
              {t('jobs.actions.approveAndAssignHelp', 'Görevi atamak istediğiniz personeli seçin.')}
            </p>
            {staffAssignModal.users.length === 0 ? (
              <p className="mb-4 text-sm text-slate-400">{t('jobs.actions.noStaffFound', 'Birimde personel bulunamadı.')}</p>
            ) : (
              <div className="mb-4 flex max-h-48 flex-col gap-1 overflow-y-auto">
                {staffAssignModal.users.map(item => (
                  <label key={item.userId} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="size-4 rounded"
                      checked={staffAssignModal.selectedUserIds.includes(item.userId)}
                      onChange={event => {
                        setStaffAssignModal(current => {
                          if (!current) return current
                          const selectedUserIds = event.target.checked
                            ? [...current.selectedUserIds, item.userId]
                            : current.selectedUserIds.filter(id => id !== item.userId)
                          return { ...current, selectedUserIds }
                        })
                      }}
                    />
                    <span className="text-sm text-slate-800">
                      {item.displayName}
                      {staffAssignModal.selfRequestedOwnerUserId === item.userId && (
                        <span className="ml-1 font-semibold text-emerald-700">
                          {t('jobs.actions.selfRequestedOwner', '(Görevi kendisi yapmak istiyor.)')}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="success"
                disabled={staffAssignModal.saving || (staffAssignModal.requiresProjectConfirmation && staffAssignModal.projectDecision === null)}
                onClick={() => void handleStaffAssignConfirm()}
              >
                {staffAssignModal.saving ? t('common.loading') : t('common.approve', 'Onayla')}
              </Button>
              <Button type="button" variant="secondary" disabled={staffAssignModal.saving} onClick={() => setStaffAssignModal(null)}>
                {t('common.cancel', 'Vazgeç')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
      {forwardModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="presentation">
          <section className="relative w-full max-w-md rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="forward-job-dialog-title">
            <button type="button" onClick={() => !forwardModal.saving && setForwardModal(null)} aria-label={t('common.close', 'Kapat')} className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
              <XIcon className="size-4" />
            </button>
            <h3 id="forward-job-dialog-title" className="mb-3 border-b border-slate-200 pb-3 text-base font-bold text-slate-950">
              {t('jobs.forward.title', 'Talebi Yönlendir')}
            </h3>
            <p className="mb-4 text-sm text-slate-600">
              {t('jobs.forward.selectDepartment', 'Talebi yönlendirmek istediğiniz birimi seçin.')}
            </p>
            <div className="mb-4">
              <label className="job-field-label" htmlFor="forward-target-dept">
                {t('jobs.form.targetDepartment', 'Talebin Gideceği Birim')} <span className="text-red-500">*</span>
              </label>
              <SingleSelectDropdown
                options={forwardDepartmentOptions}
                value={forwardModal.departmentId}
                onChange={departmentId => setForwardModal(current => (current ? { ...current, departmentId } : current))}
                placeholder={t('requests.create.targetDepartmentsPlaceholder', 'Departman seçiniz')}
              />
            </div>
            <div className="mb-4">
              <label className="job-field-label" htmlFor="forward-note">
                {t('jobs.forward.noteLabel', 'Talebi Yönlendirme Notu')} <span className="text-red-500">*</span>
              </label>
              <textarea
                id="forward-note"
                className="field-textarea"
                rows={3}
                maxLength={100}
                value={forwardModal.note}
                onChange={event => setForwardModal(current => (current ? { ...current, note: event.target.value } : current))}
                placeholder={t('jobs.forward.notePlaceholder', 'Yönlendirme sebebini yazın')}
              />
              <div className="mt-0.5 text-right text-[0.7rem] text-slate-400">{forwardModal.note.length}/100</div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                className="bg-teal-700 text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={forwardModal.saving || !forwardModal.departmentId || !forwardModal.note.trim()}
                onClick={() => void handleForwardConfirm()}
              >
                {forwardModal.saving ? t('common.loading') : t('jobs.actions.forwardConfirm', 'Yönlendir')}
              </Button>
              <Button type="button" variant="secondary" disabled={forwardModal.saving} onClick={() => setForwardModal(null)}>
                {t('common.cancel', 'İptal')}
              </Button>
            </div>
          </section>
        </div>,
        document.body
      )}
      {cancelModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="presentation">
          <section className="form-card page-stack relative w-full max-w-md" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cancel-job-dialog-title">
            <button type="button" onClick={() => setCancelModal(null)} aria-label={t('common.close', 'Kapat')} className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
              <XIcon className="size-4" />
            </button>
            <h2 id="cancel-job-dialog-title" className="border-b border-slate-200 pb-2 pr-8 text-base font-semibold text-slate-950">{t('jobs.actions.cancelJob', 'Talebi İptal Et')}</h2>
            <p className="text-base font-medium leading-6 text-slate-700">{t('jobs.actions.cancelJobHelp', 'Talebi iptal etmek için neden belirtiniz.')}</p>
            <label className="job-field">
              <span className="job-field-label">{t('tasks.actions.cancelReason', 'İptal Nedeni')} <span className="text-[10px] font-normal text-slate-400">(max 200 karakter)</span> <span className="text-red-500">*</span></span>
              <textarea
                className="field-textarea"
                rows={3}
                maxLength={200}
                value={cancelModal.reason}
                onChange={e => setCancelModal(m => m ? { ...m, reason: e.target.value } : null)}
                placeholder={t('tasks.actions.cancelReasonPlaceholder', 'İptal nedenini açıklayınız...')}
                autoFocus
              />
            </label>
            <div className="inline-actions justify-end">
              <Button type="button" variant="secondary" onClick={() => setCancelModal(null)}>
                {t('common.dismiss', 'Vazgeç')}
              </Button>
              <Button type="button" variant="destructive" disabled={cancelModal.saving || !cancelModal.reason.trim()} onClick={() => void handleCancelConfirm()}>
                {cancelModal.saving ? t('common.loading') : t('jobs.actions.cancel', 'İptal Et')}
              </Button>
            </div>
          </section>
        </div>,
        document.body
      )}
      {conversationModal && (
        <WhatsAppConversationModal
          socialMessageId={conversationModal.socialMessageId}
          citizenHandle={conversationModal.citizenHandle}
          citizenPhone={conversationModal.citizenPhone}
          onClose={() => setConversationModal(null)}
        />
      )}
    </div>
  )
}
