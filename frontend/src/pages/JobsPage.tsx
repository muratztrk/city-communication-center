import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '../hooks/useSortable'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useColumnFilters } from '../hooks/useColumnFilters'
import type React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Search, X as XIcon } from 'lucide-react'
import { DueDatePill } from '../components/ui/due-date-pill'
import { DateCell } from '../components/ui/date-cell'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { getActiveDepartmentId } from '../api/http'
import { AttachmentSection } from '../components/ui/AttachmentSection'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { PromptDialog } from '../components/ui/prompt-dialog'
import type { PromptDialogState } from '../components/ui/prompt-dialog'
import { RichTextContent } from '../components/ui/RichTextContent'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { StatusPill } from '../components/ui/status-pill'
import { MultiSelectDropdown } from '../components/ui/multi-select-dropdown'
import { useAuth } from '../context/AuthContext'
import type { Department, JobDepartmentInfo, JobDetail, JobListScope, JobSummary } from '../types/platform'
import { formatAuditNotes, getAuditActionLabel, getLocale, getPriorityColorClass, getPriorityLabel } from '../utils/localization'
import { TablePagination } from '../components/ui/table-pagination'

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

function isClosedJobStatus(status: string): boolean {
  return status === 'Completed' || status === 'Cancelled' || status === 'Rejected' || status === 'RevisionRequested'
}

function isJobOverdue(job: JobSummary): boolean {
  return job.dueDateUtc != null && new Date(job.dueDateUtc).getTime() < Date.now()
}

function getJobStatusLabel(t: TFunction, status: string): string {
  return t(`enum.jobStatus.${status}`, { defaultValue: status })
}

function getJobDisplayStatus(t: TFunction, job: Pick<JobSummary, 'status' | 'dueDateUtc'>): string {
  if (job.status === 'Completed') return t('jobs.statusLabel.completed', 'Tamamlanmış')
  if (job.status === 'Cancelled') return t('jobs.statusLabel.cancelled', 'İptal')
  if (job.status === 'Rejected') return t('jobs.statusLabel.rejected', 'Reddedildi')
  if (job.status === 'RevisionRequested') return t('jobs.statusLabel.returned', 'İade Edildi')
  if (job.dueDateUtc != null && new Date(job.dueDateUtc).getTime() < Date.now()) {
    return t('jobs.statusLabel.overdue', 'Son Tarihi Geçmiş')
  }
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

function formatJobDestinationsWithAssignees(job: JobDetail): string {
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

function formatJobDisplayNumber(job: JobSummary): string {
  if (job.jobNumber != null && job.jobNumberYear != null) {
    return `T-${job.jobNumberYear}-${job.jobNumber}`
  }
  const year = job.jobNumberYear ?? new Date().getFullYear()
  return `T-${year}-Onay Bekleyen`
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function printJobDetail(detail: import('../types/platform').JobDetail, locale: string) {
  const win = window.open('', '_blank', 'width=820,height=960')
  if (!win) return
  const fd = (d: string | null) => d ? new Date(d).toLocaleString(locale, { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
  const deptRows = detail.departments.map(d => `<tr><td>${escHtml(d.departmentName ?? '—')}</td><td>${escHtml(d.role)}</td></tr>`).join('')
  const taskRows = detail.tasks.map(tk => `<tr><td>${escHtml(tk.title)}</td><td>${escHtml(tk.assignedUserDisplayName ?? tk.assignedDepartmentName ?? '—')}</td><td>${escHtml(tk.ownerDisplayName ?? '—')}</td></tr>`).join('')
  const attachItems = (detail.attachments ?? []).map(a => `<li>${escHtml(a.fileName)} (${(a.fileSizeBytes / 1024).toFixed(1)} KB)</li>`).join('')
  win.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${escHtml(detail.title)}</title><style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:2rem;margin:0}
    h1{font-size:18px;margin:4px 0 8px}
    .kicker{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#666}
    .meta{font-size:11px;color:#444;margin-bottom:1rem;line-height:1.7}
    .section{margin-top:1.5rem}
    .section-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:8px;color:#333}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}
    th{background:#f0f0f0;font-weight:bold}
    .desc{border:1px solid #ccc;padding:8px;border-radius:3px;background:#fafafa;font-size:11px;line-height:1.6}
    .footer{margin-top:2rem;font-size:10px;color:#aaa}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="kicker">Talep Detayı</div>
  <h1>${escHtml(detail.title)}</h1>
  <div class="meta">
    <strong>Durum:</strong> ${escHtml(detail.status)} &nbsp;|&nbsp;
    <strong>Öncelik:</strong> ${escHtml(detail.priority)} &nbsp;|&nbsp;
    <strong>Talep Tipi:</strong> ${escHtml(detail.requestType)}<br/>
    <strong>Sahip Müdürlük:</strong> ${escHtml(detail.ownerDepartmentName ?? '—')} &nbsp;|&nbsp;
    <strong>Proje mi:</strong> ${detail.isProject ? 'Evet' : 'Hayır'}<br/>
    <strong>Oluşturan:</strong> ${escHtml(detail.createdByDisplayName ?? '—')} &nbsp;|&nbsp;
    <strong>Tarih:</strong> ${fd(detail.createdAtUtc)}
    ${detail.dueDateUtc ? ` &nbsp;|&nbsp; <strong>Termin:</strong> ${fd(detail.dueDateUtc)}` : ''}
  </div>
  <div class="section">
    <div class="section-title">Açıklama</div>
    <div class="desc">${detail.description ?? '<em>Açıklama yok</em>'}</div>
  </div>
  <div class="section">
    <div class="section-title">Müdürlükler</div>
    <table><thead><tr><th>Müdürlük</th><th>Rol</th></tr></thead><tbody>${deptRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Görevler (${detail.tasks.length})</div>
    ${detail.tasks.length === 0 ? '<p style="color:#888;font-size:11px">Görev yok</p>' : `<table><thead><tr><th>Başlık</th><th>Atanan</th><th>Sahip</th></tr></thead><tbody>${taskRows}</tbody></table>`}
  </div>
  ${attachItems ? `<div class="section"><div class="section-title">Ekler (${(detail.attachments ?? []).length})</div><ul style="font-size:11px;margin:4px 0;padding-left:1.2rem">${attachItems}</ul></div>` : ''}
  <div class="footer">Yazdırma tarihi: ${new Date().toLocaleString(locale)}</div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`)
  win.document.close()
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
    return value === 'external-pending' || value === 'in-progress' || value === 'overdue' || value === 'completed' || value === 'rejected' || value === 'all' ? value : 'pending'
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

function hasApprovedTargetDepartment(job: JobSummary, activeDepartmentId: string | null): boolean {
  const targetDepartments = job.departments?.filter(department =>
    department.role === 'Target' && department.approvalStatus === 'Approved') ?? []
  if (!activeDepartmentId) return targetDepartments.length > 0
  return targetDepartments.some(department => department.departmentId === activeDepartmentId)
}

function filterMyRequests(jobs: JobSummary[], view: MyRequestsView, isReporter = false, isManager = false, activeDepartmentId: string | null = null): JobSummary[] {
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
      return jobs.filter(job =>
        job.status === 'Active'
        && job.taskCount > 0
        && hasApprovedTargetDepartment(job, activeDepartmentId)
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
      (job.status === 'PendingOwnerApproval' || job.status === 'PendingExternalApproval')
      && !isJobOverdue(job))
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
}

export function JobsPage({ fixedScope, mode = 'external' }: JobsPageProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  const isReporter = user?.role === 'Reporter'
  const locale = getLocale(i18n.language)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeDeptId, setActiveDeptId] = useState(() => getActiveDepartmentId())
  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [jobsPage, setJobsPage] = useState(1)
  const [jobsPageSize, setJobsPageSize] = useState(10)
  const [departments, setDepartments] = useState<Department[]>([])

  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const auditLogQuery = useQuery({
    queryKey: ['job-audit-log', detail?.jobId],
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
  const [coordinatingDepartmentIds, setCoordinatingDepartmentIds] = useState<string[]>([])
  const [coordinatingSaving, setCoordinatingSaving] = useState(false)
  const [managerNoteDraft, setManagerNoteDraft] = useState('')
  const [managerNoteSaving, setManagerNoteSaving] = useState(false)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null)
  const [cancelModal, setCancelModal] = useState<{ jobId: string; reason: string; saving: boolean } | null>(null)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [searchText, setSearchText] = useState('')

  const isMyRequestsView = mode === 'myRequests'
  const isDepartmentOutgoingView = mode === 'departmentOutgoing'
  const detailContext = searchParams.get('context')
  const detailHeaderTitle = isMyRequestsView
    ? t('nav.myRequests', 'Taleplerim')
    : isDepartmentOutgoingView
      ? t('nav.outgoingRequests', 'Birimden Giden Talepler')
      : detailContext === 'incoming'
        ? t('nav.incomingRequests', 'Birime Gelen Talepler')
        : detailContext === 'social'
          ? t('nav.social', 'Vatandaş Talepleri')
          : t('jobs.detail.title', 'İş Detayı')
  const isRequestDetailContext = isMyRequestsView || isDepartmentOutgoingView || detailContext === 'incoming'
  const canManageCoordination = isManagerLike || isReporter
  const canApproveDetail = isRequestDetailContext && isManagerLike && detail?.status === 'PendingOwnerApproval'
  const canCancelDetail = isRequestDetailContext
    && (isManagerLike || isMyRequestsView)
    && detail != null
    && (detail.status === 'PendingOwnerApproval' || detail.status === 'PendingExternalApproval' || detail.status === 'Active')
  const showWorkflowSections = !isMyRequestsView
    && !isDepartmentOutgoingView
    && detailContext !== 'incoming'
    && detailContext !== 'social'
  // Yönetici Notu: Birimden Giden → Bekleyen detayında (hedef birim onaylamadığı sürece) düzenlenebilir;
  // not, Birime Gelen detayında salt-okunur görünür (card 453).
  const isJobPendingTargetApproval = detail != null
    && (detail.status === 'PendingOwnerApproval'
      || detail.status === 'PendingExternalApproval'
      || (detail.status === 'Active' && (detail.tasks?.length ?? 0) === 0))
  const canEditManagerNote = isDepartmentOutgoingView && isManagerLike && isJobPendingTargetApproval
  const currentDepartmentOutgoingView = getDepartmentOutgoingView(searchParams.get('view'))
  const currentRequestFlowFilter = getRequestFlowFilter(searchParams.get('flow'))
  const rawMyRequestsView = getMyRequestsView(searchParams.get('view'), isManagerLike, isReporter)
  const currentMyRequestsView = isManagerLike && currentRequestFlowFilter === 'internal' && rawMyRequestsView === 'external-pending'
    ? 'in-progress'
    : rawMyRequestsView
  const activeJobView = isMyRequestsView ? currentMyRequestsView : currentDepartmentOutgoingView
  // Yönetici/sorumlu: Bekleyen + Onaylanmış yerine tek "Yapılmakta Olan Taleplerim".
  const myRequestViews = isManagerLike
    ? MY_REQUEST_VIEWS.filter(view => view.value !== 'pending' && view.value !== 'approved')
    : isReporter
      // Üst Düzey Yönetici: "Bekleyen Taleplerim"den sonra "Yapılmakta Olan Taleplerim".
      ? (['pending', 'external-pending', 'in-progress', 'overdue', 'completed', 'rejected', 'all'] as MyRequestsView[])
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
  const scope = useMemo<JobListScope>(() => {
    if (fixedScope) return fixedScope
    const raw = (searchParams.get('scope') as JobListScope | null) ?? 'department-pool'
    return EXTERNAL_SCOPES.some(s => s.value === raw) || raw === 'rejected' ? raw : 'department-pool'
  }, [fixedScope, searchParams])
  const includeDepartmentJobs = isMyRequestsView && isManagerLike

  // "pending-approval" görünümü "Birime Gelen Talepler" varsayılan sayfasının kopyasıydı;
  // bu eski bağlantılar artık Birime Gelen Talepler'e yönlendirilir.
  useEffect(() => {
    if (!fixedScope && searchParams.get('scope') === 'pending-approval') {
      navigate('/incoming-requests', { replace: true })
    }
  }, [fixedScope, searchParams, navigate])

  // auto-open detail drawer when ?jobId=... is in the URL (e.g. linked from social messages)
  const autoOpenJobId = searchParams.get('jobId')

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
    setLoading(true)
    loadJobsForView(scope, reporterDepartmentId, includeDepartmentJobs)
      .then(jobList => {
        if (cancelled) return
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
      const myJobs = filterMyRequests(jobs, currentMyRequestsView, isReporter, isManagerLike, activeDeptId)
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
  }, [activeDeptId, currentDepartmentOutgoingView, currentMyRequestsView, currentRequestFlowFilter, filterFrom, filterTo, isDepartmentOutgoingView, isManagerLike, isMyRequestsView, isReporter, jobs, scope, searchText, showRequestFlowFilters, t, locale])

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
      setPromptDialog(null)
      setError(null)
    })
  }, [activeDeptId, clearJobFilters])

  const pagedJobs = useMemo(
    () => {
      const newestFirst = [...columnFilteredJobs].sort(
        (a, b) => new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime(),
      )
      return sortJobs(newestFirst).slice((jobsPage - 1) * jobsPageSize, jobsPage * jobsPageSize)
    },
    [columnFilteredJobs, jobsPage, jobsPageSize, sortJobs],
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
    setCoordinatingDepartmentIds([])
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

  // Açılan talebin mevcut yönetici notunu forma yükle (card 453); aynı talep yenilenince yazılanı korur.
  useEffect(() => {
    setManagerNoteDraft(detail?.managerNote ?? '')
  }, [detail?.jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveManagerNote = async () => {
    if (!detail) return
    setManagerNoteSaving(true)
    setError(null)
    try {
      await api.setJobManagerNote(detail.jobId, managerNoteDraft.trim() || null)
      await refreshDetail()
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
    if (mode === 'external') {
      navigate(detailContext === 'social' ? '/social' : '/incoming-requests?kind=all', { replace: true })
    }
  }

  // Talep oluştururken opsiyonel olarak girilen adres alanlarını gösterir; veri yoksa boş durum (card 442).
  const renderJobAddressInfo = (job: JobDetail) => {
    const fields = [
      { label: t('address.neighborhoodLabel', 'Mahalle'), value: job.neighborhood },
      { label: t('address.streetLabel', 'Cadde / Sokak / Bulvar'), value: job.street },
      { label: t('address.openAddressLabel', 'Açık Adres'), value: job.openAddress },
    ].filter(field => field.value != null && field.value.trim() !== '')

    if (fields.length === 0) {
      return <p className="text-sm text-slate-400">{t('address.empty', 'Adres bilgisi girilmemiş.')}</p>
    }

    return (
      <dl className="space-y-2">
        {fields.map(field => (
          <div key={field.label}>
            <dt className="text-xs font-semibold text-slate-500">{field.label}</dt>
            <dd className="break-words text-sm text-slate-900">{field.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  const coordinatingDepartmentOptions = useMemo(() => {
    const existingIds = new Set(detail?.departments.map(department => department.departmentId) ?? [])
    return departments
      .filter(department => !existingIds.has(department.departmentId))
      .map(department => ({ value: department.departmentId, label: department.name }))
      .sort((a, b) => a.label.localeCompare(b.label, locale))
  }, [departments, detail?.departments, locale])

  const handleAddCoordinatingDepartments = async () => {
    if (!detail || coordinatingDepartmentIds.length === 0) return
    setCoordinatingSaving(true)
    setError(null)
    try {
      await api.addJobCoordinatingDepartments(detail.jobId, coordinatingDepartmentIds)
      setCoordinatingDepartmentIds([])
      await refreshDetail()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setCoordinatingSaving(false)
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
      setCancelModal(null)
      await refreshDetail()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setCancelModal(m => m ? { ...m, saving: false } : null)
    }
  }
  const handleApproveOwner = (jobId: string) => {
    setConfirmDialog({
      message: t('jobs.approveOwnerConfirm', 'Bu talebi onaylamak istediğinizden emin misiniz?'),
      variant: 'primary',
      confirmLabel: t('common.approve', 'Onayla'),
      onConfirm: async () => {
        setError(null)
        try {
          await api.approveJobOwner(jobId)
          await refreshDetail()
          await reload()
        } catch (err) {
          setError(err instanceof Error ? err.message : t('common.error'))
        }
      },
    })
  }
  const handleRejectOwner = (jobId: string) => {
    setPromptDialog({
      title: t('jobs.actions.rejectReason'),
      onConfirm: async (reason) => {
        try {
          await api.rejectJobOwner(jobId, reason)
          await refreshDetail()
          await reload()
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
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{isMyRequestsView ? currentMyRequestsViewLabel : isDepartmentOutgoingView ? currentDepartmentOutgoingViewLabel : scopeLabel}</div>
            <h1 className="page-title">{isMyRequestsView ? t('nav.myRequests', 'Taleplerim') : isDepartmentOutgoingView ? t('nav.outgoingRequests', 'Birimden Giden Talepler') : t('nav.jobs', 'Birime Gelen Talepler')}</h1>
            <p className="page-subtitle">
              {isMyRequestsView
                ? t('jobs.myRequestsSubtitle', 'Oluşturduğunuz talepleri durumlarına göre takip edin.')
                : isDepartmentOutgoingView
                  ? t('jobs.outgoingSubtitle', 'Biriminizden diğer birimlere gönderilen talepleri durumlarına göre takip edin.')
                  : t('jobs.subtitle', 'Birim dışı gelen talepleri izleyin, koordine müdürlükleri yönetin ve görevleri takip edin.')}
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
                className={`scope-chip ${getScopeChipColorClass(view.value)}${view.value === currentMyRequestsView ? ' active' : ''}`}
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
            <table className={`data-table jobs-table${isMyRequestsView || isDepartmentOutgoingView ? ' data-table--zebra' : ''}`}>
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  {(isMyRequestsView || isDepartmentOutgoingView) && <FilterableTh filterKey="jobNumber" filterValue={jobFilters['jobNumber'] ?? ''} onFilter={setJobFilter} sortKey="jobNumber" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.requestNo', 'Talep No')}</FilterableTh>}
                  {(isMyRequestsView || isDepartmentOutgoingView) && <FilterableTh filterKey="createdAtUtc" filterValue={jobFilters['createdAtUtc'] ?? ''} onFilter={setJobFilter} sortKey="createdAtUtc" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.requestDate', 'Talep Tarihi')}</FilterableTh>}
                  {isDepartmentOutgoingView && <th>{t('jobs.columns.createdBy', 'Oluşturan')}</th>}
                  <FilterableTh filterKey="title" filterValue={jobFilters['title'] ?? ''} onFilter={setJobFilter} sortKey="title" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.title')}</FilterableTh>
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
                  {isMyRequestsView && activeJobView === 'all' && <FilterableTh filterKey="status" filterValue={jobFilters['status'] ?? ''} onFilter={setJobFilter} sortKey="statusSortText" currentSortKey={jobsSortKey} sortDir={jobsSortDir} onSort={toggleJobsSort}>{t('jobs.columns.status', 'Durum')}</FilterableTh>}
                  <th>{t('jobs.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedJobs.length === 0 && (
                  <tr>
                    <td colSpan={99} className="empty-state text-center">
                      {isMyRequestsView
                        ? t('jobs.myViews.empty', { view: currentMyRequestsViewLabel, defaultValue: `${currentMyRequestsViewLabel} bulunmuyor` })
                        : isDepartmentOutgoingView
                          ? t('jobs.outgoingViews.empty', { view: currentDepartmentOutgoingViewLabel, defaultValue: `${currentDepartmentOutgoingViewLabel} bulunmuyor` })
                          : t('jobs.empty')}
                    </td>
                  </tr>
                )}
                {pagedJobs.map((job, index) => {
                  const isOutgoingTargetApproved = isDepartmentOutgoingView &&
                    job.departments.some(d => d.role === 'Target' && d.approvalStatus === 'Approved')
                  return (
                  <tr key={job.jobId}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(jobsPage - 1) * jobsPageSize + index + 1}</td>
                    {(isMyRequestsView || isDepartmentOutgoingView) && (
                      <td className="font-mono text-xs text-slate-500">
                        <div>{formatJobDisplayNumber(job)}</div>
                        <div className={`font-sans text-[0.7rem] font-bold ${getPriorityColorClass(job.priority)}`}>(Öncelik:{getPriorityLabel(t, job.priority)})</div>
                      </td>
                    )}
                    {(isMyRequestsView || isDepartmentOutgoingView) && <td><DateCell value={job.createdAtUtc ?? null} locale={locale} /></td>}
                    {isDepartmentOutgoingView && <td>{job.createdByDisplayName ?? '—'}</td>}
                    <td className="font-semibold">{job.title}</td>
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
                    {isMyRequestsView && activeJobView === 'all' && <td><StatusPill tone="neutral">{getJobDisplayStatus(t, job)}</StatusPill></td>}
                    <td className="actions-cell">
                      <div className="request-actions">
                        <Button size="sm" variant="secondary" onClick={() => openDetail(job.jobId)}>{t('jobs.actions.details')}</Button>
                        {/* Düzenle — onay öncesi (hedef onaylamadan) talebi Talep Oluştur sayfasında dolu olarak aç (card 452). */}
                        {isMyRequestsView && (isPreApprovalStatus(job.status) || (isManagerLike && job.status === 'Active' && job.taskCount === 0)) && (
                          <Button
                            size="sm"
                            className="bg-cyan-300 text-slate-900 hover:bg-cyan-400"
                            onClick={() => navigate(`/requests/new?kind=${job.requestType === 'ExternalUnit' ? 'external' : 'internal'}&editJobId=${job.jobId}`)}
                          >
                            {t('jobs.actions.edit', 'Düzenle')}
                          </Button>
                        )}
                        {!isMyRequestsView && !isDepartmentOutgoingView && isManagerLike && job.status === 'PendingOwnerApproval' && (
                          <Button size="sm" variant="success" onClick={() => handleApproveOwner(job.jobId)}>{t('jobs.actions.approveOwner')}</Button>
                        )}
                        {!isMyRequestsView && !isDepartmentOutgoingView && isManagerLike && job.status === 'Active' && (
                          <Button size="sm" variant="destructive" onClick={() => handleCancel(job.jobId)}>{t('jobs.actions.cancel')}</Button>
                        )}
                        {/* Birimden Giden → Bekleyen: Yönetici onayı. Onaylanınca hedef birimin havuzuna düşer. */}
                        {isDepartmentOutgoingView && currentDepartmentOutgoingView === 'pending' && isManagerLike && job.status === 'PendingOwnerApproval' && (
                          <Button size="sm" variant="success" onClick={() => handleApproveOwner(job.jobId)}>{t('jobs.actions.approveOwner', 'Onayla')}</Button>
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
                        {/* Talebi oluşturan kullanıcı talebini iade edemez; yalnızca iptal edebilir. */}
                        {isMyRequestsView && (job.status === 'PendingOwnerApproval' || job.status === 'PendingExternalApproval' || job.status === 'Active') && (
                          <Button size="sm" variant="destructive" onClick={() => handleCancel(job.jobId)}>{t('jobs.actions.cancel', 'İptal')}</Button>
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
          onClick={closeDetail}
          role="presentation"
        >
          <section
            className="detail-modal-shell flex max-h-[80dvh] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-slate-600">
                  {detailHeaderTitle}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canApproveDetail && (
                  <Button type="button" variant="success" onClick={() => handleApproveOwner(detail.jobId)}>
                    {t('jobs.actions.approveOwner', 'Onayla')}
                  </Button>
                )}
                {canCancelDetail && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (isManagerLike && detail.status === 'PendingOwnerApproval') {
                        handleRejectOwner(detail.jobId)
                        return
                      }
                      handleCancel(detail.jobId)
                    }}
                  >
                    {t('jobs.actions.cancelJob', 'Talebi İptal Et')}
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={() => printJobDetail(detail, locale)}>{t('common.print', 'Yazdır')}</Button>
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
              {/* Talep Detayları — Görevlerim popup' undaki Görev Detayları kutusuyla aynı tasarım (card 386) */}
              <section className="mb-5">
                <div className="mb-2 text-sm font-semibold text-emerald-600">
                  {t('jobs.detail.requestInfo', 'Talep Detayları')}
                </div>
                <div className="grid gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
                  <div className="min-w-0 divide-y divide-slate-100">
                    {[
                      {
                        label: 'Talep No',
                        value: detail.jobNumber != null && detail.jobNumberYear != null
                          ? `T-${detail.jobNumberYear}-${detail.jobNumber}`
                          : `T-${detail.jobNumberYear ?? new Date().getFullYear()}-Onay Bekleyen`,
                      },
                      { label: 'Talep Başlığı', value: detail.title },
                      {
                        label: 'Talep Yeri / Oluşturan',
                        value: [detail.ownerDepartmentName, detail.createdByDisplayName].filter(Boolean).join(' / ') || '—',
                      },
                      {
                        label: 'Gittiği Yer',
                        value: formatJobDestinationsWithAssignees(detail),
                      },
                      { label: 'Proje mi', value: detail.isProject ? t('common.yes', 'Evet') : t('common.no', 'Hayır') },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-start gap-2 px-3 py-2">
                        <span className="w-36 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                        <span className="min-w-0 break-words text-sm text-slate-900">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                    <div className="divide-y divide-slate-100">
                      {[
                        { label: 'Öncelik', value: getPriorityLabel(t, detail.priority) },
                        {
                          label: 'Durum',
                          value: detail.status === 'Active'
                            ? 'Yapılmakta Olan'
                            : detail.status === 'Completed'
                              ? 'Tamamlanmış'
                              : getJobStatusLabel(t, detail.status),
                        },
                        { label: 'Talep Tarihi', value: formatDateTime(detail.createdAtUtc, locale) },
                        ...(isMyRequestsView ? [{
                          label: 'Talebi Yapan Departman Onay Tarihi',
                          value: formatDateTime(
                            detail.departments.find(department => department.role === 'Owner')?.decidedAtUtc ?? null,
                            locale,
                          ),
                        }] : []),
                        { label: 'Son Tarih', value: formatDateTime(detail.dueDateUtc, locale) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col gap-0.5 px-4 py-2">
                          <span className="text-xs font-semibold text-slate-500">{label}</span>
                          <span className="text-sm text-slate-900">{value}</span>
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
                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    {/* 1. sütun: Koordine Departman Ekle (card 436) */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h3 className="mb-3 text-sm font-bold text-slate-900">Koordine Departman Ekle</h3>
                      <MultiSelectDropdown
                        options={coordinatingDepartmentOptions}
                        value={coordinatingDepartmentIds}
                        onChange={setCoordinatingDepartmentIds}
                        placeholder="Koordine Departman seçin"
                        emptyText="Seçilebilir birim bulunmuyor."
                        triggerClassName="text-xs"
                        disabled={coordinatingSaving}
                      />
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="success"
                          size="sm"
                          disabled={coordinatingSaving || coordinatingDepartmentIds.length === 0}
                          onClick={() => void handleAddCoordinatingDepartments()}
                        >
                          {coordinatingSaving ? 'Ekleniyor...' : 'Koordine Departman Ekle'}
                        </Button>
                      </div>
                    </div>
                    {/* 2. sütun: Adres Bilgileri — talep oluştururken girilen opsiyonel adres alanları (card 442) */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h3 className="mb-3 text-sm font-bold text-slate-900">
                        {t('address.detailSectionTitle', 'Adres Bilgileri')}
                      </h3>
                      {renderJobAddressInfo(detail)}
                    </div>
                    {/* 3. sütun: Ekler / Fotoğraflar */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <h3 className="mb-3 text-sm font-bold text-slate-900">
                        {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
                      </h3>
                      <AttachmentSection
                        attachments={detail.attachments ?? []}
                        onUpload={async (file) => {
                          setAttachmentUploading(true)
                          try {
                            await api.uploadJobAttachment(detail.jobId, file)
                            await refreshDetail()
                          } finally {
                            setAttachmentUploading(false)
                          }
                        }}
                        onDelete={async (id) => {
                          await api.deleteAttachment(id)
                          await refreshDetail()
                        }}
                        disabled={attachmentUploading}
                      />
                    </div>
                  </div>
                )}
                {/* Yönetici Notu — Birimden Giden (Bekleyen) detayında düzenlenebilir; Birime Gelen detayında salt-okunur (card 453) */}
                {(canEditManagerNote || (detailContext === 'incoming' && detail.managerNote)) && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 lg:max-w-md">
                    <h3 className="mb-3 text-sm font-bold text-slate-900">{t('jobs.managerNote.title', 'Yönetici Notu')}</h3>
                    {canEditManagerNote ? (
                      <>
                        <textarea
                          className="field-textarea min-h-24 w-full"
                          rows={3}
                          value={managerNoteDraft}
                          onChange={e => setManagerNoteDraft(e.target.value)}
                          placeholder={t('jobs.managerNote.placeholder', 'Yönetici notu girin...')}
                        />
                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            variant="success"
                            size="sm"
                            disabled={managerNoteSaving}
                            onClick={() => void handleSaveManagerNote()}
                          >
                            {managerNoteSaving ? t('common.saving', 'Kaydediliyor...') : t('common.add', 'Ekle')}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-slate-800">{detail.managerNote}</p>
                    )}
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
                        <td>{tk.title}</td>
                        <td>{tk.assignedUserDisplayName ?? tk.assignedDepartmentName ?? '—'}</td>
                        <td>{tk.ownerDisplayName ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>}

            {/* Yöneticisi/koordinasyon yetkisi olmayan kullanıcılar (ör. Taleplerim) için ayrı Adres Bilgileri (card 442). */}
            {isRequestDetailContext && !canManageCoordination && <section className="mb-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                {t('address.detailSectionTitle', 'Adres Bilgileri')}
              </h3>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                {renderJobAddressInfo(detail)}
              </div>
            </section>}

            {(!isRequestDetailContext || !canManageCoordination) && <section className="mb-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
              </h3>
              <AttachmentSection
                attachments={detail.attachments ?? []}
                onUpload={async (file) => {
                  setAttachmentUploading(true)
                  try {
                    await api.uploadJobAttachment(detail.jobId, file)
                    await refreshDetail()
                  } finally {
                    setAttachmentUploading(false)
                  }
                }}
                onDelete={async (id) => {
                  await api.deleteAttachment(id)
                  await refreshDetail()
                }}
                disabled={attachmentUploading}
              />
            </section>}

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
           </div>
          </section>
        </div>,
        document.body
      )}

      {editModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditModal(null)}
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
        </div>
      )}
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
      <PromptDialog state={promptDialog} onClose={() => setPromptDialog(null)} />
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCancelModal(null)}>
          <div className="form-card page-stack relative w-full max-w-md" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setCancelModal(null)} aria-label={t('common.close', 'Kapat')} className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
              <XIcon className="size-4" />
            </button>
            <h2 className="text-xl font-extrabold text-slate-950">{t('jobs.actions.cancelJob', 'Talebi İptal Et')}</h2>
            <p className="helper-copy">{t('jobs.actions.cancelJobHelp', 'Talebi iptal etmek için neden belirtiniz.')}</p>
            <label className="job-field">
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
            <div className="inline-actions">
              <Button type="button" variant="secondary" onClick={() => setCancelModal(null)}>
                {t('common.dismiss', 'Vazgeç')}
              </Button>
              <Button type="button" variant="destructive" disabled={cancelModal.saving || !cancelModal.reason.trim()} onClick={() => void handleCancelConfirm()}>
                {cancelModal.saving ? t('common.loading') : t('jobs.actions.cancel', 'İptal Et')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
