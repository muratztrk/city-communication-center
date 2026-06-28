import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '../hooks/useSortable'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import type React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Search, X as XIcon } from 'lucide-react'
import { DueDatePill } from '../components/ui/due-date-pill'
import { DateCell } from '../components/ui/date-cell'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { invalidateJobs, invalidateTasks } from '../api/cacheInvalidation'
import { queryKeys } from '../api/queryKeys'
import { getActiveDepartmentId } from '../api/http'
import { AttachmentSection } from '../components/ui/AttachmentSection'
import { AddressDetailFields } from '../components/ui/AddressDetailFields'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { DisabledActionButton } from '../components/ui/DisabledActionButton'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { RichTextContent } from '../components/ui/RichTextContent'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { Department, JobDepartmentInfo, JobDetail, JobListScope, JobSummary, SocialMessage, User } from '../types/platform'
import { formatJobDestinationsWithAssignees, formatRequestApproverDisplay, shouldShowJobStatusActorName, shouldShowRequestApproverField } from '../utils/jobDetails'
import { formatAuditNotes, getAuditActionLabel, getLocale, getPriorityColorClass, getPriorityLabel, getStatusPillClass, getJobStatusTone, getTaskStatusLabel, getSocialChannelLabel } from '../utils/localization'
import { getSelfRequestedOwnerUserId } from '../utils/ownerTaskRequest'
import {
  isCitizenRequestJob,
  canShowCitizenWhatsAppConversation,
  formatCitizenRequestNumber,
  formatCitizenPhoneDisplay,
  getCitizenRequestStatusLabel,
  shouldShowCitizenTargetApprovalDate,
} from '../utils/citizenRequests'
import { getExternalUnitOwnerDisplayStatus, getExternalUnitTargetDisplayStatus } from '../utils/externalUnitRequests'
import { RequestNumberWithTypeLabel } from '../utils/requestDisplay'
import { isAssignableDepartmentUser } from '../utils/userDepartments'
import { hasCitizenRequestManagerRole } from '../utils/roleAccess'
import { ChannelIcon } from '../components/ui/channel-icon'
import { WhatsAppConversationModal } from '../components/WhatsAppConversationModal'
import { TablePagination } from '../components/ui/table-pagination'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { printHtmlDocument } from '../utils/printDocument'
import { richTextToPlainText } from '../utils/richText'

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
      {/* Talep Oluştur'daki ile aynı takvim tasarımı (DateTimePicker), tarih aralığı için iki seçici. */}
      <DateTimePicker value={filterFrom} onChange={onFromChange} placeholder="Başlangıç tarihi" className="scope-chip-date" forceDown />
      <span className="text-xs text-slate-400">–</span>
      <DateTimePicker value={filterTo} onChange={onToChange} placeholder="Bitiş tarihi" className="scope-chip-date" forceDown />
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

function getRequestEditPath(
  job: { jobId: string; requestType: string; sourceType: string },
): string {
  // Vatandaş talepleri (her rol için) citizen formunda düzenlenir; kaydedince Vatandaş Talepleri
  // ekranına döner (returnTo=social) ve VT- numarası korunur — Taleplerim'e düşmez (card #1077).
  if (isCitizenRequestJob({ requestType: job.requestType, sourceType: job.sourceType })) {
    return `/requests/new?kind=citizen&editJobId=${job.jobId}&returnTo=social`
  }
  return `/requests/new?kind=${job.requestType === 'ExternalUnit' ? 'external' : 'internal'}&editJobId=${job.jobId}`
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
  options?: { incomingTargetView?: boolean },
) {
  const fd = (d: string | null | undefined) => formatDateTime(d ?? null, locale)
  const jobDisplayNumber = detail.jobNumber != null && detail.jobNumberYear != null
    ? `T-${detail.jobNumberYear}-${detail.jobNumber}`
    : `T-${detail.jobNumberYear ?? new Date().getFullYear()}-Onay Bekleyen`
  const ownerApprovalDate = detail.departments.find(department => department.role === 'Owner')?.decidedAtUtc ?? null
  const targetApprovalDate = detail.departments.find(department => department.role === 'Target')?.decidedAtUtc ?? null
  const requestDetailRows: Array<[string, string]> = [
    ['Talep No', jobDisplayNumber],
    ['Talep Başlığı', detail.title],
    ['Talep Yeri / Oluşturan', [detail.ownerDepartmentName, detail.createdByDisplayName].filter(Boolean).join(' / ') || '—'],
    ...(shouldShowRequestApproverField(detail)
      ? [['Talebi Onaylayan', formatRequestApproverDisplay(detail) ?? '—'] as [string, string]]
      : []),
    ['Talebin Gittiği Birim', formatJobDestinationsWithAssignees(detail)],
    ['Proje mi', detail.isProject ? t('common.yes', 'Evet') : t('common.no', 'Hayır')],
    ['Öncelik', getPriorityLabel(t, detail.priority)],
    ['Durum', buildPrintJobStatusLabel(detail, t, options)],
    ['Talep Tarihi', fd(detail.createdAtUtc)],
    ...(isCitizenRequestJob(detail) ? [] : [['Talebin Birim Yöneticisinin Onay Tarihi', fd(ownerApprovalDate)] as [string, string]]),
    ...(shouldShowCitizenTargetApprovalDate(detail)
      ? [['Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi', fd(targetApprovalDate)] as [string, string]]
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
}

export function JobsPage({ fixedScope, mode = 'external', notificationJobId, detailOnly = false, detailContextOverride, onNotificationDetailClose }: JobsPageProps) {
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
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [cancelModal, setCancelModal] = useState<{ jobId: string; reason: string; saving: boolean } | null>(null)
  const [staffAssignModal, setStaffAssignModal] = useState<{
    jobId: string
    selectedUserIds: string[]
    users: User[]
    saving: boolean
    selfRequestedOwnerUserId: string | null
    approvalRequired: boolean
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
    if (!((isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'rejected')) count += 1
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
  const detailStatusClass = detail?.status === 'Active'
    || detail?.status === 'PendingOwnerApproval'
    || detail?.status === 'PendingExternalApproval'
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
      result = result.filter(job => {
        const d = job.createdAtUtc?.slice(0, 10)
        if (!d) return false
        if (filterFrom && d < filterFrom.slice(0, 10)) return false
        if (filterTo && d > filterTo.slice(0, 10)) return false
        return true
      })
    }

    if (searchText.trim()) {
      // Türkçe büyük "İ" -> "i" doğru eşleşsin diye tr-locale lowercase (birim adları için kritik).
      const q = searchText.toLocaleLowerCase('tr')
      // Banner araması tüm sütunlarda arar (sadece Başlık değil; Gittiği Yer/Oluşturan birimleri dahil).
      result = result.filter(job => {
        const targets = getTargetJobDepartments(job)
        const destinationText = targets.length > 0
          ? targets.map(d => d.departmentName ?? '').filter(Boolean).join(', ')
          : job.ownerDepartmentName ?? ''
        const ownerDecidedAtUtc = job.departments?.find(d => d.role === 'Owner')?.decidedAtUtc ?? null
        const deptNames = (job.departments ?? []).map(d => d.departmentName ?? '').filter(Boolean)
        const haystack = [
          formatJobDisplayNumber(job),
          job.title,
          getJobStatusLabel(t, job.status),
          getPriorityLabel(t, job.priority),
          formatDateTime(job.createdAtUtc ?? null, locale),
          formatDateTime(job.dueDateUtc ?? null, locale),
          formatDateTime(ownerDecidedAtUtc, locale),
          formatDateTime(job.completedAtUtc ?? null, locale),
          formatDateTime(job.updatedAtUtc ?? null, locale),
          destinationText,
          job.ownerDepartmentName ?? '',
          job.assignedUserDisplayName ?? '',
          job.createdByDisplayName ?? '',
          ...deptNames,
        ].join(' ').toLocaleLowerCase('tr')
        return haystack.includes(q)
      })
    }

    return result
  }, [activeDeptId, currentDepartmentOutgoingView, currentMyRequestsView, currentRequestFlowFilter, filterFrom, filterTo, hideCitizenRequestsFromMyRequests, isDepartmentOutgoingView, isManagerLike, isMyRequestsView, isReporter, jobs, scope, searchText, showRequestFlowFilters, t, locale])

  const { sortKey: jobsSortKey, sortDir: jobsSortDir, toggleSort: _toggleJobsSort, sortItems: sortJobs } = useSortable()
  const { filters: jobFilters, setFilter: setJobFilter, clearFilters: clearJobFilters, matchesFilters: jobMatchesFilters } = useColumnFilters()

  const toggleJobsSort = (key: string) => {
    _toggleJobsSort(key)
    setJobsPage(1)
  }

  const columnFilteredJobs = useMemo(
    () => visibleJobs
      .map(job => {
        const targets = getTargetJobDepartments(job)
        const destinationText = targets.length > 0
          ? targets.map(d => d.departmentName ?? '').filter(Boolean).join(', ')
          : job.ownerDepartmentName ?? ''
        const ownerDecidedAtUtc = job.departments?.find(d => d.role === 'Owner')?.decidedAtUtc ?? null
        const cancelReturnStatus = 'İptal'
        const statusSortText = getJobDisplayStatus(t, job)
        return { ...job, destinationText, ownerDecidedAtUtc, cancelReturnStatus, statusSortText }
      })
      .filter(job => jobMatchesFilters(job, (key, row) => {
        if (key === 'destinationText') return row.destinationText
        if (key === 'cancelReturnStatus') return 'İptal'
        if (key === 'jobNumber') return formatJobDisplayNumber(row)
        if (key === 'status') return getJobDisplayStatus(t, row)
        if (key === 'priority') return getPriorityLabel(t, row.priority)
        if (key === 'createdAtUtc') return formatDateTime(row.createdAtUtc ?? null, locale)
        if (key === 'dueDateUtc') return formatDateTime(row.dueDateUtc ?? null, locale)
        if (key === 'ownerDecidedAtUtc') return formatDateTime(row.ownerDecidedAtUtc ?? null, locale)
        if (key === 'completedAtUtc') return formatDateTime(row.completedAtUtc ?? null, locale)
        if (key === 'updatedAtUtc') return formatDateTime(row.updatedAtUtc ?? null, locale)
        return String((row as unknown as Record<string, unknown>)[key] ?? '')
      })),
    [visibleJobs, jobMatchesFilters, t, locale],
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
  }, [detail?.jobId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (isIncomingRequestDetail) {
      setError(null)
      try {
        const jobDetail = detail?.jobId === jobId ? detail : await api.getJobById(jobId)
        const departmentId = activeDeptId ?? jobDetail.ownerDepartmentId
        const users = await api.getUsers()
        setStaffAssignModal({
          jobId,
          selectedUserIds: [],
          users: users.filter(u => isAssignableDepartmentUser(u, departmentId, user?.userId)),
          saving: false,
          // Birim içi talepte oluşturan kişi kendini görev sahibi seçtiyse işaretle (card 616).
          selfRequestedOwnerUserId: getSelfRequestedOwnerUserId(jobDetail),
          approvalRequired: jobDetail.status === 'PendingOwnerApproval',
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.error'))
      }
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
  }

  const handleApproveTarget = (jobId: string, departmentId: string) => {
    setConfirmDialog({
      message: t('jobs.approveTargetConfirm', 'Bu koordine talebi onaylamak istediğinizden emin misiniz?'),
      variant: 'primary',
      confirmLabel: t('common.approve', 'Onayla'),
      onConfirm: async () => {
        setError(null)
        try {
          await api.approveJobTarget(jobId, departmentId)
          invalidateJobs(queryClient, jobId)
          await refreshDetail()
          await reload()
        } catch (err) {
          setError(err instanceof Error ? err.message : t('common.error'))
        }
      },
    })
  }

  const handleStaffAssignConfirm = async () => {
    if (!staffAssignModal) return
    const { jobId, selectedUserIds, approvalRequired } = staffAssignModal
    setStaffAssignModal(current => current ? { ...current, saving: true } : null)
    try {
      if (approvalRequired) {
        await api.approveJobOwner(jobId)
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
                  {!((isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'rejected') && <col className="grid-col-due" />}
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
                  {!((isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'rejected') && <FilterableTh filterKey="dueDateUtc" filterValue={jobFilters['dueDateUtc'] ?? ''} onFilter={setJobFilter} sortKey="dueDateUtc" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.dueDate')}</FilterableTh>}
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
                  return (
                  <tr key={job.jobId}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(jobsPage - 1) * jobsPageSize + index + 1}</td>
                    {(isMyRequestsView || isDepartmentOutgoingView) && (
                    <td className="table-number-cell font-mono text-xs text-slate-500">
                      <div className="table-number-cell__value">{formatJobDisplayNumber(job)}</div>
                      <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(job.priority)}`}>(Öncelik:{getPriorityLabel(t, job.priority)})</div>
                    </td>
                    )}
                    {(isMyRequestsView || isDepartmentOutgoingView) && <td><DateCell value={job.createdAtUtc ?? null} locale={locale} /></td>}
                    {isDepartmentOutgoingView && <td>{job.createdByDisplayName ?? '—'}</td>}
                    <td className="font-semibold"><span className="cell-title">{job.title}</span></td>
                    {showTaskOwnerColumn && <td>{job.assignedUserDisplayName ?? '—'}</td>}
                    <td>
                      {isMyRequestsView || isDepartmentOutgoingView ? (
                        renderOutgoingDestination(job)
                      ) : renderJobDepartments(job)}
                    </td>
                    {!(isMyRequestsView || isDepartmentOutgoingView) && <td>{getPriorityLabel(t, job.priority)}</td>}
                    {!isMyRequestsView && !isDepartmentOutgoingView && <td>{job.isProject ? t('common.yes', 'Evet') : t('common.no', 'Hayır')}</td>}
                    {!isMyRequestsView && !isDepartmentOutgoingView && <td>{job.taskCount}</td>}
                    {!((isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'rejected') && <td><DueDatePill value={job.dueDateUtc} completedAtUtc={job.completedAtUtc} locale={locale} /></td>}
                    {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'approved' && <td><DateCell value={job.ownerDecidedAtUtc} locale={locale} /></td>}
                    {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'completed' && <td><DateCell value={job.completedAtUtc} locale={locale} /></td>}
                    {(isMyRequestsView || isDepartmentOutgoingView) && activeJobView === 'rejected' && <td><DateCell value={job.updatedAtUtc ?? null} locale={locale} /></td>}
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
                                  <span className="text-[0.68rem] font-bold text-black">{formatDateTime(statusDate, locale)}</span>
                                </span>
                              : getJobDisplayStatus(t, job)}
                          </StatusPill>
                        </td>
                      )
                    })()}
                    <td className="actions-cell">
                      <div className="request-actions">
                        <Button size="sm" variant="secondary" onClick={() => openDetail(job.jobId)}>{t('jobs.actions.details')}</Button>
                        {/* Düzenle — onay öncesi (hedef onaylamadan) talebi Talep Oluştur sayfasında dolu olarak aç (card 452). */}
                        {isMyRequestsView && (() => {
                          const canReporterEdit = isPresidencyReporter && (currentMyRequestsView === 'pending' || currentMyRequestsView === 'in-progress')
                          const canEdit =
                          canReporterEdit
                          || canOperatorEditPendingExternalJob(user?.role, job)
                          || isPreApprovalStatus(job.status)
                          || (isManagerLike && (
                            (job.requestType === 'ExternalUnit' && job.status === 'PendingExternalApproval')
                            || (job.requestType === 'InternalUnit' && job.status === 'Active')
                            || (job.status === 'Active' && job.taskCount === 0)
                          ))

                          if (canEdit) {
                            return (
                              <Button
                                size="sm"
                                className="bg-teal-700 text-white hover:bg-teal-800"
                                onClick={() => navigate(getRequestEditPath(job))}
                              >
                                {t('jobs.actions.edit', 'Düzenle')}
                              </Button>
                            )
                          }

                          // Onaylanmış (approved) + Tümü + Süresi Geçmiş görünümlerde düzenlenemeyen
                          // kayıtlarda da hizalama için pasif Düzenle göster (card #1076).
                          if (activeJobView === 'all' || activeJobView === 'overdue' || activeJobView === 'approved') {
                            return (
                              <DisabledActionButton
                                size="sm"
                                className="button-placeholder bg-teal-700 text-white"
                                hoverTitle={t('jobs.actions.editUnavailable', 'Bu kayıtta düzenleme yapılamaz')}
                              >
                                {t('jobs.actions.edit', 'Düzenle')}
                              </DisabledActionButton>
                            )
                          }

                          return null
                        })()}
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
                        {/* Talebi oluşturan kullanıcı talebini iade edemez; yalnızca iptal edebilir.
                            Başkanlık seviyesi üst düzey yönetici, "Tüm Taleplerim"de iptal edilemeyen
                            satırlarda görsel bütünlük için pasif "İptal" görür (card 660). */}
                        {isMyRequestsView && (() => {
                          const canCancel = job.status === 'PendingOwnerApproval' || job.status === 'PendingExternalApproval' || job.status === 'Active'
                          if (canCancel) {
                            return <Button size="sm" variant="destructive" onClick={() => handleCancel(job.jobId)}>{t('jobs.actions.cancel', 'İptal')}</Button>
                          }
                          if (activeJobView === 'all') {
                            return (
                              <DisabledActionButton size="sm" variant="destructive" hoverTitle={t('jobs.actions.cancelUnavailable', 'Bu kayıt iptal edilemez')}>
                                {t('jobs.actions.cancel', 'İptal')}
                              </DisabledActionButton>
                            )
                          }
                          return null
                        })()}
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
          <section
            className="detail-modal-shell flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
              <div className="min-w-0">
                <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-slate-600">
                  {detailHeaderTitle}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isCitizenRequestDetail && canShowCitizenWhatsAppConversation(detail, citizenSourceMessage) && (
                  <Button
                    type="button"
                    className="bg-[#007985] text-white hover:bg-[#006570]"
                    onClick={openCitizenConversationModal}
                  >
                    {t('social.goToConversation', 'Yazışmaya Git')}
                  </Button>
                )}
                {(canApproveDetail || canAssignIncomingDetail) && (
                  <Button type="button" variant="success" onClick={() => void handleApproveOwner(detail.jobId)}>
                    {t('jobs.actions.approveOwner', 'Onayla')}
                  </Button>
                )}
                {canApproveTargetDetail && activeDeptId && (
                  <Button type="button" variant="success" onClick={() => handleApproveTarget(detail.jobId, activeDeptId)}>
                    {t('jobs.actions.approveOwner', 'Onayla')}
                  </Button>
                )}
                {shouldShowDisabledIncomingApprove && (
                  <DisabledActionButton
                    variant="success"
                    hoverTitle={t('jobs.actions.approveUnavailable', 'Bu kayıtta onay işlemi yapılamaz')}
                  >
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
                      className="bg-teal-700 text-white hover:bg-teal-800"
                      onClick={() => navigate(getRequestEditPath(detail))}
                    >
                      {t('jobs.actions.edit', 'Düzenle')}
                    </Button>
                  ) : isManagerLike || isPresidencyReporter ? (
                    <DisabledActionButton className="bg-teal-700 text-white" hoverTitle={t('jobs.actions.editUnavailable', 'Bu kayıtta düzenleme yapılamaz')}>
                      {t('jobs.actions.edit', 'Düzenle')}
                    </DisabledActionButton>
                  ) : null
                })()}
                {canCancelDetail && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => handleCancel(detail.jobId)}
                  >
                    {t('jobs.actions.cancelJob', 'Talebi İptal Et')}
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={() => printJobDetail(detail, locale, t, { incomingTargetView: isIncomingRequestDetail })}>{t('common.print', 'Yazdır')}</Button>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
                  aria-label={t('common.close', 'Kapat')}
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Talep Detayları başlığı, Görev popup'undaki "İlgili Talep Detayları"/"Görev Detayları"
                  kutularıyla aynı kart tasarımı (form-card page-stack) — üstte sadece çizgi yerine tam
                  kenarlıklı kart (card 650/386). */}
              <section className="form-card page-stack mb-5">
                <div className="text-sm font-semibold text-emerald-600">
                  {t('jobs.detail.requestInfo', 'Talep Detayları')}
                </div>
                <div className="grid gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
                  <div className="min-w-0 divide-y divide-slate-100">
                    {(isCitizenRequestDetail ? [
                      {
                        label: 'Vatandaş Talep No',
                        value: (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span>{formatCitizenRequestNumber(citizenSourceMessage ?? { createdAtUtc: detail.createdAtUtc }, locale)}</span>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-500">
                              ({t('jobs.detail.citizenRequest', 'Vatandaş Talebi')}
                              <ChannelIcon channel={citizenSourceMessage?.channel ?? 'WhatsApp'} className="size-3.5 shrink-0" />
                              <span className="text-slate-900">{getSocialChannelLabel(t, citizenSourceMessage?.channel ?? 'WhatsApp')}</span>)
                            </span>
                          </span>
                        ),
                      },
                      {
                        label: 'Vatandaş Adı / Telefon No',
                        value: [detail.citizenName, formatCitizenPhoneDisplay(detail.citizenPhone)].filter(Boolean).join(' / ') || '—',
                      },
                      { label: 'Talep Başlığı', value: detail.title },
                      {
                        label: 'Talep Yeri / Oluşturan',
                        value: [detail.ownerDepartmentName, detail.createdByDisplayName].filter(Boolean).join(' / ') || '—',
                      },
                      ...(shouldShowRequestApproverField(detail) ? [{
                        label: t('jobs.detail.requestApprover', 'Talebi Onaylayan'),
                        value: formatRequestApproverDisplay(detail) ?? '—',
                      }] : []),
                      {
                        label: 'Talebin Gittiği Birim',
                        value: formatJobDestinationsWithAssignees(detail),
                      },
                      { label: 'Öncelik', value: getPriorityLabel(t, detail.priority) },
                    ] : [
                      {
                        label: 'Talep No',
                        value: (
                          <RequestNumberWithTypeLabel
                            job={detail}
                            t={t}
                            locale={locale}
                          />
                        ),
                      },
                      { label: 'Talep Başlığı', value: detail.title },
                      {
                        label: 'Talep Yeri / Oluşturan',
                        value: [detail.ownerDepartmentName, detail.createdByDisplayName].filter(Boolean).join(' / ') || '—',
                      },
                      ...(shouldShowRequestApproverField(detail) ? [{
                        label: t('jobs.detail.requestApprover', 'Talebi Onaylayan'),
                        value: formatRequestApproverDisplay(detail) ?? '—',
                      }] : []),
                      {
                        label: 'Talebin Gittiği Birim',
                        value: formatJobDestinationsWithAssignees(detail),
                      },
                      { label: 'Proje mi', value: detail.isProject ? t('common.yes', 'Evet') : t('common.no', 'Hayır') },
                      { label: 'Öncelik', value: getPriorityLabel(t, detail.priority) },
                    ]).map(({ label, value }) => (
                      <div key={label} className={`flex items-start gap-2 px-3 py-2${label === 'Öncelik' ? ' border-b border-slate-100' : ''}`}>
                        <span className="w-36 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                        <span className="min-w-0 break-words text-sm text-slate-900">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                    <div className="divide-y divide-slate-100">
                      {[
                        {
                          label: 'Durum',
                          // Durum + (durumu belirleyen kullanıcı) + tıklanabilir İptal/Tamamlama Notu (card 643).
                          value: (
                            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className={detailStatusClass}>
                                {isCitizenRequestDetail
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
                                        : getJobStatusLabel(t, detail.status))}
                                {shouldShowJobStatusActorName(detail) ? ` (${detail.statusActorDisplayName})` : ''}
                              </span>
                              {(detail.status === 'Cancelled' || detail.status === 'Rejected') && detail.cancelReason ? (
                                <span className="inline-flex items-center text-red-600">
                                  <span>(</span>
                                  <button
                                    type="button"
                                    className="font-semibold hover:text-red-700"
                                    onClick={() => setConfirmDialog({ title: t('jobs.detail.cancelNote', 'İptal Notu'), titleDivider: true, message: detail.cancelReason!, hideCancel: true, variant: 'destructive', confirmLabel: t('common.close', 'Kapat'), onConfirm: () => {} })}
                                  >
                                    <span className="underline underline-offset-2">{t('jobs.detail.cancelNote', 'İptal Notu')}</span>
                                  </button>
                                  <span>)</span>
                                </span>
                              ) : null}
                              {detail.status === 'Completed' && detail.completionNote ? (
                                <span className="inline-flex items-center text-emerald-600">
                                  <span>(</span>
                                  <button
                                    type="button"
                                    className="font-semibold hover:text-emerald-700"
                                    onClick={() => setConfirmDialog({ title: t('jobs.detail.completionNote', 'Tamamlama Notu'), titleDivider: true, message: richTextToPlainText(detail.completionNote), hideCancel: true, variant: 'success', confirmLabel: t('common.close', 'Kapat'), onConfirm: () => {} })}
                                  >
                                    <span className="underline underline-offset-2">{t('jobs.detail.completionNote', 'Tamamlama Notu')}</span>
                                  </button>
                                  <span>)</span>
                                </span>
                              ) : null}
                            </span>
                          ),
                        },
                        { label: 'Talep Tarihi', value: formatDateTime(detail.createdAtUtc, locale) },
                        ...(isMyRequestsView && !isCitizenRequestDetail ? [{
                          // Talebi yapan birimin yöneticisinin onay tarihi (Owner JobDepartment) — card 6a397bf6.
                          label: 'Talebin Birim Yöneticisinin Onay Tarihi',
                          value: formatDueDateTime(
                            detail.departments.find(department => department.role === 'Owner')?.decidedAtUtc ?? null,
                            locale,
                          ),
                        }] : []),
                        ...(shouldShowCitizenTargetApprovalDate(detail) ? [{
                          // Talebi alan (hedef) birimin onay tarihi (Target JobDepartment).
                          label: 'Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi',
                          value: formatDueDateTime(
                            detail.departments.find(department => department.role === 'Target')?.decidedAtUtc ?? null,
                            locale,
                          ),
                        }] : []),
                        // Talep tamamlandıysa/iptal edildiyse Son Tarih'ten önce ilgili tarihi göster (card #715).
                        ...(detail.status === 'Completed'
                          ? [{ label: 'Tamamlanma Tarihi', value: <span className="text-emerald-600">{formatDateTime(detail.completedAtUtc ?? null, locale)}</span> }]
                          : detail.status === 'Cancelled'
                            ? [{ label: 'İptal Tarihi', value: <span className="text-red-600">{formatDateTime(detail.updatedAtUtc ?? null, locale)}</span> }]
                            : []),
                        { label: 'Son Tarih', value: formatDueDateTime(detail.dueDateUtc, locale) },
                      ].map(({ label, value }) => (
                        <div key={label} className={`flex flex-col gap-0.5 px-4 py-2${label === 'Son Tarih' ? ' border-b border-slate-100' : ''}`}>
                          <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                            {label}
                            {label === 'Son Tarih' && canChangeDetailDueDate && detailDueDateEdit?.jobId !== detail.jobId && (
                              <button
                                type="button"
                                className="font-bold text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
                                onClick={openDetailDueDateEdit}
                              >
                                {t('common.change', 'Değiştir')}
                              </button>
                            )}
                          </span>
                          {label === 'Son Tarih' && detailDueDateEdit?.jobId === detail.jobId ? (
                            // Takvim yukarı yönde açılır; tetikleyici alan gizli, "Ek Süre İste"deki seç akışıyla
                            // aynı: tarih seçilince (Seç) onay kutusu çıkar, Kaydet ile uygulanır (card 588).
                            <div className="mt-1 flex flex-col gap-1.5">
                              <DateTimePicker
                                value={detailDueDateEdit.value}
                                onChange={dateValue => setDetailDueDateEdit(current => current ? { ...current, value: dateValue, mode: 'confirm' } : current)}
                                placeholder={t('jobs.form.dueDate', 'Bitiş Tarihi')}
                                className={detailDueDateEdit.mode === 'picking' ? 'h-0 overflow-visible [&>button:first-of-type]:sr-only [&>button:nth-of-type(2)]:hidden' : 'hidden'}
                                forceUp
                                autoOpen
                                // Seçim yapmadan takvim kapatılırsa düzenlemeyi sıfırla; "Değiştir" yeniden tıklanabilir kalsın (card 615).
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
                          ) : (
                            <span className="text-sm text-slate-900">{value}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                    <div className="border-b border-slate-200 px-4 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t('jobs.form.description', 'Açıklama')}
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <RichTextContent value={detail.description} emptyText={t('common.none')} className="rich-text-content text-sm leading-6 text-slate-900" />
                    </div>
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
                              className="field-textarea min-h-24 w-full text-xs placeholder:text-xs"
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
                            displayMode="list"
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
                      <Button type="button" variant="secondary" onClick={() => void openEditModal(detail)}>
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
                      displayMode="list"
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

            {/* Görev Detayları — ilişkili görev varsa talep detayının sonundaki, Görevlerim
                pop-up'ıyla aynı üç sütunlu özet kartta gösterilir (card 649). */}
            {isRequestDetailContext && detail.tasks.length > 0 && (
              <section className="form-card page-stack mb-5">
                <div className="text-sm font-semibold text-emerald-600">
                  {t('tasks.detail.title', 'Görev Detayları')}
                </div>
                <div className="space-y-3">
                  {detail.tasks.map(task => {
                    // "Oluşturan" = görevi değil TALEBİ oluşturan kullanıcı (request creator). JobQueries
                    // task.createdByDisplayName görevi oluşturan yöneticiyi veriyor; talep oluşturanı
                    // detail.createdByDisplayName'dir (card #716). GetTasksQuery zaten talep oluşturanını
                    // verdiği için TasksPage Görev Detayları doğruydu.
                    const taskLocation = [task.ownerDepartmentName ?? detail.ownerDepartmentName, detail.createdByDisplayName ?? task.createdByDisplayName]
                      .filter(Boolean)
                      .join(' / ') || '—'
                    // "Atanmış" ise görevi ATAYAN YÖNETİCİNİN adı parantez içinde gösterilir (görev
                    // sahibi/atanan kullanıcı değil); Görevlerim pop-up'ındaki format (card #709, reopened).
                    const taskType = task.jobSourceType === 'Routine'
                      ? t('tasks.type.routine', 'Rutin')
                      : task.assigningManagerDisplayName
                        ? `${t('tasks.type.assigned', 'Atanmış')} (${task.assigningManagerDisplayName})`
                        : t('tasks.type.assigned', 'Atanmış')
                    const taskStatus = (
                      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={task.currentStatus === 'Completed'
                          ? 'text-emerald-600'
                          : (task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected')
                            ? 'text-red-600'
                            // "Yapılmakta" (Assigned/InProgress) turuncu — Talep Detayları ile aynı (card #725).
                            : (task.currentStatus === 'Assigned' || task.currentStatus === 'InProgress')
                              ? 'text-[#f97316]'
                              : 'text-slate-900'}
                        >
                          {getTaskStatusLabel(t, task.currentStatus)}
                        </span>
                        {task.currentStatus === 'Cancelled' && task.revisionReason ? (
                          <span className="inline-flex items-center text-red-600">
                            <span>(</span>
                            <button
                              type="button"
                              className="font-semibold hover:text-red-700"
                              onClick={() => setConfirmDialog({ title: t('tasks.detail.cancelNote', 'İptal Notu'), message: task.revisionReason!, hideCancel: true, variant: 'primary', confirmLabel: t('common.close', 'Kapat'), onConfirm: () => {} })}
                            >
                              <span className="underline underline-offset-2">{t('tasks.detail.cancelNote', 'İptal Notu')}</span>
                            </button>
                            <span>)</span>
                          </span>
                        ) : null}
                        {task.currentStatus === 'Completed' && task.notes ? (
                          <span className="inline-flex items-center text-emerald-600">
                            <span>(</span>
                            <button
                              type="button"
                              className="font-semibold hover:text-emerald-700"
                              onClick={() => setConfirmDialog({ title: t('tasks.detail.completionNote', 'Tamamlama Notu'), message: richTextToPlainText(task.notes), hideCancel: true, variant: 'primary', confirmLabel: t('common.close', 'Kapat'), onConfirm: () => {} })}
                            >
                              <span className="underline underline-offset-2">{t('tasks.detail.completionNote', 'Tamamlama Notu')}</span>
                            </button>
                            <span>)</span>
                          </span>
                        ) : null}
                      </span>
                    )

                    return (
                      <div key={task.taskId} className="grid gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
                        <div className="min-w-0 divide-y divide-slate-100">
                          {[
                            { label: t('tasks.columns.taskNo', 'Görev No'), value: task.taskNumber != null ? `G-${task.taskNumberYear ?? new Date().getFullYear()}-${task.taskNumber}` : '—' },
                            { label: t('tasks.columns.title', 'Görev Başlığı'), value: task.title },
                            { label: t('tasks.columns.requestLocation', 'Talep Yeri / Oluşturan'), value: taskLocation },
                            { label: t('tasks.columns.owner', 'Görev Sahibi'), value: task.assignedUserDisplayName ?? task.ownerDisplayName ?? task.assignedDepartmentName ?? '—' },
                            { label: t('tasks.columns.taskType', 'Görev Tipi'), value: taskType },
                            // Öncelik, Görevlerim pop-up'ıyla aynı kalsın diye Görev Tipi'nin altına alındı (card #705/649).
                            { label: t('tasks.columns.priority', 'Öncelik'), value: getPriorityLabel(t, task.priority) },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-start gap-2 px-3 py-2">
                              <span className="w-36 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                              <span className="min-w-0 break-words text-sm text-slate-900">{value}</span>
                            </div>
                          ))}
                        </div>
                        <div className="divide-y divide-slate-100 border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                          {[
                            // Öncelik, sol kolona Görev Tipi'nin altına taşındı (card #705/649).
                            { label: t('tasks.columns.status', 'Durum'), value: taskStatus },
                            { label: t('tasks.columns.taskDate', 'Görev Tarihi'), value: formatDateTime(task.createdAtUtc ?? null, locale) },
                            // Görev tamamlandıysa/iptal edildiyse Son Tarih'ten önce ilgili tarihi göster (card #710).
                            ...(task.currentStatus === 'Completed'
                              ? [{ label: t('tasks.columns.completedAt', 'Tamamlanma Tarihi'), value: <span className="text-emerald-600">{formatDateTime(task.completedAtUtc ?? null, locale)}</span> }]
                              : task.currentStatus === 'Cancelled'
                                ? [{ label: t('tasks.columns.cancelledAt', 'İptal Tarihi'), value: <span className="text-red-600">{formatDateTime(task.updatedAtUtc ?? null, locale)}</span> }]
                                : []),
                            { label: t('tasks.columns.dueDate', 'Son Tarih'), value: formatDateTime(task.dueDateUtc, locale) },
                          ].map(({ label, value }) => (
                            // Son satır "Son Tarih"in altına kapanış çizgisi (card #712/#713, card 649 aynası).
                            <div key={label} className={`px-3 py-2${label === 'Son Tarih' ? ' border-b border-slate-100' : ''}`}>
                              <div className="text-xs font-semibold text-slate-500">{label}</div>
                              <div className="mt-0.5 break-words text-sm text-slate-900">{value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-slate-200 bg-white p-3 lg:border-l lg:border-t-0">
                          {detail.status === 'Completed' && task.currentStatus === 'Completed' ? (
                            <div className="grid min-h-full gap-3 lg:grid-cols-2">
                              <div className="min-w-0 border-b border-slate-200 pb-3 lg:border-b-0 lg:border-r lg:pr-3 lg:pb-0">
                                <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {t('tasks.detail.description', 'Açıklama')}
                                </div>
                                <RichTextContent
                                  value={task.description?.trim() ? task.description : detail.description}
                                  emptyText={t('tasks.detail.noDescription', 'Açıklama yok')}
                                  className="rich-text-content text-sm leading-6 text-slate-900"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {t('tasks.detail.attachments', 'Görev Ekleri')}
                                </div>
                                {(task.attachments?.length ?? 0) > 0 ? (
                                  <ul className="space-y-1 text-[11px] leading-4">
                                    {task.attachments!.map(att => (
                                      <li key={att.attachmentId}>
                                        <button
                                          type="button"
                                          className="w-full break-words text-left text-[11px] font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                                          onClick={() => void handleDownloadTaskAttachment(att.attachmentId, att.fileName)}
                                        >
                                          {att.fileName}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-slate-400">{t('attachments.taskEmpty', 'Görev için ek/fotoğraf bulunmamaktadır.')}</p>
                                )}
                                <p className="mt-2 text-xs text-orange-500">{t('attachments.taskLockedCompleted', 'Görev tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')}</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {t('tasks.detail.description', 'Açıklama')}
                              </div>
                              <RichTextContent
                                value={task.description?.trim() ? task.description : detail.description}
                                emptyText={t('tasks.detail.noDescription', 'Açıklama yok')}
                                className="rich-text-content text-sm leading-6 text-slate-900"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
           </div>
          </section>
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
                <label className="form-label">{t('jobs.form.description', 'Açıklama')}</label>
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
            <h3 className="mb-1 text-base font-bold text-slate-950">
              {t('jobs.actions.approveAndAssign', 'Onayla ve Personel Ata')}
            </h3>
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
              <Button type="button" variant="success" disabled={staffAssignModal.saving} onClick={() => void handleStaffAssignConfirm()}>
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
      {cancelModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="presentation">
          <section className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cancel-job-dialog-title">
            <button type="button" onClick={() => setCancelModal(null)} aria-label={t('common.close', 'Kapat')} className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
              <XIcon className="size-4" />
            </button>
            <h2 id="cancel-job-dialog-title" className="mb-3 border-b border-slate-200 pb-2 pr-8 text-base font-semibold text-slate-950">{t('jobs.actions.cancelJob', 'Talebi İptal Et')}</h2>
            <p className="mt-2 text-base font-medium leading-6 text-slate-700">{t('jobs.actions.cancelJobHelp', 'Talebi iptal etmek için neden belirtiniz.')}</p>
            <label className="job-field mt-5">
              <span className="job-field-label">{t('tasks.actions.cancelReason', 'İptal Nedeni')}</span>
              <textarea
                className="field-textarea"
                rows={3}
                value={cancelModal.reason}
                onChange={e => setCancelModal(m => m ? { ...m, reason: e.target.value } : null)}
                placeholder={t('tasks.actions.cancelReasonPlaceholder', 'İptal nedenini açıklayınız...')}
                autoFocus
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
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
