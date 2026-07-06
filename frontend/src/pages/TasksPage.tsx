import { FileImage, FileText, Paperclip, Search, PenLine, X } from 'lucide-react'
import { DueDatePill } from '../components/ui/due-date-pill'
import { GridExtraTimeMarkers } from '../components/ui/extra-time-markers'
import { DateCell } from '../components/ui/date-cell'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '../hooks/useSortable'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { FilterableTh } from '../components/ui/FilterableTh'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateTasks, invalidateNotifications } from '../api/cacheInvalidation'
import { getActiveDepartmentId } from '../api/http'
import { AttachmentSection } from '../components/ui/AttachmentSection'
import { AddressDetailFields } from '../components/ui/AddressDetailFields'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { DisabledActionButton } from '../components/ui/DisabledActionButton'
import { RichTextContent } from '../components/ui/RichTextContent'
import { Toast } from '../components/ui/toast'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import type { AssignmentHistory, Department, JobDetail, SocialMessage, Task, TaskDetail, TaskListScope, User } from '../types/platform'
import { getLocale, getPriorityColorClass, getPriorityLabel, getStatusPillClass, getTaskStatusLabel, getTaskStatusTone, getTaskDisplayStatus, getSocialChannelLabel } from '../utils/localization'
import { TablePagination } from '../components/ui/table-pagination'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { printHtmlDocument } from '../utils/printDocument'
import { richTextToPlainText } from '../utils/richText'

const COMPLETION_ATTACHMENT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']
const COMPLETION_ATTACHMENT_ACCEPT = COMPLETION_ATTACHMENT_EXTENSIONS.join(',')
const COMPLETION_ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024

function completionAttachmentExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function completionAttachmentIcon(name: string) {
  return ['.jpg', '.jpeg', '.png'].includes(completionAttachmentExtension(name)) ? FileImage : FileText
}

function getVisibleAssignmentHistory(history: AssignmentHistory[]): AssignmentHistory[] {
  const chronological = [...history].sort((a, b) => new Date(a.actionDateUtc).getTime() - new Date(b.actionDateUtc).getTime())
  const firstAssignedUserId = chronological.find(item => item.toUserId)?.toUserId
  if (!firstAssignedUserId) return []

  const hasReassignmentToAnotherUser = chronological.some(item => item.toUserId && item.toUserId !== firstAssignedUserId)
  return hasReassignmentToAnotherUser
    ? chronological.filter(item => item.toUserId).reverse()
    : []
}
import { isCitizenRequestJob, canShowCitizenWhatsAppConversation, formatCitizenRequestNumber, formatCitizenPhoneDisplay, getCitizenRequestStatusLabel, shouldShowCitizenTargetApprovalDate } from '../utils/citizenRequests'
import { hasCitizenRequestManagerRole } from '../utils/roleAccess'
import { ReporterDepartmentCell } from '../components/ui/ReporterDepartmentCell'
import { isReporterCreated, reporterGridValueClass, hasConcreteNumberDisplay } from '../utils/reporterHighlight'
import { matchesBannerSearch } from '../utils/bannerSearch'
import { formatJobDestinationsWithAssignees, formatRequestApproverDisplay, shouldShowRequestApproverField } from '../utils/jobDetails'
import { JobProjectValue } from '../utils/jobProjectDisplay'
import { ModalBackdrop } from '../components/ui/modal-backdrop'
import { parseRoutineTaskEditHistory, getRoutineEditFieldChanges, snapshotAttachmentsToAttachmentList, buildRoutineSnapshotFromTaskDetail, type RoutineTaskEditHistoryEntry } from '../utils/routineTaskEditHistory'
import { isDepartmentStaffUser, userWorksInAnyDepartment } from '../utils/userDepartments'
import { ChannelIcon } from '../components/ui/channel-icon'
import { WhatsAppConversationModal } from '../components/WhatsAppConversationModal'
import { RequestNumberWithTypeLabel } from '../utils/requestDisplay'

interface TaskScopeFiltersProps {
  searchText: string
  filterFrom: string
  filterTo: string
  onSearch: (v: string) => void
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}
function TaskScopeFilters({ searchText, filterFrom, filterTo, onSearch, onFromChange, onToChange }: TaskScopeFiltersProps) {
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
            <X className="size-3.5" strokeWidth={3} />
          </button>
        )}
      </div>
      {/* Talep Oluştur'daki ile aynı takvim tasarımı (DateTimePicker), tarih aralığı için iki seçici. */}
      <DateTimePicker value={filterFrom} onChange={onFromChange} placeholder="Başlangıç tarihi" className="scope-chip-date" forceDown />
      <DateTimePicker value={filterTo} onChange={onToChange} placeholder="Bitiş tarihi" className="scope-chip-date" forceDown />
    </div>
  )
}

const SCOPES: { value: TaskListScope; labelKey: string }[] = [
  { value: 'pending-approval', labelKey: 'tasks.scopes.pendingApproval' },
  { value: 'department-pool', labelKey: 'tasks.scopes.departmentPool' },
  { value: 'all', labelKey: 'tasks.scopes.all' },
]

type MyTaskView = 'pending' | 'completed' | 'rejected' | 'overdue' | 'all'
type RequestFlowFilter = 'internal' | 'external' | 'all'
type TasksPageMode = 'default' | 'departmentTasks' | 'staffTasks'

// Tamamlanmış/İptal görevin çekilebileceği durumlar (mevcut durum filtrelenir) (card #1005).
const STATUS_CHANGE_OPTIONS: { value: string; labelKey: string; fallback: string }[] = [
  { value: 'InProgress', labelKey: 'tasks.statusChange.inProgress', fallback: 'Yapılmakta' },
  { value: 'Completed', labelKey: 'tasks.statusChange.completed', fallback: 'Tamamlanmış' },
  { value: 'Cancelled', labelKey: 'tasks.statusChange.cancelled', fallback: 'İptal' },
]

const MY_TASK_VIEWS: { value: MyTaskView; labelKey: string }[] = [
  { value: 'pending', labelKey: 'tasks.myViews.pending' },
  { value: 'overdue', labelKey: 'tasks.myViews.overdue' },
  { value: 'completed', labelKey: 'tasks.myViews.completed' },
  { value: 'rejected', labelKey: 'tasks.myViews.rejected' },
  { value: 'all', labelKey: 'tasks.myViews.all' },
]

const REQUEST_FLOW_FILTERS: { value: RequestFlowFilter; labelKey: string }[] = [
  { value: 'internal', labelKey: 'filters.requestFlow.internal' },
  { value: 'external', labelKey: 'filters.requestFlow.external' },
  { value: 'all', labelKey: 'filters.requestFlow.all' },
]

const DEPARTMENT_TASK_FLOWS: { value: RequestFlowFilter; labelKey: string }[] = [
  { value: 'internal', labelKey: 'nav.departmentTasksInternal' },
  { value: 'external', labelKey: 'nav.departmentTasksExternal' },
  { value: 'all', labelKey: 'nav.departmentTasksAll' },
]

const DEPARTMENT_STATUS_VIEWS: { value: MyTaskView; labelKey: string }[] = [
  { value: 'pending', labelKey: 'tasks.departmentViews.pending' },
  { value: 'overdue', labelKey: 'tasks.departmentViews.overdue' },
  { value: 'completed', labelKey: 'tasks.departmentViews.completed' },
  { value: 'rejected', labelKey: 'tasks.departmentViews.rejected' },
  { value: 'all', labelKey: 'tasks.departmentViews.all' },
]

const TASK_TYPE_FILTERS: { value: 'all' | 'assigned' | 'routine'; labelKey: string }[] = [
  { value: 'assigned', labelKey: 'dashboard.taskFilter.assigned' },
  { value: 'routine', labelKey: 'dashboard.taskFilter.routine' },
  { value: 'all', labelKey: 'dashboard.taskFilter.all' },
]

function availableScopes(role?: string): TaskListScope[] {
  if (role === 'SystemAdmin' || role === 'Manager') return ['pending-approval', 'department-pool', 'all']
  return ['department-pool', 'all']
}

interface TasksPageProps {
  fixedScope?: TaskListScope
  mode?: TasksPageMode
  notificationTaskId?: string | null
  detailOnly?: boolean
  onNotificationDetailClose?: () => void
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return locale.startsWith('tr') ? 'Belirsiz' : 'Unspecified'
  return new Date(value).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDueDateTime(value: string | null | undefined, locale: string) {
  if (!value) return locale.startsWith('tr') ? 'Onay Bekleyen' : 'Pending Approval'
  return formatDateTime(value, locale)
}

function formatApprovalDateText(value: string, approverName: string | null | undefined) {
  return approverName ? `${value} (${approverName})` : value
}

function stripHtmlTags(value: string | null | undefined) {
  if (!value) return ''
  const parser = new DOMParser()
  const parsed = parser.parseFromString(value, 'text/html')
  return (parsed.body.innerText || parsed.body.textContent || '').replace(/\u00a0/g, ' ').trim()
}

function resolveTaskDescription(taskDetail: TaskDetail, parentJob: JobDetail | null): string {
  if (taskDetail.description?.trim()) return taskDetail.description
  return parentJob?.description ?? ''
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function printTaskDetail(
  taskDetail: TaskDetail,
  taskSummary: Task | null,
  parentJob: import('../types/platform').JobDetail | null,
  citizenSourceMessage: SocialMessage | null,
  t: import('i18next').TFunction,
  locale: string,
) {
  const fd = (d: string | null | undefined) => d ? new Date(d).toLocaleString(locale, { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
  const description = stripHtmlTags(resolveTaskDescription(taskDetail, parentJob))
  const gorevTipi = taskDetail.jobSourceType === 'Routine' ? t('tasks.type.routine', 'Rutin') : t('tasks.type.assigned', 'Atanmış')
  const taskDisplayNumber = taskSummary
    ? formatTaskDisplayNumber(taskSummary)
    : `G-${new Date().getFullYear()}-Onay Bekleyen`
  const taskDetailRows = [
    ['Görev No', taskDisplayNumber],
    ['Görev Başlığı', taskDetail.title],
    ...(taskDetail.jobSourceType !== 'Routine'
      ? [['Talep Yeri / Oluşturan', [taskSummary?.ownerDepartmentName, taskDetail.createdByDisplayName].filter(Boolean).join(' / ') || '—']]
      : []),
    ['Görevi Yapan', taskDetail.assignedUserDisplayName ?? taskDetail.ownerDisplayName ?? '—'],
    ['Görev Tipi', gorevTipi],
    ['Öncelik', getPriorityLabel(t, taskDetail.priority)],
    ...(taskDetail.currentStatus === 'Completed' && taskDetail.notes
      ? [['Görev Tamamlama Notu', richTextToPlainText(taskDetail.notes)]]
      : []),
    ['Durum', getTaskDisplayStatus(t, taskDetail)],
    ['Görev Tarihi', fd(taskDetail.createdAtUtc)],
    ['Son Tarih', fd(taskDetail.dueDateUtc)],
  ].map(([label, value]) => `<tr><th>${escHtml(label)}</th><td>${escHtml(value)}</td></tr>`).join('')
  const ownerApproval = parentJob?.departments.find(department => department.role === 'Owner')
  const targetApproval = parentJob?.departments.find(department => department.role === 'Target')
  const isCitizenParentJob = parentJob != null && isCitizenRequestJob(parentJob)
  const parentJobRows = parentJob ? (isCitizenParentJob ? [
    ['Vatandaş Talep No', formatCitizenRequestNumber(citizenSourceMessage ?? { createdAtUtc: parentJob.createdAtUtc }, locale)],
    ['Vatandaş Adı / Telefon No', [parentJob.citizenName ?? citizenSourceMessage?.citizenHandle, formatCitizenPhoneDisplay(parentJob.citizenPhone ?? citizenSourceMessage?.citizenPhone)].filter(Boolean).join(' / ') || '—'],
    ['Talep Başlığı', parentJob.title],
    ['Talep Yeri / Oluşturan', [parentJob.ownerDepartmentName, parentJob.createdByDisplayName].filter(Boolean).join(' / ') || '—'],
    ...(shouldShowRequestApproverField(parentJob)
      ? [['Talebi Onaylayan', formatRequestApproverDisplay(parentJob) ?? '—'] as [string, string]]
      : []),
    ['Talebin Gittiği Birim', formatJobDestinationsWithAssignees(parentJob)],
    ['Öncelik', getPriorityLabel(t, parentJob.priority)],
    ['Durum', getCitizenRequestStatusLabel(t, parentJob)],
    ['Talep Tarihi', fd(parentJob.createdAtUtc)],
    ...(shouldShowCitizenTargetApprovalDate(parentJob)
      ? [['Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi', formatApprovalDateText(fd(targetApproval?.decidedAtUtc), targetApproval?.approvedByDisplayName)]]
      : []),
    ['Son Tarih', fd(parentJob.dueDateUtc)],
  ] : [
    ['Talep No', parentJob.jobNumber != null && parentJob.jobNumberYear != null ? `T-${parentJob.jobNumberYear}-${parentJob.jobNumber}` : '—'],
    ['Talep Başlığı', parentJob.title],
    ['Talep Yeri / Oluşturan', [parentJob.ownerDepartmentName, parentJob.createdByDisplayName].filter(Boolean).join(' / ') || '—'],
    ...(shouldShowRequestApproverField(parentJob)
      ? [['Talebi Onaylayan', formatRequestApproverDisplay(parentJob) ?? '—'] as [string, string]]
      : []),
    ['Proje mi', parentJob.isProject ? 'Evet' : 'Hayır'],
    ['Öncelik', getPriorityLabel(t, parentJob.priority)],
    ['Talep Tarihi', fd(parentJob.createdAtUtc)],
    ['Talebin Birim Yöneticisinin Onay Tarihi', formatApprovalDateText(fd(ownerApproval?.decidedAtUtc), ownerApproval?.approvedByDisplayName)],
    ...(shouldShowCitizenTargetApprovalDate(parentJob)
      ? [['Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi', formatApprovalDateText(fd(targetApproval?.decidedAtUtc), targetApproval?.approvedByDisplayName)]]
      : []),
    ['Son Tarih', fd(parentJob.dueDateUtc)],
  ]).map(([label, value]) => `<tr><th>${escHtml(label)}</th><td>${escHtml(String(value))}</td></tr>`).join('') : ''
  printHtmlDocument(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${escHtml(taskDisplayNumber)}</title><style>
    @page{margin:0}
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:2rem;margin:0}
    .section{margin-top:1.5rem}
    .section-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #9ca3af;padding-bottom:3px;margin-bottom:8px;color:#333}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #9ca3af;padding:4px 8px;text-align:left}
    th{width:34%;background:#f0f0f0;font-weight:bold}
    .desc{border:1px solid #9ca3af;padding:8px;border-radius:3px;background:#fafafa;font-size:11px;line-height:1.6}
    .footer{margin-top:2rem;font-size:10px;color:#aaa}
    .page-number{display:none}
    @media print{body{padding:1.5cm}.page-number{display:block;position:fixed;bottom:0.6cm;right:1.5cm;font-size:10px;color:#444}}
  </style></head><body>
  <div class="section">
    <div class="section-title">Görev Detayları</div>
    <table><tbody>${taskDetailRows}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Açıklama</div>
    <div class="desc">${description ? escHtml(description).replace(/\n/g, '<br/>') : '<em>Açıklama yok</em>'}</div>
  </div>
  ${parentJob && taskDetail.jobSourceType !== 'Routine' ? `<div class="section">
    <div class="section-title">${isCitizenParentJob ? 'Vatandaş Talep Detayları' : 'İlgili Talep Detayları'}</div>
    <table><tbody>${parentJobRows}</tbody></table>
  </div>` : ''}
  <div class="footer">Yazdırma tarihi: ${new Date().toLocaleString(locale)}</div>
  <div class="page-number">1 / 1</div>
  </body></html>`)
}


function formatTaskDisplayNumber(task: Task): string {
  if (task.taskNumber != null && task.taskNumberYear != null) {
    return `G-${task.taskNumberYear}-${task.taskNumber}`
  }
  const year = task.taskNumberYear ?? new Date().getFullYear()
  return `G-${year}-Onay Bekleyen`
}

// Atanan kişinin "Tamamla"/"İptal Et" alabileceği görev durumları. RevisionRequested
// (ek süre talebi yöneticide beklerken) de dahildir: görev hâlâ atanan kişinindir ve
// backend bu durumda da tamamlama/iptale izin verir; aksi halde "Bekleyen Görevlerim"de
// aksiyon butonları kaybolur (card 614).
function isActionableTaskStatus(status: string): boolean {
  return status === 'Assigned' || status === 'InProgress' || status === 'RevisionRequested'
}

function getRoutineTaskEditPath(taskId: string): string {
  return `/routine-tasks/${taskId}/edit`
}

// Görevin atanma günü = bugün mü? (Görevlerim "Yeni" rozeti, card 589)
function isAssignedToday(value: string | null | undefined): boolean {
  if (!value) return false
  const assigned = new Date(value)
  if (Number.isNaN(assigned.getTime())) return false
  const now = new Date()
  return assigned.getFullYear() === now.getFullYear()
    && assigned.getMonth() === now.getMonth()
    && assigned.getDate() === now.getDate()
}

function toDateTimePickerValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function getExtraTimeProposedDueDate(comment: string | null | undefined): string | null {
  if (!comment) return null
  const match = comment.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
  return match?.[0] ?? null
}

function isTerminalTaskForExtraTimeDisplay(status: string): boolean {
  return status === 'Completed' || status === 'Cancelled' || status === 'Rejected'
}

function TaskGridExtraTimeMarkers({
  task,
}: {
  task: Pick<Task, 'hasPendingExtraTimeRequest' | 'lastExtraTimeRequestDecision'>
}) {
  return (
    <GridExtraTimeMarkers
      hasPending={task.hasPendingExtraTimeRequest}
      lastDecision={task.lastExtraTimeRequestDecision}
    />
  )
}

function formatTaskJobDisplayNumber(
  task: Task,
  socialByJobId?: Map<string, SocialMessage>,
  locale = 'tr',
): string {
  if (task.jobSourceType === 'Routine') return '—'
  if (isCitizenRequestJob({ requestType: task.jobRequestType, sourceType: task.jobSourceType })) {
    const social = socialByJobId?.get(task.jobId)
    return formatCitizenRequestNumber(
      social ?? { createdAtUtc: task.jobCreatedAtUtc ?? task.createdAtUtc ?? undefined },
      locale,
    )
  }
  if (task.jobNumber != null && task.jobNumberYear != null) {
    return `T-${task.jobNumberYear}-${task.jobNumber}`
  }
  const year = task.jobNumberYear ?? new Date().getFullYear()
  return `T-${year}-Onay Bekleyen`
}

const TASK_SEARCH_COLUMN_KEYS = [
  'jobNumber',
  'taskNumber',
  'createdAtUtc',
  'ownerDepartmentName',
  'title',
  'taskOwnerDisplayName',
  'jobSourceType',
  'dueDateUtc',
  'completedAtUtc',
  'updatedAtUtc',
  'currentStatus',
  'cancelReturnStatus',
  'priority',
] as const

function getCitizenTaskChannel(task: Task, socialByJobId: Map<string, SocialMessage>): string {
  return socialByJobId.get(task.jobId)?.channel ?? 'WhatsApp'
}

function getMyTaskView(value: string | null): MyTaskView {
  if (value === 'returned') return 'rejected'
  return value === 'completed' || value === 'rejected' || value === 'overdue' || value === 'all' ? value : 'pending'
}

function getRequestFlowFilter(value: string | null): RequestFlowFilter {
  return value === 'internal' || value === 'external' ? value : 'all'
}

function getScopeChipColorClass(value: string): string {
  if (value === 'pending') return 'scope-chip--pending'
  if (value === 'approved') return 'scope-chip--approved'
  if (value === 'in-progress') return 'scope-chip--in-progress'
  if (value === 'completed') return 'scope-chip--completed'
  if (value === 'rejected') return 'scope-chip--rejected'
  // Son Tarihi Geçmiş: Yapılmakta Olan ile aynı turuncu renk.
  if (value === 'overdue') return 'scope-chip--in-progress'
  if (value === 'all') return 'scope-chip--all'
  return ''
}

function matchesRequestFlow(requestType: Task['jobRequestType'], filter: RequestFlowFilter): boolean {
  if (filter === 'internal') return requestType === 'InternalUnit'
  if (filter === 'external') return requestType === 'ExternalUnit' || requestType === 'Citizen'
  return true
}

function filterMyTasks(tasks: Task[], view: MyTaskView): Task[] {
  if (view === 'all') return tasks

  if (view === 'completed') {
    return tasks.filter(task => task.currentStatus === 'Completed')
  }

  if (view === 'rejected') {
    return tasks.filter(task => task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected')
  }

  const isClosedStatus = (status: string) =>
    ['Completed', 'Cancelled', 'Rejected', 'PendingCloseApproval'].includes(status)
  const isOverdue = (task: Task) => {
    if (!task.dueDateUtc) return false
    return task.dueDateUtc < new Date().toISOString()
  }

  if (view === 'overdue') {
    return tasks.filter(task => !isClosedStatus(task.currentStatus) && isOverdue(task))
  }

  // "Bekleyen" görünümü: aktif görevler — son tarihi geçmiş görevler hariç (onlar
  // "Son Tarihi Geçmiş" görünümünde gösterilir, card 393/394).
  return tasks.filter(task => !isClosedStatus(task.currentStatus) && !isOverdue(task))
}

export function TasksPage({ fixedScope, mode = 'default', notificationTaskId, detailOnly = false, onNotificationDetailClose }: TasksPageProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const locale = getLocale(i18n.language)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [activeDeptId, setActiveDeptId] = useState(() => getActiveDepartmentId())
  const [tasks, setTasks] = useState<Task[]>([])
  const [socialMessages, setSocialMessages] = useState<SocialMessage[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasksPage, setTasksPage] = useState(1)
  const [tasksPageSize, setTasksPageSize] = useState(10)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null)
  const [parentJobDetail, setParentJobDetail] = useState<JobDetail | null>(null)
  const [routineEditHistory, setRoutineEditHistory] = useState<RoutineTaskEditHistoryEntry[]>([])
  const [routineEditHistoryModalOpen, setRoutineEditHistoryModalOpen] = useState(false)
  const [citizenSourceMessage, setCitizenSourceMessage] = useState<SocialMessage | null>(null)
  const [conversationModal, setConversationModal] = useState<{
    socialMessageId: string
    citizenHandle: string
    citizenPhone: string | null
  } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Tamamlama işlemi henüz yapılmadan eklenen dosyalar, detay kapatılırsa
  // geçici işlemden arta kalmamalıdır (card #739).
  const [pendingCompletionAttachments, setPendingCompletionAttachments] = useState<Array<{ attachmentId: string; fileName: string }>>([])
  const [completionAttachmentError, setCompletionAttachmentError] = useState<string | null>(null)
  const [completionAttachmentUploading, setCompletionAttachmentUploading] = useState(false)
  const completeFileInputRef = useRef<HTMLInputElement>(null)
  const [returnModal, setReturnModal] = useState<{ taskId: string; step: 'cancel' | 'return'; assignedDepartmentId: string | null; isReporterTask: boolean; useManagerReporterRedirectLabel: boolean; directRoute: boolean } | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [returnDeptId, setReturnDeptId] = useState('')
  const [returnUserId, setReturnUserId] = useState('')
  const [returnSaving, setReturnSaving] = useState(false)
  const [completeModal, setCompleteModal] = useState<{ taskId: string; displayNumber: string } | null>(null)
  const [completeSaving, setCompleteSaving] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [completionNote, setCompletionNote] = useState('')
  // Tamamlanmış/İptal görevin durumunu değiştirme pop-up'ı (card #1005).
  const [statusChangeModal, setStatusChangeModal] = useState<{ taskId: string; currentStatus: string; displayNumber: string } | null>(null)
  const [statusChangeReason, setStatusChangeReason] = useState('')
  const [statusChangeTarget, setStatusChangeTarget] = useState('')
  const [statusChangeSaving, setStatusChangeSaving] = useState(false)
  const [dueDateEdit, setDueDateEdit] = useState<{ taskId: string; value: string; saving: boolean; mode: 'picking' | 'confirm' } | null>(null)
  const [extraTimeEdit, setExtraTimeEdit] = useState<{ taskId: string; value: string; saving: boolean; mode: 'picking' | 'confirm' } | null>(null)
  const [extraTimeReview, setExtraTimeReview] = useState<{ taskId: string; proposedDueDateUtc: string | null; saving: boolean } | null>(null)
  // Bilgilendirme balonu: çoğu işlem yeşil (success); ek süre reddi gibi olumsuz sonuçlar kırmızı (error, card 627).
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type })
  const [filterFrom, setFilterFrom] = useState(() => searchParams.get('from') ?? '')
  const [filterTo, setFilterTo] = useState(() => searchParams.get('to') ?? '')
  const [searchText, setSearchText] = useState('')
  const dismissedAutoOpenTaskIdRef = useRef<string | null>(null)
  const autoOpenInFlightRef = useRef<string | null>(null)
  const canCompleteTask = !!taskDetail && isActionableTaskStatus(taskDetail.currentStatus) && taskDetail.assignedUserId === user?.userId

  const scopes = useMemo(() => fixedScope ? [fixedScope] : availableScopes(user?.role), [fixedScope, user?.role])
  const scopeParam = (searchParams.get('scope') as TaskListScope | null) ?? scopes[0]
  const currentScope: TaskListScope = scopes.includes(scopeParam) ? scopeParam : scopes[0]
  const isMyTasksView = fixedScope === 'mine'
  const isDepartmentTasksView = mode === 'departmentTasks'
  const isStaffTasksView = mode === 'staffTasks'
  const currentMyTaskView = getMyTaskView(searchParams.get('view'))
  const currentRequestFlowFilter = getRequestFlowFilter(searchParams.get('flow'))
  const autoOpenTaskId = notificationTaskId ?? searchParams.get('taskId')
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  // Vatandaş Talep Yöneticisi "Birimdeki Görevler"de yalnızca vatandaş taleplerinin görevlerini görür (card #1073).
  const isCitizenRequestManager = hasCitizenRequestManagerRole(user)
  const showDepartmentTaskFlowFilters = isDepartmentTasksView && isManagerLike
  const showRequestFlowFilters = isMyTasksView && user?.role !== 'SystemAdmin'
  const activeUsers = useMemo(() => users.filter(item => item.isActive), [users])
  const currentUserRecord = useMemo(() => activeUsers.find(item => item.userId === user?.userId) ?? null, [activeUsers, user?.userId])
  const managedDepartmentIds = useMemo(() => {
    // Yönetici seçili aktif birim bağlamında çalışır. Eski/eksik ManagerUserId
    // kayıtları, ek birimde çalışan personelin "Personelimin Görevleri"
    // filtrelerinden kaybolmasına neden olmamalıdır.
    if (isManagerLike && activeDeptId) return new Set([activeDeptId])

    // Vatandaş Talep Yöneticisi müdür değildir; "Birimdeki Görevler" kapsamı yönettiği
    // birimler değil, çalışabildiği birimlerdir (birincil + ek birim, aktif birimle daraltılabilir).
    if (!isManagerLike && isCitizenRequestManager) {
      const ids = new Set<string>()
      if (user?.departmentId) ids.add(user.departmentId)
      currentUserRecord?.departments?.forEach(department => ids.add(department.departmentId))
      if (activeDeptId && ids.has(activeDeptId)) return new Set([activeDeptId])
      return ids
    }

    const ids = departments
      .filter(department => department.managerUserId === user?.userId)
      .map(department => department.departmentId)

    return new Set(ids)
  }, [activeDeptId, currentUserRecord, departments, isCitizenRequestManager, isManagerLike, user?.departmentId, user?.userId])
  const canManageDepartmentTaskActions = (task: Pick<Task | TaskDetail, 'jobRequestType' | 'jobSourceType'> | null | undefined) =>
    isManagerLike || (isDepartmentTasksView && isCitizenRequestManager && !!task && isCitizenRequestJob({ requestType: task.jobRequestType, sourceType: task.jobSourceType }))
  const staffUsers = useMemo(() => {
    return activeUsers.filter(item =>
      isDepartmentStaffUser(item, managedDepartmentIds) &&
      item.userId !== user?.userId)
  }, [activeUsers, managedDepartmentIds, user?.userId])
  const staffUserParam = searchParams.get('userId') ?? 'all'
  const currentStaffUserId = staffUserParam === 'all' ? 'all' : staffUserParam
  const staffFilterUsers = useMemo(() => {
    if (currentStaffUserId === 'all' || staffUsers.some(item => item.userId === currentStaffUserId)) {
      return staffUsers
    }
    const selected = activeUsers.find(item => item.userId === currentStaffUserId)
    return selected ? [selected, ...staffUsers] : staffUsers
  }, [activeUsers, currentStaffUserId, staffUsers])
  const staffUserIds = useMemo(() => new Set(staffUsers.map(item => item.userId)), [staffUsers])
  const socialByJobId = useMemo(() => {
    const map = new Map<string, SocialMessage>()
    for (const message of socialMessages) {
      if (message.jobId) map.set(message.jobId, message)
    }
    return map
  }, [socialMessages])
  const returnDeptUsers = useMemo(() => {
    if (!returnDeptId) return []
    // Görevi Yönlendir: hedef listede mevcut görev sahibi personel gösterilmez.
    const currentAssigneeId = returnModal?.directRoute
      ? tasks.find(item => item.taskId === returnModal.taskId)?.assignedUserId ?? null
      : null
    return activeUsers
      .filter(item => userWorksInAnyDepartment(item, new Set([returnDeptId])))
      .filter(item => item.userId !== currentAssigneeId)
  }, [activeUsers, returnDeptId, returnModal, tasks])
  const currentStaffUserLabel = currentStaffUserId === 'all'
    ? t('tasks.staff.allStaff', 'Tüm Personel')
    : staffUsers.find(item => item.userId === currentStaffUserId)?.displayName
      ?? activeUsers.find(item => item.userId === currentStaffUserId)?.displayName
      ?? t('tasks.staff.allStaff', 'Tüm Personel')
  const isMyTasksAllView = isMyTasksView && currentMyTaskView === 'all'
  // Durum sütunu: Görevlerim/Birimdeki Görevler "Tüm Görevler" görünümünde (card 532) ve
  // Personelimin Görevleri'nin tüm görünümlerinde — "Tüm Personel" + belirli personel (card #730).
  const showStatusColumn =
    ((isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'all')
    || isStaffTasksView
  const hideDueDateColumn = (isMyTasksView || isDepartmentTasksView) && (
    currentMyTaskView === 'rejected'
    || (isMyTasksView && currentMyTaskView === 'completed')
  )
  const hasTerminalDateColumn = (isMyTasksView || isDepartmentTasksView) && (
    currentMyTaskView === 'completed' || currentMyTaskView === 'rejected'
  )
  const tasksTableColumnCount = useMemo(() => {
    let count = 7
    if (isStaffTasksView || isMyTasksView || isDepartmentTasksView) count += 1
    if (!hideDueDateColumn) count += 1
    if ((isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'completed') count += 1
    if ((isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'rejected') count += 1
    if (showStatusColumn) count += 1
    return count
  }, [currentMyTaskView, hideDueDateColumn, isDepartmentTasksView, isMyTasksView, isStaffTasksView, showStatusColumn])
  const taskTypeParam = searchParams.get('taskType') ?? 'all'
  const currentTaskTypeFilter: 'all' | 'assigned' | 'routine' =
    taskTypeParam === 'assigned' || taskTypeParam === 'routine' ? taskTypeParam : 'all'
  const detailScopeLabel = isMyTasksView
    ? t('nav.myTasks', 'Görevlerim')
    : isDepartmentTasksView
      ? t('nav.departmentTasks', 'Birimdeki Görevler')
      : isStaffTasksView
        ? t('nav.staffTasks', 'Personelimin Görevleri')
        : t('tasks.detail.title', 'Görev Detayları')
  const showRouteTaskDetailAction = !!taskDetail
    && canManageDepartmentTaskActions(taskDetail)
    && isDepartmentTasksView
    && (currentMyTaskView === 'pending' || currentMyTaskView === 'overdue')
  const canRouteTaskDetail = showRouteTaskDetailAction
    && taskDetail.jobSourceType !== 'Routine'
    && isActionableTaskStatus(taskDetail.currentStatus)
  const visibleAssignmentHistory = useMemo(
    () => getVisibleAssignmentHistory(taskDetail?.assignmentHistory ?? []),
    [taskDetail?.assignmentHistory],
  )
  const canChangeTaskDueDate = !!taskDetail
    && canManageDepartmentTaskActions(taskDetail)
    && (isMyTasksView || isDepartmentTasksView || isStaffTasksView)
    && !['Completed', 'Cancelled', 'Rejected'].includes(taskDetail.currentStatus)
  const latestExtraTimeApproval = taskDetail?.approvals
    .filter(approval => approval.subjectType === 'TaskRevision')
    .sort((left, right) => right.stepOrder - left.stepOrder)[0] ?? null
  const pendingExtraTimeApproval = taskDetail?.approvals.find(approval =>
    approval.subjectType === 'TaskRevision' && approval.decision === 'Pending') ?? null
  const canRequestExtraTime = !!taskDetail
    && isMyTasksView
    && !isManagerLike
    && taskDetail.jobSourceType !== 'Routine'
    && taskDetail.assignedUserId === user?.userId
    && !['Completed', 'Cancelled', 'Rejected', 'RevisionRequested', 'PendingCloseApproval'].includes(taskDetail.currentStatus)
    && latestExtraTimeApproval === null
  const canReviewExtraTime = !!taskDetail
    && canManageDepartmentTaskActions(taskDetail)
    && (isDepartmentTasksView || isStaffTasksView)
    && pendingExtraTimeApproval != null
  // (onay)/(red) göstergesi: talep sahibinde her zaman; yöneticinin Birimdeki Görevler görünümünde
  // karar (onay/red) verildikten sonra da gösterilir (card #1400).
  const extraTimeDecided = latestExtraTimeApproval?.decision === 'Approved' || latestExtraTimeApproval?.decision === 'Rejected'
  const showExtraTimeDecisionBadge = !!latestExtraTimeApproval
    && ((isMyTasksView && !isManagerLike) || (isDepartmentTasksView && extraTimeDecided))

  const getTaskColumnValue = useCallback((key: string, row: Task & { taskOwnerDisplayName?: string; cancelReturnStatus?: string }): string => {
    if (key === 'currentStatus') return getTaskDisplayStatus(t, row)
    if (key === 'cancelReturnStatus') return row.currentStatus === 'Cancelled' ? 'İptal' : 'İade'
    if (key === 'priority') return getPriorityLabel(t, row.priority)
    if (key === 'jobNumber') return row.jobSourceType === 'Routine'
      ? `${t('tasks.columns.routineTaskLabel', 'Rutin Görev')} ${t('tasks.columns.routineNoRequestNo', 'Talep No olmaz')}`
      : formatTaskJobDisplayNumber(row, socialByJobId, locale)
    if (key === 'taskNumber') return formatTaskDisplayNumber(row)
    if (key === 'createdAtUtc') return formatDateTime(row.createdAtUtc, locale)
    if (key === 'dueDateUtc') return formatDateTime(row.dueDateUtc, locale)
    if (key === 'completedAtUtc') return formatDateTime(row.completedAtUtc ?? null, locale)
    if (key === 'updatedAtUtc') return formatDateTime(row.updatedAtUtc ?? null, locale)
    if (key === 'assignedDepartmentName') return row.assignedDepartmentName ?? row.assignedUserDisplayName ?? ''
    if (key === 'jobSourceType') return row.jobSourceType === 'Routine' ? t('tasks.type.routine', 'Rutin') : t('tasks.type.assigned', 'Atanmış')
    if (key === 'taskOwnerDisplayName') return row.taskOwnerDisplayName ?? row.assignedUserDisplayName ?? row.ownerDisplayName ?? ''
    return String((row as unknown as Record<string, unknown>)[key] ?? '')
  }, [t, locale, socialByJobId])

  const visibleTasks = useMemo(() => {
    let result: typeof tasks

    if (isStaffTasksView) {
      const staffTasks = tasks.filter(task => {
        if (!task.assignedUserId) return false
        if (currentStaffUserId !== 'all') return task.assignedUserId === currentStaffUserId
        return staffUserIds.has(task.assignedUserId)
      })
      let byUser = staffTasks
      if (currentTaskTypeFilter === 'routine') byUser = byUser.filter(task => task.jobSourceType === 'Routine')
      else if (currentTaskTypeFilter === 'assigned') byUser = byUser.filter(task => task.jobSourceType !== 'Routine')
      result = byUser
    } else if (isDepartmentTasksView) {
      // Kontrol paneli "Birimdeki Görevler" grafiği yalnızca birime atanmış görevleri sayar.
      const departmentTasks = tasks.filter(task =>
        task.assignedDepartmentId != null && managedDepartmentIds.has(task.assignedDepartmentId))
      result = filterMyTasks(departmentTasks, currentMyTaskView)
      if (isCitizenRequestManager) {
        result = result.filter(task => isCitizenRequestJob({ requestType: task.jobRequestType, sourceType: task.jobSourceType }))
      } else {
        result = result.filter(task => matchesRequestFlow(task.jobRequestType, currentRequestFlowFilter))
      }
    } else if (!isMyTasksView) {
      result = tasks
    } else {
      const myTasks = filterMyTasks(tasks, currentMyTaskView)
      result = showRequestFlowFilters ? myTasks.filter(task => matchesRequestFlow(task.jobRequestType, currentRequestFlowFilter)) : myTasks
    }

    if (isDepartmentTasksView) {
      if (currentTaskTypeFilter === 'routine') {
        result = result.filter(task => task.jobSourceType === 'Routine')
      } else if (currentTaskTypeFilter === 'assigned') {
        result = result.filter(task => task.jobSourceType !== 'Routine')
      }
    }

    if (filterFrom || filterTo) {
      const useDueDatePeriod = (isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'overdue'
      result = result.filter(task => {
        const dateValue = useDueDatePeriod ? task.dueDateUtc : task.createdAtUtc
        if (!dateValue) return false
        if (filterFrom && dateValue < filterFrom) return false
        if (filterTo && dateValue > filterTo) return false
        return true
      })
    }

    if (searchText.trim()) {
      result = result.filter(task => {
        const enriched = {
          ...task,
          taskOwnerDisplayName: task.assignedUserDisplayName ?? task.ownerDisplayName ?? '',
          cancelReturnStatus: 'İptal',
        }
        return matchesBannerSearch(
          searchText,
          TASK_SEARCH_COLUMN_KEYS.map(key => getTaskColumnValue(key, enriched)),
        )
      })
    }

    return result
  }, [currentMyTaskView, currentRequestFlowFilter, currentTaskTypeFilter, currentStaffUserId, filterFrom, filterTo, getTaskColumnValue, isCitizenRequestManager, isDepartmentTasksView, isMyTasksView, isStaffTasksView, managedDepartmentIds, searchText, showRequestFlowFilters, staffUserIds, tasks])

  const { sortKey: tasksSortKey, sortDir: tasksSortDir, toggleSort: _toggleTasksSort, sortItems: sortTasks } = useSortable()
  const { filters: taskFilters, setFilter: setTaskFilter, clearFilters: clearTaskFilters, matchesFilters: taskMatchesFilters } = useColumnFilters()

  const toggleTasksSort = (key: string) => {
    _toggleTasksSort(key)
    setTasksPage(1)
  }

  useEffect(() => { setTasksPage(1) }, [taskFilters])

  useEffect(() => {
    setFilterFrom(searchParams.get('from') ?? '')
    setFilterTo(searchParams.get('to') ?? '')
  }, [searchParams])

  useEffect(() => {
    queueMicrotask(() => {
      setTasksPage(1)
      setSearchText('')
      clearTaskFilters()
      setSelectedTask(null)
      setTaskDetail(null)
      setParentJobDetail(null)
      setReturnModal(null)
      setConfirmDialog(null)
      setDueDateEdit(null)
      setExtraTimeEdit(null)
      setExtraTimeReview(null)
      setToast(null)
      setError(null)
    })
  }, [activeDeptId, clearTaskFilters])

  const columnFilteredTasks = useMemo(
    () => visibleTasks
      .map(task => ({
        ...task,
        taskOwnerDisplayName: task.assignedUserDisplayName ?? task.ownerDisplayName ?? '',
        taskTypeCategory: task.jobSourceType === 'Routine' ? 'Rutin' : 'Atanmış',
        cancelReturnStatus: 'İptal',
      }))
      .filter(task => taskMatchesFilters(task, getTaskColumnValue)),
    [visibleTasks, taskMatchesFilters, getTaskColumnValue],
  )

  // Kullanıcı kolon sıralaması seçmediyse, Tamamlanmış/İptal görünümlerinde en yeni tarihli en üstte
  // olacak şekilde varsayılan sırala (tamamlanma→completedAtUtc, iptal→updatedAtUtc) (card #722).
  const viewDefaultSortedTasks = useMemo(() => {
    if (tasksSortKey) return columnFilteredTasks
    const isCompleted = (isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'completed'
    const isRejected = (isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'rejected'
    if (!isCompleted && !isRejected) return columnFilteredTasks
    return [...columnFilteredTasks].sort((a, b) => {
      const av = isCompleted ? a.completedAtUtc : a.updatedAtUtc
      const bv = isCompleted ? b.completedAtUtc : b.updatedAtUtc
      return new Date(bv ?? 0).getTime() - new Date(av ?? 0).getTime()
    })
  }, [columnFilteredTasks, tasksSortKey, isMyTasksView, isDepartmentTasksView, currentMyTaskView])

  const pagedTasks = useMemo(
    () => sortTasks(viewDefaultSortedTasks).slice((tasksPage - 1) * tasksPageSize, tasksPage * tasksPageSize),
    [viewDefaultSortedTasks, tasksPage, tasksPageSize, sortTasks],
  )

  const currentMyTaskViewLabel = t(MY_TASK_VIEWS.find(view => view.value === currentMyTaskView)?.labelKey ?? 'tasks.myViews.pending', 'Bekleyen Görevlerim')
  const currentDepartmentStatusViewLabel = t(
    DEPARTMENT_STATUS_VIEWS.find(view => view.value === currentMyTaskView)?.labelKey ?? 'tasks.departmentViews.pending',
    'Bekleyen Görevler',
  )
  const setMyTaskView = (view: MyTaskView) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', view)
    setSearchParams(nextParams)
    setTasksPage(1)
    clearTaskFilters()
  }

  const setRequestFlowFilter = (filter: RequestFlowFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    if (filter === 'all') nextParams.delete('flow')
    else nextParams.set('flow', filter)
    setSearchParams(nextParams)
    setTasksPage(1)
    clearTaskFilters()
  }

  const setDepartmentTaskFlow = (filter: RequestFlowFilter) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('flow', filter)
    setSearchParams(nextParams)
    setTasksPage(1)
    clearTaskFilters()
  }

  const setStaffUserFilter = (userId: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (userId === 'all') nextParams.delete('userId')
    else nextParams.set('userId', userId)
    setSearchParams(nextParams)
    setTasksPage(1)
    clearTaskFilters()
  }

  const setTaskTypeFilter = (type: 'all' | 'assigned' | 'routine') => {
    const nextParams = new URLSearchParams(searchParams)
    if (type === 'all') nextParams.delete('taskType')
    else nextParams.set('taskType', type)
    setSearchParams(nextParams)
    setTasksPage(1)
    clearTaskFilters()
  }

  useEffect(() => {
    const handler = () => setActiveDeptId(getActiveDepartmentId())
    window.addEventListener('activeDepartmentChanged', handler)
    return () => window.removeEventListener('activeDepartmentChanged', handler)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.getTasks(currentScope),
      api.getDepartments(),
      api.getUsers().catch(() => [] as User[]),
      api.getSocialMessages().catch(() => [] as SocialMessage[]),
    ])
      .then(([taskList, departmentList, userList, socialList]) => {
        if (cancelled) return
        setTasks(taskList)
        setDepartments(departmentList)
        setUsers(userList)
        setSocialMessages(socialList)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentScope, t, activeDeptId])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      api.getTasks(currentScope)
        .then(list => {
          setTasks(list)
          setError(null)
        })
        .catch(err => setError(err instanceof Error ? err.message : t('common.error')))
    }, 30000)

    return () => window.clearInterval(intervalId)
  }, [currentScope, t, activeDeptId])

  const reload = async () => {
    try {
      setLoading(true)
      setTasks(await api.getTasks(currentScope))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = (task: Task) => {
    setCompleteModal({ taskId: task.taskId, displayNumber: formatTaskDisplayNumber(task) })
    setCompletionNote('')
    setCompletionAttachmentError(null)
    setPendingCompletionAttachments([])
  }

  const cleanupPendingCompletionAttachments = (attachments: Array<{ attachmentId: string; fileName: string }>) => {
    if (attachments.length === 0) return
    void Promise.all(attachments.map(item => api.deleteAttachment(item.attachmentId))).catch(() => {
      // Modal kapanışını engelleme; silme yetkisi/bağlantı hatası sonraki açılışta görünür.
    })
  }

  const closeCompleteModal = () => {
    cleanupPendingCompletionAttachments(pendingCompletionAttachments)
    setPendingCompletionAttachments([])
    setCompletionAttachmentError(null)
    setCompleteModal(null)
    setCompletionNote('')
  }

  const handleCompletionFilesSelected = async (files: FileList | null) => {
    if (!completeModal || !files || files.length === 0) return
    setCompletionAttachmentError(null)

    for (const file of Array.from(files)) {
      if (!COMPLETION_ATTACHMENT_EXTENSIONS.includes(completionAttachmentExtension(file.name))) {
        setCompletionAttachmentError(t('attachments.errorType', 'Yalnızca resim (JPG, PNG), PDF ve Office dosyaları yüklenebilir.'))
        continue
      }
      if (file.size > COMPLETION_ATTACHMENT_MAX_SIZE) {
        setCompletionAttachmentError(t('attachments.errorSize', 'Dosya boyutu 5 MB\'ı aşamaz.'))
        continue
      }

      setCompletionAttachmentUploading(true)
      try {
        const attachment = await api.uploadTaskAttachment(completeModal.taskId, file)
        setPendingCompletionAttachments(current => [...current, { attachmentId: attachment.attachmentId, fileName: attachment.fileName }])
      } catch (err) {
        setCompletionAttachmentError(err instanceof Error ? err.message : t('common.error'))
      } finally {
        setCompletionAttachmentUploading(false)
      }
    }

    if (completeFileInputRef.current) completeFileInputRef.current.value = ''
  }

  const handleCompleteConfirm = async () => {
    if (!completeModal || !completionNote.trim()) return
    setCompleteSaving(true)
    try {
      await api.completeTask(completeModal.taskId, completionNote.trim())
      setPendingCompletionAttachments([])
      invalidateTasks(queryClient, completeModal.taskId, selectedTask?.jobId)
      setCompleteModal(null)
      setCompletionNote('')
      setCompletionAttachmentError(null)
      if (selectedTask?.taskId === completeModal.taskId) {
        const [updatedDetail, updatedList] = await Promise.all([
          api.getTaskById(completeModal.taskId),
          api.getTasks(currentScope),
        ])
        setTaskDetail(updatedDetail)
        setSelectedTask(current => current ? { ...current, currentStatus: 'Completed', completedAtUtc: updatedDetail.completedAtUtc } : current)
        setTasks(updatedList)
      } else {
        await reload()
      }
      showToast(t('tasks.actions.completeSuccess', 'Görev başarıyla tamamlandı!'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setCompleteSaving(false)
    }
  }

  const openStatusChangeModal = (task: Task) => {
    setStatusChangeModal({ taskId: task.taskId, currentStatus: task.currentStatus, displayNumber: formatTaskDisplayNumber(task) })
    setStatusChangeReason('')
    setStatusChangeTarget('')
  }

  const closeStatusChangeModal = () => {
    setStatusChangeModal(null)
    setStatusChangeReason('')
    setStatusChangeTarget('')
  }

  const handleStatusChangeConfirm = async () => {
    if (!statusChangeModal || !statusChangeReason.trim() || !statusChangeTarget) return
    setStatusChangeSaving(true)
    try {
      await api.changeTaskStatus(statusChangeModal.taskId, statusChangeTarget, statusChangeReason.trim())
      invalidateTasks(queryClient, statusChangeModal.taskId)
      closeStatusChangeModal()
      await reload()
      if (selectedTask?.taskId === statusChangeModal.taskId) {
        const updatedDetail = await api.getTaskById(statusChangeModal.taskId)
        setTaskDetail(updatedDetail)
      }
      showToast(t('tasks.actions.statusChangeSuccess', 'Görev durumu güncellendi.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setStatusChangeSaving(false)
    }
  }

  const handleClaim = async (taskId: string) => {
    setError(null)
    try {
      await api.claimTask(taskId)
      invalidateTasks(queryClient, taskId)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const openReturnModal = (taskId: string) => {
    const task = tasks.find(t => t.taskId === taskId)
    const isReporterTask = task?.createdByRoleCode === 'Reporter' && !isManagerLike
    const useManagerReporterRedirectLabel =
      task?.createdByRoleCode === 'Reporter' && isManagerLike && task.assignedUserId === user?.userId
    setReturnModal({ taskId, step: 'cancel', assignedDepartmentId: task?.assignedDepartmentId ?? null, isReporterTask, useManagerReporterRedirectLabel, directRoute: false })
    setCancelReason('')
    setReturnDeptId('')
    setReturnUserId('')
  }

  const openRouteModal = (taskId: string) => {
    const task = tasks.find(t => t.taskId === taskId)
    const departmentId = task?.assignedDepartmentId ?? activeDeptId ?? user?.departmentId ?? null
    setReturnModal({
      taskId,
      step: 'return',
      assignedDepartmentId: departmentId,
      isReporterTask: task?.createdByRoleCode === 'Reporter',
      useManagerReporterRedirectLabel: false,
      directRoute: true,
    })
    setCancelReason('')
    setReturnDeptId(departmentId ?? '')
    setReturnUserId('')
  }

  const closeReturnModal = () => {
    setReturnModal(null)
    setCancelReason('')
    setReturnDeptId('')
    setReturnUserId('')
  }

  const handleCancelTask = async () => {
    if (!returnModal || !cancelReason.trim()) return
    setReturnSaving(true)
    try {
      await api.cancelTask(returnModal.taskId, cancelReason.trim())
      invalidateTasks(queryClient, returnModal.taskId)
      closeReturnModal()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setReturnSaving(false)
    }
  }

  const handleReturn = async () => {
    if (!returnModal) return
    setReturnSaving(true)
    try {
      await api.assignTask(returnModal.taskId, returnDeptId || undefined, returnUserId || undefined)
      invalidateTasks(queryClient, returnModal.taskId)
      closeReturnModal()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setReturnSaving(false)
    }
  }

  // "Görev Ekleri" sütunundaki ek dosyasını indir (auth'lu blob → object URL) (card #723).
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

  const openDueDateEdit = () => {
    if (!taskDetail) return
    setDueDateEdit({
      taskId: taskDetail.taskId,
      value: toDateTimePickerValue(taskDetail.dueDateUtc),
      saving: false,
      mode: 'picking',
    })
  }

  const closeDueDateEdit = () => {
    setDueDateEdit(null)
  }

  const handleDueDateSave = async () => {
    if (!dueDateEdit || !taskDetail) return
    setDueDateEdit(current => current ? { ...current, saving: true } : null)
    try {
      const dueDateUtc = dueDateEdit.value ? new Date(dueDateEdit.value).toISOString() : null
      await api.updateTaskDueDate(dueDateEdit.taskId, dueDateUtc)
      invalidateTasks(queryClient, dueDateEdit.taskId, taskDetail.jobId)
      const updatedDetail = await api.getTaskById(dueDateEdit.taskId)
      setTaskDetail(updatedDetail)
      setTasks(current => current.map(task =>
        task.taskId === dueDateEdit.taskId
          ? { ...task, dueDateUtc: updatedDetail.dueDateUtc, updatedAtUtc: new Date().toISOString() }
          : task
      ))
      setDueDateEdit(null)
      showToast(t('tasks.actions.dueDateUpdated', 'Son tarih güncellendi.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setDueDateEdit(current => current ? { ...current, saving: false } : null)
    }
  }

  const openExtraTimeEdit = () => {
    if (!taskDetail) return
    setExtraTimeEdit({
      taskId: taskDetail.taskId,
      value: toDateTimePickerValue(taskDetail.dueDateUtc),
      saving: false,
      mode: 'picking',
    })
  }

  const closeExtraTimeEdit = () => {
    setExtraTimeEdit(null)
  }

  const handleExtraTimeRequest = async () => {
    if (!extraTimeEdit || !taskDetail || !extraTimeEdit.value) return
    setExtraTimeEdit(current => current ? { ...current, saving: true } : null)
    try {
      const proposedDueDateUtc = new Date(extraTimeEdit.value).toISOString()
      const reason = `${t('tasks.actions.extraTimeRequest', 'Ek süre iste')}: ${proposedDueDateUtc}`
      await api.requestTaskRevision(extraTimeEdit.taskId, reason, proposedDueDateUtc)
      setTasks(current => current.map(task =>
        task.taskId === extraTimeEdit.taskId
          ? { ...task, hasPendingExtraTimeRequest: true, lastExtraTimeRequestDecision: null, updatedAtUtc: new Date().toISOString() }
          : task
      ))
      invalidateTasks(queryClient, extraTimeEdit.taskId, taskDetail.jobId)
      invalidateNotifications(queryClient)
      const updatedDetail = await api.getTaskById(extraTimeEdit.taskId)
      setTaskDetail(updatedDetail)
      setTasks(current => current.map(task =>
        task.taskId === extraTimeEdit.taskId
          ? {
              ...task,
              currentStatus: updatedDetail.currentStatus,
              hasPendingExtraTimeRequest: updatedDetail.hasPendingExtraTimeRequest,
              lastExtraTimeRequestDecision: updatedDetail.lastExtraTimeRequestDecision,
              updatedAtUtc: new Date().toISOString(),
            }
          : task
      ))
      setExtraTimeEdit(null)
      showToast(t('tasks.actions.extraTimeRequested', 'Ek süre talebi yöneticinize iletildi.'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setExtraTimeEdit(current => current ? { ...current, saving: false } : null)
    }
  }

  const openExtraTimeReview = () => {
    if (!taskDetail || !pendingExtraTimeApproval) return
    setExtraTimeReview({
      taskId: taskDetail.taskId,
      proposedDueDateUtc: getExtraTimeProposedDueDate(pendingExtraTimeApproval.comment),
      saving: false,
    })
  }

  const closeExtraTimeReview = () => {
    setExtraTimeReview(null)
  }

  const refreshTaskAfterRevisionDecision = async (taskId: string, jobId: string) => {
    invalidateTasks(queryClient, taskId, jobId)
    const updatedDetail = await api.getTaskById(taskId)
    setTaskDetail(updatedDetail)
    setTasks(current => current.map(task =>
      task.taskId === taskId
        ? {
            ...task,
            currentStatus: updatedDetail.currentStatus,
            dueDateUtc: updatedDetail.dueDateUtc,
            hasPendingExtraTimeRequest: updatedDetail.hasPendingExtraTimeRequest,
            lastExtraTimeRequestDecision: updatedDetail.lastExtraTimeRequestDecision,
            updatedAtUtc: new Date().toISOString(),
          }
        : task
    ))
  }

  const handleExtraTimeApprove = async () => {
    if (!extraTimeReview || !taskDetail) return
    setExtraTimeReview(current => current ? { ...current, saving: true } : null)
    try {
      await api.approveTaskRevision(extraTimeReview.taskId, t('tasks.actions.extraTimeApproved', 'Onaylanmış ek süre'), extraTimeReview.proposedDueDateUtc)
      setTasks(current => current.map(task =>
        task.taskId === extraTimeReview.taskId
          ? { ...task, hasPendingExtraTimeRequest: false, lastExtraTimeRequestDecision: 'Approved', updatedAtUtc: new Date().toISOString() }
          : task
      ))
      await refreshTaskAfterRevisionDecision(extraTimeReview.taskId, taskDetail.jobId)
      invalidateNotifications(queryClient)
      setExtraTimeReview(null)
      showToast(t('tasks.actions.extraTimeApproved', 'Onaylanmış ek süre'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setExtraTimeReview(current => current ? { ...current, saving: false } : null)
    }
  }

  const handleExtraTimeReject = async () => {
    if (!extraTimeReview || !taskDetail) return
    setExtraTimeReview(current => current ? { ...current, saving: true } : null)
    try {
      await api.rejectTaskRevision(extraTimeReview.taskId, t('tasks.actions.extraTimeRejected', 'Ek süre talebi reddedildi.'))
      setTasks(current => current.map(task =>
        task.taskId === extraTimeReview.taskId
          ? { ...task, hasPendingExtraTimeRequest: false, lastExtraTimeRequestDecision: 'Rejected', updatedAtUtc: new Date().toISOString() }
          : task
      ))
      await refreshTaskAfterRevisionDecision(extraTimeReview.taskId, taskDetail.jobId)
      invalidateNotifications(queryClient)
      setExtraTimeReview(null)
      showToast(t('tasks.actions.extraTimeRejected', 'Ek süre talebi reddedildi.'), 'error')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      setExtraTimeReview(current => current ? { ...current, saving: false } : null)
    }
  }

  const isAssignee = (task: Task) => task.assignedUserId === user?.userId
  const canEditRoutineTask = (task: Pick<Task, 'jobSourceType' | 'assignedUserId' | 'currentStatus'>) =>
    task.jobSourceType === 'Routine'
    && task.assignedUserId === user?.userId
    && isActionableTaskStatus(task.currentStatus)
  const canChangeCompletedTaskStatus = (task: Pick<Task, 'currentStatus' | 'assignedUserId'>) =>
    isMyTasksView
    && (currentMyTaskView === 'completed' || currentMyTaskView === 'rejected')
    && (task.currentStatus === 'Completed' || task.currentStatus === 'Cancelled')
    && isAssignee(task as Task)
  const canChangeTaskStatusFromDetail = (task: Pick<Task, 'currentStatus' | 'assignedUserId'>) =>
    isMyTasksView
    && (currentMyTaskView === 'all' || currentMyTaskView === 'completed' || currentMyTaskView === 'rejected')
    && (task.currentStatus === 'Completed' || task.currentStatus === 'Cancelled')
    && isAssignee(task as Task)
  const showOnlyDetailsInTaskGridActions = isMyTasksView || isDepartmentTasksView
  const openRoutineTaskEdit = (taskId: string) => {
    closeTaskDetail()
    navigate(getRoutineTaskEditPath(taskId))
  }
  const getUserName = (userId?: string | null) => users.find(item => item.userId === userId)?.displayName ?? '—'
const pageKicker = isMyTasksView
    ? currentMyTaskViewLabel
    : isDepartmentTasksView
      ? currentDepartmentStatusViewLabel
      : isStaffTasksView
        ? currentStaffUserLabel
        : t('tasks.scopeSelector', 'İş görünümleri')
  const pageTitle = isMyTasksView
    ? t('nav.myTasks', 'Görevlerim')
    : isDepartmentTasksView
      ? t('nav.departmentTasks', 'Birimdeki Görevler')
      : isStaffTasksView
        ? t('nav.staffTasks', 'Personelimin Görevleri')
        : t('nav.tasks')
  const pageSubtitle = isMyTasksView
    ? t('tasks.myTasksSubtitle', 'Size atanmış görevleri durumuna göre takip edin.')
    : isDepartmentTasksView
      ? t('tasks.departmentTasksSubtitle', 'Müdürlüğünüzde oluşan görevleri kaynak tipine göre takip edin.')
      : isStaffTasksView
        ? t('tasks.staffTasksSubtitle', 'Personelinizin üzerindeki görevleri ve aşamalarını izleyin.')
        : t('tasks.subtitle')

  const openTaskDetail = async (task: Task) => {
    setSelectedTask(task)
    setTaskDetail(null)
    setParentJobDetail(null)
    setRoutineEditHistory([])
    setDetailLoading(true)
    try {
      const [detail, jobDetail] = await Promise.all([
        api.getTaskById(task.taskId),
        task.jobId ? api.getJobById(task.jobId).catch(() => null) : Promise.resolve(null),
      ])
      setTaskDetail(detail)
      setParentJobDetail(jobDetail)
      if (detail.jobSourceType === 'Routine') {
        const auditEntries = await api.getTaskAuditLog(task.taskId).catch(() => [])
        setRoutineEditHistory(parseRoutineTaskEditHistory(auditEntries))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }

  // Bildirim derin bağlantısı "Görevlerim" listenizde olmayan bir görevi işaret ettiğinde
  // (ör. size atanmamış görev) detayı id ile getirip aynı pop-up'ta açar (card 580).
  const openTaskDetailById = async (taskId: string) => {
    setTaskDetail(null)
    setParentJobDetail(null)
    setRoutineEditHistory([])
    setDetailLoading(true)
    try {
      const detail = await api.getTaskById(taskId)
      const parentJob = detail.jobId ? await api.getJobById(detail.jobId).catch(() => null) : null
      setTaskDetail(detail)
      setParentJobDetail(parentJob)
      if (detail.jobSourceType === 'Routine') {
        const auditEntries = await api.getTaskAuditLog(taskId).catch(() => [])
        setRoutineEditHistory(parseRoutineTaskEditHistory(auditEntries))
      }
      // Modal başlığı/yazdırma için Task özetini detaydan + bağlı talepten türet.
      setSelectedTask({
        ...detail,
        ownerDepartmentName: parentJob?.ownerDepartmentName ?? null,
        jobNumber: parentJob?.jobNumber ?? null,
        jobNumberYear: parentJob?.jobNumberYear ?? null,
      } as Task)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    if (!autoOpenTaskId) {
      dismissedAutoOpenTaskIdRef.current = null
      return
    }
    if (
      selectedTask?.taskId === autoOpenTaskId ||
      dismissedAutoOpenTaskIdRef.current === autoOpenTaskId ||
      autoOpenInFlightRef.current === autoOpenTaskId
    ) return
    const task = tasks.find(item => item.taskId === autoOpenTaskId)
    if (task) {
      void openTaskDetail(task)
    } else if (!loading) {
      // Görev mevcut listede yok (liste yüklendi) → id ile getir.
      autoOpenInFlightRef.current = autoOpenTaskId
      void openTaskDetailById(autoOpenTaskId).finally(() => {
        if (autoOpenInFlightRef.current === autoOpenTaskId) autoOpenInFlightRef.current = null
      })
    }
  }, [autoOpenTaskId, selectedTask?.taskId, tasks, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!parentJobDetail || !isCitizenRequestJob(parentJobDetail)) {
      setCitizenSourceMessage(null)
      return
    }
    let cancelled = false
    async function loadCitizenSourceMessage() {
      if (parentJobDetail!.sourceType === 'SocialMessage' && parentJobDetail!.sourceRefId) {
        try {
          const message = await api.getSocialMessageById(parentJobDetail!.sourceRefId)
          if (!cancelled) setCitizenSourceMessage(message)
          return
        } catch {
          /* fall through */
        }
      }
      try {
        const messages = await api.getSocialMessages()
        if (!cancelled) {
          setCitizenSourceMessage(messages.find(message => message.jobId === parentJobDetail!.jobId) ?? null)
        }
      } catch {
        if (!cancelled) setCitizenSourceMessage(null)
      }
    }
    void loadCitizenSourceMessage()
    return () => { cancelled = true }
  }, [parentJobDetail?.jobId, parentJobDetail?.sourceRefId, parentJobDetail?.sourceType])

  const openCitizenConversationModal = () => {
    if (!parentJobDetail) return
    const socialMessageId = parentJobDetail.sourceType === 'SocialMessage' && parentJobDetail.sourceRefId
      ? parentJobDetail.sourceRefId
      : citizenSourceMessage?.socialMessageId
    if (!socialMessageId) return
    setConversationModal({
      socialMessageId,
      citizenHandle: citizenSourceMessage?.citizenHandle ?? parentJobDetail.citizenName ?? parentJobDetail.citizenPhone ?? '',
      citizenPhone: parentJobDetail.citizenPhone ?? citizenSourceMessage?.citizenPhone ?? null,
    })
  }

  const closeTaskDetail = () => {
    cleanupPendingCompletionAttachments(pendingCompletionAttachments)
    setPendingCompletionAttachments([])
    setCompletionAttachmentError(null)
    dismissedAutoOpenTaskIdRef.current = autoOpenTaskId
    setSelectedTask(null)
    setTaskDetail(null)
    setParentJobDetail(null)
    setRoutineEditHistory([])
    setRoutineEditHistoryModalOpen(false)
    setDueDateEdit(null)
    setExtraTimeEdit(null)
    setExtraTimeReview(null)
    // Detay derin bağlantıyla (ör. Birime Gelen Talepler) açıldıysa kapatınca geldiği sayfaya dön;
    // bu sayfada kalıp Birimdeki Görevler'e düşmemeli (card 549).
    if (notificationTaskId) {
      onNotificationDetailClose?.()
      return
    }
    if (autoOpenTaskId) {
      navigate(-1)
      return
    }
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('taskId')
    setSearchParams(nextParams, { replace: true })
  }

  const routineEditFieldLabel = (fieldKey: string) => {
    switch (fieldKey) {
      case 'title': return t('tasks.newRequest.title', 'Başlık')
      case 'priority': return t('tasks.newRequest.priority', 'Öncelik')
      case 'dueDateUtc': return t('tasks.columns.dueDate', 'Son Tarih')
      case 'address': return t('address.sectionTitle', 'Adres Bilgisi (İsteğe Bağlı)')
      case 'description': return t('tasks.newRequest.description', 'Açıklama')
      case 'attachments': return t('attachments.sectionTitle', 'Ekler / Fotoğraflar')
      default: return fieldKey
    }
  }

  const formatRoutineEditChangeValue = (fieldKey: string, value: string) => {
    if (!value || value === '—') return '—'
    if (fieldKey === 'dueDateUtc') return formatDateTime(value, locale)
    if (fieldKey === 'priority') return getPriorityLabel(t, value)
    return value
  }

  return (
    <div className={detailOnly ? 'hidden' : 'page-stack desktop-page-shell'}>
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{pageKicker}</div>
            <h1 className="page-title">{pageTitle}</h1>
            <p className="page-subtitle">{pageSubtitle}</p>
          </div>
          <div className="ml-auto mt-auto shrink-0">
            <TaskScopeFilters
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

      {isMyTasksView ? (
        <nav className="scope-chips" aria-label={t('nav.myTasks', 'Görevlerim')}>
          {MY_TASK_VIEWS.map(view => (
            <button
              key={view.value}
              type="button"
              className={`scope-chip ${getScopeChipColorClass(view.value)}${view.value === currentMyTaskView ? ' active' : ''}`}
              onClick={() => setMyTaskView(view.value)}
            >
              {t(view.labelKey)}
            </button>
          ))}
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
        </nav>
      ) : isDepartmentTasksView ? (
        <nav className="scope-chips" aria-label={t('nav.departmentTasks', 'Birimdeki Görevler')}>
          {DEPARTMENT_STATUS_VIEWS.map(view => (
            <button
              key={view.value}
              type="button"
              className={`scope-chip ${getScopeChipColorClass(view.value)}${view.value === currentMyTaskView ? ' active' : ''}`}
              onClick={() => setMyTaskView(view.value)}
            >
              {t(view.labelKey)}
            </button>
          ))}
          {showDepartmentTaskFlowFilters ? (
            <>
              <span className="scope-chip-divider" aria-hidden="true">|</span>
              {DEPARTMENT_TASK_FLOWS.map(flow => (
                <button
                  key={flow.value}
                  type="button"
                  className={`scope-chip scope-chip--${flow.value}${flow.value === currentRequestFlowFilter ? ' active' : ''}`}
                  onClick={() => setDepartmentTaskFlow(flow.value)}
                >
                  {t(flow.labelKey)}
                </button>
              ))}
            </>
          ) : null}
        </nav>
      ) : isStaffTasksView ? (
        <nav className="scope-chips">
          {staffFilterUsers.map(item => (
            <button
              key={item.userId}
              type="button"
              className={`scope-chip scope-chip--pending${currentStaffUserId === item.userId ? ' active' : ''}`}
              onClick={() => setStaffUserFilter(item.userId)}
            >
              {item.displayName}
            </button>
          ))}
          <button
            type="button"
            className={`scope-chip scope-chip--pending${currentStaffUserId === 'all' ? ' active' : ''}`}
            onClick={() => setStaffUserFilter('all')}
          >
            {t('tasks.staff.allStaff', 'Tüm Personel')}
          </button>
          <span className="scope-chip-divider" aria-hidden="true">|</span>
          {TASK_TYPE_FILTERS.map(filter => (
            <button
              key={filter.value}
              type="button"
              className={`scope-chip scope-chip--pending${filter.value === currentTaskTypeFilter ? ' active' : ''}`}
              onClick={() => setTaskTypeFilter(filter.value)}
            >
              {t(filter.labelKey)}
            </button>
          ))}
        </nav>
      ) : (
        <nav className="scope-chips">
          {scopes.map(scope => (
            <button
              key={scope}
              type="button"
              className={`scope-chip${scope === currentScope ? ' active' : ''}`}
              onClick={() => setSearchParams({ scope })}
            >
              {t(SCOPES.find(s => s.value === scope)!.labelKey)}
            </button>
          ))}
        </nav>
      )}

      {selectedTask && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
        >
          <section
            className="detail-modal-shell flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Sabit başlık — scroll edilse bile yerinde kalır (card 1) */}
            <div className="detail-modal-header-mobile flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
              <div className="detail-modal-header-title min-w-0">
                <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-slate-600 leading-tight">
                  {detailScopeLabel}
                </div>
              </div>
              <div className="detail-modal-header-actions flex shrink-0 items-center gap-2">
                {parentJobDetail
                  && isCitizenRequestJob(parentJobDetail)
                  && canShowCitizenWhatsAppConversation(parentJobDetail, citizenSourceMessage) && (
                  <Button
                    type="button"
                    className="!bg-sky-400 !text-white hover:!bg-sky-500"
                    onClick={openCitizenConversationModal}
                  >
                    {t('social.goToConversation', 'Yazışmaya Git')}
                  </Button>
                )}
                {showRouteTaskDetailAction && selectedTask && (canRouteTaskDetail ? (
                  <Button
                    type="button"
                    className="bg-[#007985] text-white shadow-sm hover:bg-[#006570]"
                    onClick={() => openRouteModal(selectedTask.taskId)}
                  >
                    {t('tasks.actions.route', 'Görevi Yönlendir')}
                  </Button>
                ) : (
                  <DisabledActionButton
                    className="bg-[#007985] text-white"
                    hoverTitle={t('tasks.actions.routeUnavailable', 'Bu görev yönlendirilemez')}
                  >
                    {t('tasks.actions.route', 'Görevi Yönlendir')}
                  </DisabledActionButton>
                ))}
                {isMyTasksView && selectedTask && canChangeTaskStatusFromDetail(selectedTask) && (
                  <Button
                    type="button"
                    className="bg-orange-500 text-white hover:bg-orange-600"
                    onClick={() => openStatusChangeModal(selectedTask)}
                  >
                    {t('tasks.actions.changeStatus', 'Durum Değiştir')}
                  </Button>
                )}
                {isMyTasksView && selectedTask
                  && (!canChangeTaskStatusFromDetail(selectedTask) || currentMyTaskView === 'completed' || currentMyTaskView === 'rejected')
                  && (canEditRoutineTask(selectedTask) ? (
                  <Button
                    type="button"
                    className="inline-flex items-center gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
                    onClick={() => openRoutineTaskEdit(selectedTask.taskId)}
                  >
                    <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('common.edit', 'Düzenle')}
                  </Button>
                ) : (
                  <DisabledActionButton
                    className="inline-flex items-center gap-1.5 bg-teal-700 text-white"
                    hoverTitle={t('tasks.actions.editUnavailable', 'Bu görev düzenlenemez')}
                  >
                    <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('common.edit', 'Düzenle')}
                  </DisabledActionButton>
                ))}
                {isMyTasksView && canCompleteTask && (
                  <Button type="button" variant="success" onClick={() => selectedTask && handleComplete(selectedTask)}>
                    {t('tasks.actions.complete', 'Tamamla')}
                  </Button>
                )}
                {isMyTasksView && canCompleteTask && (
                  <Button type="button" variant="destructive" onClick={() => openReturnModal(taskDetail.taskId)}>
                    {t('tasks.actions.cancelTask', 'Görevi İptal Et')}
                  </Button>
                )}
                {taskDetail
                  && isDepartmentTasksView
                  && currentMyTaskView !== 'all'
                  && canManageDepartmentTaskActions(taskDetail)
                  && isActionableTaskStatus(taskDetail.currentStatus) && (
                    <Button type="button" variant="destructive" onClick={() => openReturnModal(taskDetail.taskId)}>
                      {t('tasks.actions.cancelTask', 'Görevi İptal Et')}
                    </Button>
                )}
                {taskDetail && (
                  <Button type="button" variant="secondary" className="detail-print-action" onClick={() => printTaskDetail(taskDetail, selectedTask, parentJobDetail, citizenSourceMessage, t, locale)}>
                    {t('common.print', 'Yazdır')}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={closeTaskDetail}
                  className="detail-modal-header-close flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
                  aria-label={t('common.close', 'Kapat')}
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Kaydırılabilir içerik alanı */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="loading">{t('common.loading')}</div>
              ) : taskDetail ? (
                <>
                  {/* Görev bilgi kutusu — birleşik detay alanı, tüm satır genişliğinde (card #1092).
                      Tamamlama aksiyonu üstteki başlık butonlarında; eskiden sağda boş kalan
                      0.75fr sütun kaldırıldı, böylece detay sütunları sıkışmaz. */}
                  <section className="mb-5">
                    <div className="grid gap-4 lg:items-stretch">
                      <div className="form-card page-stack min-w-0">
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <div className="text-sm font-semibold text-emerald-600">
                              {t('tasks.detail.title', 'Görev Detayları')}
                            </div>
                            <div className={`grid gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 lg:items-stretch ${
                              parentJobDetail && taskDetail.jobSourceType !== 'Routine'
                                ? (taskDetail.currentStatus === 'Completed'
                                  ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)_minmax(0,1fr)]'
                                  : 'lg:grid-cols-[44%_20%_36%]')
                                : 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.6fr)_minmax(0,1.6fr)]'
                            }`}>
                              <div className="min-w-0 divide-y divide-slate-100">
                                {[
                                  { label: 'Görev No', value: formatTaskDisplayNumber(selectedTask) },
                                  { label: 'Görev Başlığı', value: taskDetail.title },
                                  ...(taskDetail.jobSourceType !== 'Routine'
                                    ? [{
                                        label: 'Talep Yeri / Oluşturan',
                                        value: [selectedTask.ownerDepartmentName, selectedTask.createdByDisplayName].filter(Boolean).join(' / ') || '—',
                                      }]
                                    : []),
                                  // Görev yönlendirilince sahibi artık güncel atanan kullanıcıdır;
                                  // assignedUser önce, yoksa owner (JobsPage Görev Detayları ile aynı) (card #719).
                                  { label: t('tasks.columns.owner', 'Görevi Yapan'), value: taskDetail.assignedUserDisplayName ?? taskDetail.ownerDisplayName ?? '—' },
                                  {
                                    label: 'Görev Tipi',
                                    value: `${taskDetail.jobSourceType === 'Routine'
                                      ? t('tasks.type.routine', 'Rutin')
                                      : t('tasks.type.assigned', 'Atanmış')}${taskDetail.assigningManagerDisplayName ? ` (${taskDetail.assigningManagerDisplayName})` : ''}`,
                                  },
                                  ...(taskDetail.jobSourceType === 'Routine'
                                    ? [{ label: 'Öncelik', value: getPriorityLabel(t, taskDetail.priority) }]
                                    : []),
                                  // "Proje mi" yalnızca talebe özgüdür; görev detayından kaldırıldı (card 543).
                                ].map(({ label, value }, index, rows) => (
                                  <div key={label} className={`flex items-start gap-2 px-3 py-2${index === rows.length - 1 ? ' border-b border-slate-100' : ''}`}>
                                    <span className={`${parentJobDetail && taskDetail.jobSourceType !== 'Routine' ? 'w-28' : 'w-36'} shrink-0 pt-0.5 text-xs font-semibold text-slate-500`}>{label}</span>
                                    <span className={`min-w-0 break-words text-sm ${typeof value === 'string' ? 'text-slate-900' : ''}`}>{value}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                                <div className="divide-y divide-slate-100">
                                  {[
                                    // Öncelik, sol kolona Görev Tipi'nin altına taşındı (card #705).
                                    {
                                      label: 'Durum',
                                      // Durum + (durumu belirleyen kullanıcı) + tıklanabilir İptal/Tamamlama Notu (card 642).
                                      value: (
                                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                          <span className={taskDetail.currentStatus === 'Completed'
                                            ? 'text-emerald-600'
                                            : (taskDetail.currentStatus === 'Cancelled' || taskDetail.currentStatus === 'Rejected')
                                              ? 'text-red-600'
                                              // "Yapılmakta" (Assigned/InProgress) turuncu — Talep Detayları ile aynı (card #725).
                                              : (taskDetail.currentStatus === 'Assigned' || taskDetail.currentStatus === 'InProgress')
                                                ? 'text-[#f97316]'
                                                : 'text-slate-900'}
                                          >
                                            {getTaskDisplayStatus(t, taskDetail)}
                                            {taskDetail.statusActorDisplayName ? ` (${taskDetail.statusActorDisplayName})` : ''}
                                          </span>
                                          {taskDetail.currentStatus === 'Cancelled' && taskDetail.revisionReason ? (
                                            <span className="inline-flex items-center text-red-600">
                                              <span>(</span>
                                              <button
                                                type="button"
                                                className="font-semibold hover:text-red-700"
                                                onClick={() => setConfirmDialog({ title: t('tasks.detail.cancelNote', 'İptal Notu'), message: taskDetail.revisionReason!, hideCancel: true, variant: 'destructive', titleDivider: true, titleTone: 'danger', confirmLabel: t('common.close', 'Kapat'), onConfirm: () => {} })}
                                              >
                                                <span className="underline underline-offset-2">{t('tasks.detail.cancelNote', 'İptal Notu')}</span>
                                              </button>
                                              <span>)</span>
                                            </span>
                                          ) : null}
                                          {taskDetail.currentStatus === 'Completed' && taskDetail.notes ? (
                                            <span className="inline-flex items-center text-emerald-600">
                                              <span>(</span>
                                              <button
                                                type="button"
                                                className="font-semibold hover:text-emerald-700"
                                                onClick={() => setConfirmDialog({ title: t('tasks.detail.completionNote', 'Tamamlama Notu'), titleDivider: true, titleTone: 'success', message: richTextToPlainText(taskDetail.notes), hideCancel: true, variant: 'success', confirmLabel: t('common.close', 'Kapat'), onConfirm: () => {} })}
                                              >
                                                <span className="underline underline-offset-2">{t('tasks.detail.completionNote', 'Tamamlama Notu')}</span>
                                              </button>
                                              <span>)</span>
                                            </span>
                                          ) : null}
                                        </span>
                                      ),
                                    },
                                    { label: 'Görev Tarihi', value: formatDateTime(taskDetail.createdAtUtc, locale) },
                                    // Görev tamamlandıysa/iptal edildiyse Son Tarih'ten önce ilgili tarihi göster (card #710).
                                    // İptal tarihi için özet satırın updatedAtUtc'si kullanılır (TaskDetail'da yok).
                                    ...(taskDetail.currentStatus === 'Completed'
                                      ? [{ label: t('tasks.columns.completedAt', 'Tamamlanma Tarihi'), value: <span className="text-emerald-600">{formatDateTime(taskDetail.completedAtUtc, locale)}</span> }]
                                      : taskDetail.currentStatus === 'Cancelled'
                                        ? [{ label: t('tasks.columns.cancelledAt', 'İptal Tarihi'), value: <span className="text-red-600">{formatDateTime(selectedTask.updatedAtUtc ?? null, locale)}</span> }]
                                        : []),
                                    {
                                      label: 'Son Tarih',
                                      value: (
                                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                          <span>{formatDueDateTime(taskDetail.dueDateUtc, locale)}</span>
                                          {/* Detayda yalnız bekleyen işaret; onaylandı/reddedildi ifadesi gride özeldir (card #1386). */}
                                          <GridExtraTimeMarkers
                                            hasPending={taskDetail.hasPendingExtraTimeRequest}
                                            inline
                                          />
                                        </span>
                                      ),
                                    },
                                  ].map(({ label, value }) => (
                                    // Orta kolon sol kolondan kısa olduğunda son satır "Son Tarih"in
                                    // altına kapanış çizgisi (boşlukta border eksikliği) (card #712/#713).
                                    <div key={label} className={`flex flex-col gap-0.5 px-4 py-2${label === 'Son Tarih' ? ' border-b border-slate-100' : ''}`}>
                                      <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                        {label}
                                        {label === 'Son Tarih' && canChangeTaskDueDate && dueDateEdit?.taskId !== taskDetail.taskId && (
                                          <button
                                            type="button"
                                            className="font-bold text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
                                            onClick={openDueDateEdit}
                                          >
                                            {t('common.change', 'Değiştir')}
                                          </button>
                                        )}
                                        {label === 'Son Tarih' && canRequestExtraTime && extraTimeEdit?.mode !== 'confirm' && (
                                          <button
                                            type="button"
                                            className="font-bold text-amber-500 underline underline-offset-2 hover:text-amber-600"
                                            onClick={openExtraTimeEdit}
                                          >
                                            {t('tasks.actions.extraTimeRequest', 'Ek süre iste')}
                                          </button>
                                        )}
                                        {label === 'Son Tarih' && showExtraTimeDecisionBadge && latestExtraTimeApproval && (
                                          <span className="inline-flex items-center gap-1 font-bold">
                                            <span className="text-slate-400">{t('tasks.actions.extraTimeRequest', 'Ek süre iste')}</span>
                                            {latestExtraTimeApproval.decision === 'Approved' && (
                                              <span className="text-emerald-600">({t('tasks.actions.extraTimeApprovedShort', 'onay')})</span>
                                            )}
                                            {latestExtraTimeApproval.decision === 'Rejected' && (
                                              <span className="text-red-600">({t('tasks.actions.extraTimeRejectedShort', 'red')})</span>
                                            )}
                                          </span>
                                        )}
                                        {label === 'Son Tarih' && canReviewExtraTime && extraTimeReview?.taskId !== taskDetail.taskId && (
                                          <button
                                            type="button"
                                            className="font-bold text-amber-500 underline-offset-2 hover:text-amber-600 hover:underline"
                                            onClick={openExtraTimeReview}
                                          >
                                            {t('tasks.actions.viewExtraTimeRequest', 'Ek süre talebini gör')}
                                          </button>
                                        )}
                                      </span>
                                      {label === 'Son Tarih' && dueDateEdit?.taskId === taskDetail.taskId ? (
                                        // Takvim yukarı yönde açılır; tetikleyici alan gizli, "Ek Süre İste"deki seç
                                        // akışıyla aynı: tarih seçilince (Seç) onay kutusu çıkar, Kaydet ile uygulanır (card 611).
                                        <div className="mt-1 flex flex-col gap-1.5">
                                          <DateTimePicker
                                            value={dueDateEdit.value}
                                            onChange={value => setDueDateEdit(current => current ? { ...current, value, mode: 'confirm' } : current)}
                                            placeholder={t('jobs.form.dueDate', 'Bitiş Tarihi')}
                                            className={dueDateEdit.mode === 'picking' ? 'h-0 overflow-visible [&>button:first-of-type]:sr-only [&>button:nth-of-type(2)]:hidden' : 'hidden'}
                                            forceUp
                                            autoOpen
                                            // Seçim yapmadan takvim kapatılırsa düzenlemeyi sıfırla; "Değiştir" yeniden tıklanabilir kalsın (card 615).
                                            onClose={dueDateEdit.mode === 'picking' ? closeDueDateEdit : undefined}
                                          />
                                          {dueDateEdit.mode === 'confirm' && (
                                            <div className="flex max-w-[18rem] flex-col gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                                              <span className="text-xs font-semibold text-slate-900">
                                                {dueDateEdit.value
                                                  ? formatDateTime(new Date(dueDateEdit.value).toISOString(), locale)
                                                  : t('common.none')}
                                              </span>
                                              <div className="inline-actions justify-start gap-1.5">
                                                <Button type="button" size="sm" variant="success" disabled={dueDateEdit.saving} onClick={() => void handleDueDateSave()}>
                                                  {dueDateEdit.saving ? t('common.loading') : t('common.save', 'Kaydet')}
                                                </Button>
                                                <Button type="button" size="sm" variant="secondary" disabled={dueDateEdit.saving} onClick={closeDueDateEdit}>
                                                  {t('common.cancel', 'Vazgeç')}
                                                </Button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ) : label === 'Son Tarih' && extraTimeEdit?.taskId === taskDetail.taskId ? (
                                        <div className="mt-1 flex flex-col gap-1.5">
                                          <DateTimePicker
                                            value={extraTimeEdit.value}
                                            onChange={value => setExtraTimeEdit(current => current ? { ...current, value, mode: 'confirm' } : current)}
                                            placeholder={t('jobs.form.dueDate', 'Bitiş Tarihi')}
                                            className={extraTimeEdit.mode === 'picking' ? 'h-0 overflow-visible [&>button:first-of-type]:sr-only [&>button:nth-of-type(2)]:hidden' : 'hidden'}
                                            forceUp
                                            autoOpen
                                            // Seçim yapmadan takvim kapatılırsa düzenlemeyi sıfırla; "Ek süre iste" yeniden tıklanabilir kalsın (card 615).
                                            onClose={extraTimeEdit.mode === 'picking' ? closeExtraTimeEdit : undefined}
                                          />
                                          {extraTimeEdit.mode === 'confirm' && (
                                            <div className="flex max-w-[18rem] flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                                              <span className="text-xs font-semibold text-slate-900">
                                                {formatDateTime(new Date(extraTimeEdit.value).toISOString(), locale)}
                                              </span>
                                              <div className="inline-actions justify-start gap-1.5">
                                                <Button type="button" size="sm" variant="success" disabled={extraTimeEdit.saving || !extraTimeEdit.value} onClick={() => void handleExtraTimeRequest()}>
                                                  {extraTimeEdit.saving ? t('common.loading') : t('tasks.actions.extraTimeRequest', 'Ek süre iste')}
                                                </Button>
                                                <Button type="button" size="sm" variant="secondary" disabled={extraTimeEdit.saving} onClick={closeExtraTimeEdit}>
                                                  {t('common.cancel', 'Vazgeç')}
                                                </Button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      ) : label === 'Son Tarih' && extraTimeReview?.taskId === taskDetail.taskId ? (
                                        <div className="mt-1 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                                          <span className="text-sm font-semibold text-slate-900">
                                            {extraTimeReview.proposedDueDateUtc
                                              ? formatDateTime(extraTimeReview.proposedDueDateUtc, locale)
                                              : t('tasks.actions.extraTimeDateUnavailable', 'Talep edilen tarih okunamadı.')}
                                          </span>
                                          <div className="inline-actions justify-start gap-2">
                                            <Button type="button" size="sm" variant="success" disabled={extraTimeReview.saving || !extraTimeReview.proposedDueDateUtc} onClick={() => void handleExtraTimeApprove()}>
                                              {extraTimeReview.saving ? t('common.loading') : t('common.approve', 'Onayla')}
                                            </Button>
                                            <Button type="button" size="sm" variant="destructive" disabled={extraTimeReview.saving} onClick={() => void handleExtraTimeReject()}>
                                              {t('common.reject', 'Reddet')}
                                            </Button>
                                            <Button type="button" size="sm" variant="secondary" disabled={extraTimeReview.saving} onClick={closeExtraTimeReview}>
                                              {t('common.cancel', 'Vazgeç')}
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-slate-900">
                                          {value}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {(() => {
                                const isCompletedTaskDetail = taskDetail.currentStatus === 'Completed'
                                const showTaskAttachmentsInDetail = isCompletedTaskDetail
                                  && taskDetail.jobSourceType !== 'Routine'
                                  && (taskDetail.attachments?.length ?? 0) > 0
                                // Durum Değişikliği Geçmişi: "Durum Değiştir" ile değiştirilmiş görevlerde Açıklama'nın sağında sütun (card #2).
                                const statusChangeHistory = taskDetail.statusChangeHistory ?? []
                                const showStatusChangeHistory = taskDetail.jobSourceType !== 'Routine' && statusChangeHistory.length > 0
                                const showAssignmentHistory = taskDetail.jobSourceType !== 'Routine' && visibleAssignmentHistory.length > 0
                                const rightPanelColumnCount = 1
                                  + (showAssignmentHistory ? 1 : 0)
                                  + (showStatusChangeHistory ? 1 : 0)
                                  + (showTaskAttachmentsInDetail ? 1 : 0)
                                const renderAssignmentHistoryColumn = (className = '') => (
                                  <div className={`flex min-w-0 flex-col border-t border-slate-200 lg:border-l lg:border-t-0${className}`}>
                                    <div className="border-b border-slate-200 px-4 py-2">
                                      <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500 xl:text-xs">
                                        {t('tasks.detail.taskAssignmentHistory', 'Görev Atama Geçmişi')}
                                      </span>
                                    </div>
                                    <ul className="flex-1 space-y-2 px-4 py-3 text-sm text-slate-700">
                                      {visibleAssignmentHistory.map(item => (
                                        <li key={item.assignmentId} className="flex gap-2">
                                          <span className="shrink-0 text-slate-500" aria-hidden>•</span>
                                          <div className="min-w-0">
                                            <div className="font-bold text-slate-950">
                                              {getUserName(item.toUserId)}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                              {new Date(item.actionDateUtc).toLocaleString(locale)}
                                            </div>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )
                                const renderStatusChangeHistoryColumn = (className = '') => (
                                  <div className={`flex min-w-0 flex-col border-t border-slate-200 lg:border-l lg:border-t-0${className}`}>
                                    <div className="border-b border-slate-200 px-4 py-2">
                                      <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-slate-500 xl:text-xs">
                                        {t('tasks.detail.statusChangeHistory', 'Durum Değişikliği Geçmişi')}
                                      </span>
                                    </div>
                                    <ul className="flex-1 space-y-2 px-4 py-3 text-sm text-slate-700">
                                      {statusChangeHistory.map((item, idx) => (
                                        <li key={`${item.changedAtUtc}-${idx}`} className="flex gap-2">
                                          <span className="shrink-0 text-slate-500" aria-hidden>•</span>
                                          <div className="min-w-0">
                                            {/* Yalnızca durum ve tarih bilgisi gösterilir (card #1095). */}
                                            <div className="font-bold text-slate-950">
                                              {getTaskStatusLabel(t, item.toStatus)}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                              {new Date(item.changedAtUtc).toLocaleString(locale)}
                                            </div>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )
                                const rightPanelGridClass = rightPanelColumnCount === 4
                                  ? ' grid lg:grid-cols-[minmax(7.5rem,0.8fr)_minmax(10.5rem,1fr)_minmax(13.25rem,1.25fr)_minmax(7rem,0.75fr)] lg:items-stretch'
                                  : rightPanelColumnCount === 3
                                    ? ' grid lg:grid-cols-[minmax(8.5rem,0.85fr)_minmax(11.5rem,1.05fr)_minmax(14.5rem,1.3fr)] lg:items-stretch'
                                    : rightPanelColumnCount === 2
                                      ? ' grid lg:grid-cols-2 lg:items-stretch'
                                      : ''
                                return (
                              <div className={`border-t border-slate-200 bg-white lg:border-l lg:border-t-0${rightPanelGridClass}`}>
                                <div className="min-w-0">
                                  <div className="border-b border-slate-200 px-4 py-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      {t('tasks.detail.description', 'Açıklama')}
                                    </span>
                                  </div>
                                  <div className="px-4 py-3">
                                    <RichTextContent
                                      value={resolveTaskDescription(taskDetail, parentJobDetail)}
                                      emptyText={t('tasks.detail.noDescription', 'Açıklama yok')}
                                      className="rich-text-content text-sm leading-6 text-slate-900"
                                    />
                                  </div>
                                </div>
                                {showAssignmentHistory ? renderAssignmentHistoryColumn() : null}
                                {showStatusChangeHistory ? renderStatusChangeHistoryColumn() : null}
                                {showTaskAttachmentsInDetail ? (
                                  <div className="min-w-0 border-t border-slate-200 lg:border-l lg:border-t-0">
                                    <div className="border-b border-slate-200 px-4 py-2">
                                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        {t('tasks.detail.attachments', 'Görev Ekleri')}
                                      </span>
                                    </div>
                                    <div className="px-4 py-3">
                                      <AttachmentSection
                                        attachments={taskDetail.attachments!}
                                        readOnly
                                        compact
                                        displayMode="list"
                                        onDownload={handleDownloadTaskAttachment}
                                      />
                                      <p className="mt-2 text-xs font-medium text-orange-500">{t('attachments.taskLockedCompleted', 'Görev tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')}</p>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Rutin görevlerde 2. satır: Adres Bilgileri + Ekler / Fotoğraflar (card 575) */}
                  {taskDetail.jobSourceType === 'Routine' && (() => {
                    const isCompleted = taskDetail.currentStatus === 'Completed'
                    return (
                      <section className="mb-5 grid gap-4 lg:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                            {t('address.detailSectionTitle', 'Adres Bilgileri')}
                          </h3>
                          <AddressDetailFields
                            neighborhood={parentJobDetail?.neighborhood}
                            street={parentJobDetail?.street}
                            openAddress={parentJobDetail?.openAddress}
                          />
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                            {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
                          </h3>
                          <AttachmentSection
                            attachments={taskDetail.attachments ?? []}
                            readOnly
                            compact
                            emptyText={t('attachments.routineEmpty', 'Rutin Görev için ek/fotoğraf bulunmamaktadır.')}
                          />
                          {isCompleted && (
                            <p className="mt-2 text-xs font-medium text-amber-600">
                              {t('attachments.routineLocked', 'Rutin görev tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')}
                            </p>
                          )}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                          <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                            {t('tasks.detail.routineEditHistoryTitle', 'Rutin Görev Düzenleme Geçmişi')}
                          </h3>
                          {routineEditHistory.length === 0 ? (
                            <p className="text-sm text-slate-400">{t('tasks.detail.routineEditHistoryEmpty', 'Düzenleme geçmişi bulunmuyor.')}</p>
                          ) : (
                            <Button type="button" variant="secondary" className="w-full" onClick={() => setRoutineEditHistoryModalOpen(true)}>
                              {t('tasks.detail.showRoutineEdits', 'Düzenlemeleri Göster')}
                            </Button>
                          )}
                        </div>
                      </section>
                    )
                  })()}

                  {/* İlgili Talep Detayları — Görev Detayları kutusunun hemen altında etiketli özet (card 388).
                      Rutin görevlerde talep olmadığı için bu bölüm gösterilmez (card 395). */}
                  {parentJobDetail && taskDetail.jobSourceType !== 'Routine' && (() => {
                    const ownerJobDepartment = parentJobDetail.departments.find(
                      dept => dept.departmentId === parentJobDetail.ownerDepartmentId,
                    )
                    const isCrossDepartmentRequest =
                      taskDetail.assignedDepartmentId != null &&
                      taskDetail.assignedDepartmentId !== parentJobDetail.ownerDepartmentId
                    // Talebi gerçekleştiren (görevin atandığı/hedef) birim — onay tarihi için (card #703).
                    const fulfillingJobDepartment = parentJobDetail.departments.find(
                      dept => dept.departmentId === taskDetail.assignedDepartmentId,
                    )
                    const parentForwardReason = fulfillingJobDepartment?.notes?.trim() || null
                    const isCitizenParentJob = isCitizenRequestJob(parentJobDetail)
                    const leftFields = isCitizenParentJob ? [
                      {
                        label: 'Vatandaş Talep No',
                        value: (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span>{formatCitizenRequestNumber(citizenSourceMessage ?? { createdAtUtc: parentJobDetail.createdAtUtc }, locale)}</span>
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
                        value: [parentJobDetail.citizenName ?? citizenSourceMessage?.citizenHandle, formatCitizenPhoneDisplay(parentJobDetail.citizenPhone ?? citizenSourceMessage?.citizenPhone)]
                          .filter(Boolean)
                          .join(' / ') || '—',
                      },
                      { label: 'Talep Başlığı', value: parentJobDetail.title },
                      {
                        label: 'Talep Yeri / Oluşturan',
                        value: [parentJobDetail.ownerDepartmentName, parentJobDetail.createdByDisplayName].filter(Boolean).join(' / ') || '—',
                      },
                      ...(shouldShowRequestApproverField(parentJobDetail) ? [{
                        label: t('jobs.detail.requestApprover', 'Talebi Onaylayan'),
                        value: formatRequestApproverDisplay(parentJobDetail) ?? '—',
                      }] : []),
                      {
                        label: 'Talebin Gittiği Birim',
                        value: formatJobDestinationsWithAssignees(parentJobDetail),
                      },
                      { label: 'Öncelik', value: getPriorityLabel(t, parentJobDetail.priority) },
                    ] : [
                      {
                        label: 'Talep No',
                        value: (
                          <RequestNumberWithTypeLabel
                            job={parentJobDetail}
                            t={t}
                            locale={locale}
                          />
                        ),
                      },
                      { label: 'Talep Başlığı', value: parentJobDetail.title },
                      {
                        label: 'Talep Yeri / Oluşturan',
                        value: [parentJobDetail.ownerDepartmentName, parentJobDetail.createdByDisplayName].filter(Boolean).join(' / ') || '—',
                      },
                      ...(shouldShowRequestApproverField(parentJobDetail) ? [{
                        label: t('jobs.detail.requestApprover', 'Talebi Onaylayan'),
                        value: formatRequestApproverDisplay(parentJobDetail) ?? '—',
                      }] : []),
                      {
                        label: 'Proje mi',
                        value: <JobProjectValue job={parentJobDetail} t={t} />,
                      },
                      { label: 'Öncelik', value: getPriorityLabel(t, parentJobDetail.priority) },
                      ...(parentForwardReason ? [{
                        label: t('jobs.forward.reasonLabel', 'Talebin Yönlenme Sebebi'),
                        value: parentForwardReason,
                      }] : []),
                    ]
                    const rightFields = [
                      { label: 'Talep Tarihi', value: formatDateTime(parentJobDetail.createdAtUtc, locale) },
                      ...(!isCitizenParentJob && !isManagerLike && user?.role !== 'Reporter' ? [{
                        // Hem birim-içi hem birim-dışı talepte aynı etiket kullanılır (card #706).
                        label: 'Talebin Birim Yöneticisinin Onay Tarihi',
                        value: formatApprovalDateText(
                          formatDateTime(ownerJobDepartment?.decidedAtUtc ?? null, locale),
                          ownerJobDepartment?.approvedByDisplayName,
                        ),
                      }] : []),
                      ...(isCitizenParentJob
                        ? (shouldShowCitizenTargetApprovalDate(parentJobDetail) ? [{
                            label: 'Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi',
                            value: formatApprovalDateText(
                              formatDateTime(fulfillingJobDepartment?.decidedAtUtc ?? null, locale),
                              fulfillingJobDepartment?.approvedByDisplayName,
                            ),
                          }] : [])
                        : isCrossDepartmentRequest
                          ? [{
                              label: 'Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi',
                              value: formatApprovalDateText(
                                formatDateTime(fulfillingJobDepartment?.decidedAtUtc ?? null, locale),
                                fulfillingJobDepartment?.approvedByDisplayName,
                              ),
                            }]
                          : []),
                      { label: 'Son Tarih', value: formatDueDateTime(parentJobDetail.dueDateUtc, locale) },
                    ]
                    const isCompletedTask = taskDetail.currentStatus === 'Completed'
                    return (
                      <section className="form-card page-stack mb-5">
                        <div className="text-sm font-semibold text-emerald-600">
                          {t('tasks.detail.parentJobTitle', 'İlgili Talep Detayları')}
                        </div>
                        <div className={`grid gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${isCompletedTask ? 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)]' : isCitizenParentJob ? 'lg:grid-cols-[44%_20%_36%]' : 'lg:grid-cols-[44%_20%_18%_18%]'}`}>
                          <div className="min-w-0 divide-y divide-slate-100">
                            {leftFields.map(({ label, value }) => (
                              // Sol kolon orta kolondan kısa olunca son satır "Öncelik"in altına
                              // kapanış çizgisi (card #694; #712/#713 ile aynı yaklaşım).
                              <div key={label} className={`flex items-start gap-2 px-3 py-2${label === 'Öncelik' || label === t('jobs.forward.reasonLabel', 'Talebin Yönlenme Sebebi') ? ' border-b border-slate-100' : ''}`}>
                                <span className="w-28 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
                                <span className={`min-w-0 break-words text-sm ${typeof value === 'string' ? 'text-slate-900' : ''}`}>{value}</span>
                              </div>
                            ))}
                          </div>
                          <div className="border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                            <div className="divide-y divide-slate-100">
                              {rightFields.map(({ label, value }) => (
                                // Başlık satırın tamamını kaplar, tarih verisi alt satırda (dikey) —
                                // JobsPage "Talep Detayları" stiliyle aynı (card #707). Son Tarih'te
                                // kapanış çizgisi (card #712/#713).
                                <div key={label} className={`flex flex-col gap-0.5 px-4 py-2${label === 'Son Tarih' ? ' border-b border-slate-100' : ''}`}>
                                  <span className="text-xs font-semibold text-slate-500">{label}</span>
                                  <span className="break-words text-sm text-slate-900">{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {!isCompletedTask ? (
                            <>
                              {!isCitizenParentJob ? (
                              <div className="border-t border-slate-200 bg-white p-3 lg:border-l lg:border-t-0">
                                <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {t('jobs.managerNote.title', 'Yönetici Notu')}
                                </div>
                                {parentJobDetail.managerNote ? (
                                  <p className="whitespace-pre-wrap text-sm text-slate-800">{parentJobDetail.managerNote}</p>
                                ) : (
                                  <p className="text-sm text-slate-400">{t('jobs.managerNote.empty', 'Talep için yönetici notu bulunmamaktadır.')}</p>
                                )}
                              </div>
                              ) : null}
                              {/* 4. sütun: Ekler / Fotoğraflar — talep oluşturulurken eklenen dosyalar, salt-okunur (card 519/527) */}
                              <div className="border-t border-slate-200 bg-white p-3 lg:border-l lg:border-t-0">
                                <div className="mb-1.5 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {t('attachments.sectionTitle', 'Ekler / Fotoğraflar')}
                                </div>
                                <AttachmentSection
                                  attachments={parentJobDetail.attachments}
                                  readOnly
                                  compact
                                  emptyText={t('attachments.requestEmpty', 'Talep için ek/fotoğraf bulunmamaktadır.')}
                                />
                              </div>
                            </>
                          ) : null}
                        </div>
                        {/* Tamamlanmış görevlerde talep özeti altında Adres / Yönetici Notu / Ekler satırı (JobsPage ile aynı). */}
                        {isCompletedTask ? (
                          <div className={`mt-4 grid gap-4 ${isCitizenParentJob ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
                            <section className="rounded-xl border border-slate-200 bg-white p-4">
                              <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                                {t('address.detailSectionTitle', 'Adres Bilgileri')}
                              </h3>
                              <AddressDetailFields
                                neighborhood={parentJobDetail.neighborhood}
                                street={parentJobDetail.street}
                                openAddress={parentJobDetail.openAddress}
                              />
                            </section>
                            {!isCitizenParentJob ? (
                            <section className="rounded-xl border border-slate-200 bg-white p-4">
                              <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">
                                {t('jobs.managerNote.title', 'Yönetici Notu')}
                              </h3>
                              {parentJobDetail.managerNote ? (
                                <p className="whitespace-pre-wrap text-sm text-slate-800">{parentJobDetail.managerNote}</p>
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
                                attachments={parentJobDetail.attachments ?? []}
                                readOnly
                                emptyText={t('attachments.requestEmpty', 'Talep için ek/fotoğraf bulunmamaktadır.')}
                              />
                              <p className="mt-2 text-xs font-medium text-amber-600">
                                {t('attachments.lockedCompletedRequest', 'Talep tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')}
                              </p>
                            </section>
                          </div>
                        ) : null}
                      </section>
                    )
                  })()}

                </>
              ) : null}
            </div>
          </section>
        </div>,
        document.body
      )}

      {routineEditHistoryModalOpen && createPortal(
        <ModalBackdrop className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4">
          <section
            className="flex max-h-[min(85dvh,52rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <h2 className="text-base font-bold text-slate-900">
                {t('tasks.detail.routineEditHistoryTitle', 'Rutin Görev Düzenleme Geçmişi')}
              </h2>
              <button
                type="button"
                className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label={t('common.close', 'Kapat')}
                onClick={() => setRoutineEditHistoryModalOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {routineEditHistory.map((entry, index) => {
                const afterSnapshot = index === 0 && taskDetail
                  ? buildRoutineSnapshotFromTaskDetail(taskDetail, parentJobDetail)
                  : routineEditHistory[index - 1]!.snapshot
                const changes = getRoutineEditFieldChanges(entry.snapshot, afterSnapshot)
                const attachmentsChanged = changes.some(change => change.fieldKey === 'attachments')
                const fieldChanges = changes.filter(change => change.fieldKey !== 'attachments')

                return (
                  <div key={entry.auditLogId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 text-sm font-bold text-slate-800">
                      {formatDateTime(entry.editedAtUtc, locale)}
                      {entry.editedByDisplayName ? ` · ${entry.editedByDisplayName}` : ''}
                    </div>
                    {fieldChanges.length === 0 && !attachmentsChanged ? (
                      <p className="text-sm text-slate-500">{t('tasks.detail.routineEditHistoryEmpty', 'Düzenleme geçmişi bulunmuyor.')}</p>
                    ) : (
                      <dl className="space-y-3 text-sm">
                        {fieldChanges.map(change => (
                          <div key={`${entry.auditLogId}-${change.fieldKey}`}>
                            <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {routineEditFieldLabel(change.fieldKey)}
                            </dt>
                            <dd className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="mb-1 text-[11px] font-semibold text-slate-400">{t('tasks.detail.routineEditBefore', 'Önceki')}</div>
                                <div className="break-words text-slate-900">{formatRoutineEditChangeValue(change.fieldKey, change.before)}</div>
                              </div>
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                                <div className="mb-1 text-[11px] font-semibold text-emerald-700">{t('tasks.detail.routineEditAfter', 'Sonraki')}</div>
                                <div className="break-words text-slate-900">{formatRoutineEditChangeValue(change.fieldKey, change.after)}</div>
                              </div>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {attachmentsChanged ? (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="mb-2 text-xs font-semibold text-slate-500">{t('tasks.detail.routineEditBefore', 'Önceki')}</div>
                          <AttachmentSection
                            attachments={snapshotAttachmentsToAttachmentList(entry.snapshot.attachments)}
                            readOnly
                            compact
                            emptyText={t('attachments.routineEmpty', 'Rutin Görev için ek/fotoğraf bulunmamaktadır.')}
                          />
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                          <div className="mb-2 text-xs font-semibold text-emerald-700">{t('tasks.detail.routineEditAfter', 'Sonraki')}</div>
                          <AttachmentSection
                            attachments={snapshotAttachmentsToAttachmentList(afterSnapshot.attachments)}
                            readOnly
                            compact
                            emptyText={t('attachments.routineEmpty', 'Rutin Görev için ek/fotoğraf bulunmamaktadır.')}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>
        </ModalBackdrop>,
        document.body
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
        <section className="section-card desktop-page-fill">
          <div className={`table-wrap desktop-panel-scroll${isDepartmentTasksView || isStaffTasksView ? ' w-full' : ''}`}>
            <table className={`data-table jobs-table data-table--zebra${isMyTasksView ? ' my-tasks-table' : ''}${isDepartmentTasksView ? ' department-tasks-table' : ''}${isStaffTasksView ? ' staff-tasks-table' : ''}${isMyTasksAllView ? ' my-tasks-all-table' : ''}${hasTerminalDateColumn ? ' my-tasks-table--terminal-view' : ''}`}>
              {(isMyTasksView || isDepartmentTasksView || isStaffTasksView) && (
                <colgroup>
                  <col className="my-tasks-row-number-col" />
                  <col className="my-tasks-parent-request-col grid-col-request-no" />
                  <col className="grid-col-task-no" />
                  <col className="grid-col-date" />
                  <col className="my-tasks-location-col" />
                  <col className="my-tasks-title-col grid-col-title" />
                  {(isStaffTasksView || isMyTasksView || isDepartmentTasksView) && <col className="my-tasks-type-col" />}
                  {!hideDueDateColumn && <col className="my-tasks-due-col" />}
                  {(isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'completed' && <col className="task-grid-terminal-date-col" />}
                  {(isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'rejected' && <col className="task-grid-terminal-date-col" />}
                  {showStatusColumn && <col className="my-tasks-status-col" />}
                  <col className="my-tasks-actions-col" />
                </colgroup>
              )}
              <thead>
                <tr>
                  <th className="w-10 text-center">{t('common.rowNo', 'Sıra')}</th>
                  <FilterableTh filterKey="jobNumber" filterValue={taskFilters['jobNumber'] ?? ''} onFilter={setTaskFilter} sortKey="jobNumber" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>
                    <span className="inline-flex flex-col leading-tight">
                      <span>{t('tasks.columns.parentRequestLinked', 'Bağlı Olduğu')}</span>
                      <span>{t('tasks.columns.parentRequestNoShort', 'Talep No')}</span>
                    </span>
                  </FilterableTh>
                  <FilterableTh filterKey="taskNumber" filterValue={taskFilters['taskNumber'] ?? ''} onFilter={setTaskFilter} sortKey="taskNumber" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.taskNo', 'Görev No')}</FilterableTh>
                  <FilterableTh filterKey="createdAtUtc" filterValue={taskFilters['createdAtUtc']} onFilter={setTaskFilter} sortKey="createdAtUtc" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.taskDate', 'Görev Tarihi')}</FilterableTh>
                  <FilterableTh filterKey="ownerDepartmentName" filterValue={taskFilters['ownerDepartmentName']} onFilter={setTaskFilter} sortKey="ownerDepartmentName" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>
                    <span className="inline-flex flex-col leading-tight">
                      <span>{t('tasks.columns.ownerDepartment', 'Görevin Talep Yeri')}</span>
                      <span>{t('tasks.columns.creator', 'Oluşturan')}</span>
                    </span>
                  </FilterableTh>
                  <FilterableTh filterKey="title" filterValue={taskFilters['title']} onFilter={setTaskFilter} sortKey="title" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.title', 'Başlık')}</FilterableTh>
                  {(isStaffTasksView || isMyTasksView || isDepartmentTasksView) && (
                    <FilterableTh filterKey="jobSourceType" filterValue={taskFilters['jobSourceType'] ?? ''} onFilter={setTaskFilter} sortKey="taskTypeCategory" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort} className="pl-10">
                      <span className="inline-flex flex-col gap-0.5 leading-tight">
                        <span>{t('tasks.columns.taskType', 'Görev Tipi')}</span>
                        <span>{t('tasks.columns.owner', 'Görevi Yapan')}</span>
                      </span>
                    </FilterableTh>
                  )}
                  {!hideDueDateColumn && <FilterableTh filterKey="dueDateUtc" filterValue={taskFilters['dueDateUtc']} onFilter={setTaskFilter} sortKey="dueDateUtc" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.dueDate', 'Son Tarih')}</FilterableTh>}
                  {(isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'completed' && <FilterableTh filterKey="completedAtUtc" filterValue={taskFilters['completedAtUtc'] ?? ''} onFilter={setTaskFilter} sortKey="completedAtUtc" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.completedAt', 'Tamamlanma Tarihi')}</FilterableTh>}
                  {(isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'rejected' && <FilterableTh filterKey="updatedAtUtc" filterValue={taskFilters['updatedAtUtc'] ?? ''} onFilter={setTaskFilter} sortKey="updatedAtUtc" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.cancelledAt', 'İptal Tarihi')}</FilterableTh>}
                  {showStatusColumn && <FilterableTh filterKey="currentStatus" filterValue={taskFilters['currentStatus'] ?? ''} onFilter={setTaskFilter} sortKey="currentStatus" currentSortKey={tasksSortKey} sortDir={tasksSortDir} onSort={toggleTasksSort}>{t('tasks.columns.status', 'Durum')}</FilterableTh>}
                  <th>{t('tasks.columns.actions', 'İşlemler')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedTasks.length === 0 && (
                  <TableEmptyStateRows
                    columnCount={tasksTableColumnCount}
                    message={
                      isMyTasksView
                        ? t('tasks.myViews.empty', { view: currentMyTaskViewLabel, defaultValue: `${currentMyTaskViewLabel} bulunmuyor` })
                        : isDepartmentTasksView
                          ? t('tasks.departmentTasksEmpty', { view: currentDepartmentStatusViewLabel, defaultValue: `${currentDepartmentStatusViewLabel} bulunmuyor` })
                          : isStaffTasksView
                            ? t('tasks.staff.empty', { staff: currentStaffUserLabel, defaultValue: `${currentStaffUserLabel} için görev bulunmuyor` })
                            : t('tasks.empty', 'No tasks')
                    }
                  />
                )}
                {pagedTasks.map((task, index) => {
                  const showExtraTimeInGrid = isMyTasksView || isDepartmentTasksView || isStaffTasksView
                  const terminalExtraTimeTask = isTerminalTaskForExtraTimeDisplay(task.currentStatus)
                  const extraTimeMarkers = showExtraTimeInGrid
                    ? <TaskGridExtraTimeMarkers task={task} />
                    : null
                  const showExtraTimeUnderDue = showExtraTimeInGrid && !terminalExtraTimeTask
                  const showExtraTimeUnderCompleted = showExtraTimeInGrid
                    && task.currentStatus === 'Completed'
                    && (isMyTasksView || isDepartmentTasksView)
                    && currentMyTaskView === 'completed'
                  const showExtraTimeUnderCancelled = showExtraTimeInGrid
                    && (task.currentStatus === 'Cancelled' || task.currentStatus === 'Rejected')
                    && (isMyTasksView || isDepartmentTasksView)
                    && currentMyTaskView === 'rejected'
                  const showExtraTimeUnderStatus = showExtraTimeInGrid
                    && terminalExtraTimeTask
                    && currentMyTaskView === 'all'
                    && showStatusColumn
                  const isReporterTask = isReporterCreated(task.createdByRoleCode)
                  const linkedRequestNumber = formatTaskJobDisplayNumber(task, socialByJobId, locale)
                  const taskDisplayNumber = formatTaskDisplayNumber(task)
                  const reporterLinkedRequestClass = isReporterTask && hasConcreteNumberDisplay(linkedRequestNumber)
                    ? reporterGridValueClass(true)
                    : ''
                  const reporterTaskNumberClass = isReporterTask && hasConcreteNumberDisplay(taskDisplayNumber)
                    ? reporterGridValueClass(true)
                    : ''

                  return (
                  <tr key={task.taskId}>
                    <td className="text-center text-xs font-bold text-slate-400 tabular-nums">{(tasksPage - 1) * tasksPageSize + index + 1}</td>
                    <td className="table-number-cell text-xs text-slate-500">
                      {task.jobSourceType === 'Routine'
                        ? (
                          <>
                            <div className="table-number-cell__value font-sans text-slate-400">{t('tasks.columns.routineTaskLabel', 'Rutin Görev')}</div>
                            <div className="table-number-cell__priority font-sans text-slate-400">{t('tasks.columns.routineNoRequestNo', 'Talep No olmaz')}</div>
                          </>
                        )
                        : isCitizenRequestJob({ requestType: task.jobRequestType, sourceType: task.jobSourceType })
                          ? (
                            <div className="table-number-cell__value font-mono inline-flex flex-wrap items-center gap-1.5">
                              <ChannelIcon channel={getCitizenTaskChannel(task, socialByJobId)} className="size-4 shrink-0" />
                              <span className={reporterLinkedRequestClass}>{linkedRequestNumber}</span>
                              {task.forwardReason ? <span className="font-sans font-bold text-teal-800">({t('jobs.forward.badge', 'Yönlendirilen Talep')})</span> : null}
                            </div>
                          )
                          : (
                            <div className="table-number-cell__value font-mono inline-flex flex-wrap items-center gap-1.5">
                              <span className={reporterLinkedRequestClass}>{linkedRequestNumber}</span>
                              {task.forwardReason ? <span className="font-sans font-bold text-teal-800">({t('jobs.forward.badge', 'Yönlendirilen Talep')})</span> : null}
                            </div>
                          )}
                    </td>
                    <td className="table-number-cell font-mono text-xs text-slate-500">
                      <div className={`table-number-cell__value ${reporterTaskNumberClass}`}>{taskDisplayNumber}</div>
                      <div className={`table-number-cell__priority font-sans font-bold ${getPriorityColorClass(task.priority)}`}>(Öncelik:{getPriorityLabel(t, task.priority)})</div>
                    </td>
                    <td>
                      <DateCell value={task.createdAtUtc} locale={locale} highlight={isReporterTask && Boolean(task.createdAtUtc)} />
                      {/* Bugün atanan görevler için yanıp sönen yeşil "Yeni" rozeti (card 589).
                          Tamamlanmış/İptal/İade (kapanmış) görevlerde gösterilmez (card 606). */}
                      {isMyTasksView
                        && !['Completed', 'Cancelled', 'Rejected'].includes(task.currentStatus)
                        && isAssignedToday(task.assignedAtUtc) && (
                        <div className="task-new-badge">{t('tasks.badges.new', 'Yeni')}</div>
                      )}
                    </td>
                    {/* Talep eden müdürlük (üst) ve talebi oluşturan kullanıcı (alt), dar ve ortalı. */}
                    <td>
                      <div className="mx-auto max-w-[11rem]">
                        <ReporterDepartmentCell
                          departmentName={task.ownerDepartmentName}
                          creatorName={task.createdByDisplayName}
                          isReporter={isReporterCreated(task.createdByRoleCode)}
                          align="center"
                        />
                      </div>
                    </td>
                    <td><span className="cell-title">{task.title}</span></td>
                    {(isStaffTasksView || isMyTasksView || isDepartmentTasksView) && (
                      <td>
                        <div className="mx-auto max-w-[11rem] text-center">
                          <StatusPill tone={task.jobSourceType === 'Routine' ? 'neutral' : 'success'} className="text-[0.82rem]">
                            {task.jobSourceType === 'Routine' ? t('tasks.type.routine', 'Rutin') : t('tasks.type.assigned', 'Atanmış')}
                          </StatusPill>
                          <div className="mt-1 truncate text-xs text-slate-600">
                            {task.assignedUserDisplayName ?? task.ownerDisplayName ?? '—'}
                          </div>
                        </div>
                      </td>
                    )}
                    {!hideDueDateColumn && (
                      <td>
                        <DueDatePill value={task.dueDateUtc} completedAtUtc={task.completedAtUtc} locale={locale} highlightReporter={isReporterTask} />
                        {showExtraTimeUnderDue ? extraTimeMarkers : null}
                      </td>
                    )}
                    {(isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'completed' && (
                      <td>
                        <DateCell value={task.completedAtUtc ?? null} locale={locale} tone="success" />
                        {showExtraTimeUnderCompleted ? extraTimeMarkers : null}
                      </td>
                    )}
                    {(isMyTasksView || isDepartmentTasksView) && currentMyTaskView === 'rejected' && (
                      <td>
                        <DateCell value={task.updatedAtUtc ?? null} locale={locale} tone="danger" />
                        {showExtraTimeUnderCancelled ? extraTimeMarkers : null}
                      </td>
                    )}
                    {showStatusColumn && (() => {
                      // Tamamlanmış→tamamlanma, İptal→iptal tarihi; tarih durum pill'inin İÇİNDE
                      // alt satırda gösterilir (card #714, #711'in rafine hali).
                      const statusDate = task.currentStatus === 'Completed' ? task.completedAtUtc
                        : task.currentStatus === 'Cancelled' ? task.updatedAtUtc
                        : null
                      return (
                        <td>
                          <StatusPill className={`text-[0.82rem] ${getStatusPillClass(getTaskStatusTone(task))}`}>
                            {statusDate
                              ? <span className="flex flex-col items-center leading-tight">
                                  <span>{getTaskDisplayStatus(t, task)}</span>
                                  <span className={`text-[0.68rem] font-bold ${task.currentStatus === 'Completed' ? 'text-emerald-700' : 'text-red-700'}`}>{formatDateTime(statusDate, locale)}</span>
                                </span>
                              : getTaskDisplayStatus(t, task)}
                          </StatusPill>
                          {showExtraTimeUnderStatus ? extraTimeMarkers : null}
                        </td>
                      )
                    })()}
                    <td className="actions-cell">
                      <div className="request-actions">
                        {!showOnlyDetailsInTaskGridActions
                          && isDepartmentTasksView
                          && canManageDepartmentTaskActions(task)
                          && (currentMyTaskView === 'pending' || currentMyTaskView === 'overdue')
                          && (task.jobSourceType !== 'Routine' && isActionableTaskStatus(task.currentStatus) ? (
                            <Button
                              size="sm"
                              type="button"
                              className="bg-[#007985] text-white shadow-sm hover:bg-[#006570]"
                              onClick={() => openRouteModal(task.taskId)}
                            >
                              {t('tasks.actions.routeShort', 'Yönlendir')}
                            </Button>
                          ) : (
                            // Rutin/yönlendirilemeyen görevlerde de pasif "Yönlendir" — görsel bütünlük (card #729).
                            <DisabledActionButton size="sm" className="bg-[#007985] text-white" hoverTitle={t('tasks.actions.routeUnavailable', 'Bu görev yönlendirilemez')}>
                              {t('tasks.actions.routeShort', 'Yönlendir')}
                            </DisabledActionButton>
                          ))}
                        {!showOnlyDetailsInTaskGridActions && canChangeCompletedTaskStatus(task) && (
                          <Button
                            size="sm"
                            type="button"
                            className="bg-orange-500 text-white hover:bg-orange-600"
                            onClick={() => openStatusChangeModal(task)}
                          >
                            {t('tasks.actions.changeStatus', 'Durum Değiştir')}
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => void openTaskDetail(task)}>{t('tasks.actions.details', 'Detaylar')}</Button>
                        {!showOnlyDetailsInTaskGridActions && isMyTasksView && (canEditRoutineTask(task) ? (
                          <Button
                            size="sm"
                            className="inline-flex items-center gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
                            onClick={() => navigate(getRoutineTaskEditPath(task.taskId))}
                          >
                            <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                            {t('common.edit', 'Düzenle')}
                          </Button>
                        ) : (
                          <DisabledActionButton
                            size="sm"
                            className="button-placeholder inline-flex items-center gap-1.5 bg-teal-700 text-white"
                            hoverTitle={t('tasks.actions.editUnavailable', 'Bu görev düzenlenemez')}
                          >
                            <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                            {t('common.edit', 'Düzenle')}
                          </DisabledActionButton>
                        ))}
                        {!showOnlyDetailsInTaskGridActions && currentScope === 'department-pool' && !task.assignedUserId && (
                          <Button size="sm" onClick={() => handleClaim(task.taskId)}>{t('tasks.actions.claim', 'Claim')}</Button>
                        )}
                        {(() => {
                          if (showOnlyDetailsInTaskGridActions) return null
                          const canComplete = isMyTasksView && isAssignee(task) && isActionableTaskStatus(task.currentStatus)
                          if (canComplete) {
                            return <Button size="sm" variant="success" onClick={() => handleComplete(task)}>{t('tasks.actions.complete', 'Tamamla')}</Button>
                          }
                          if (isMyTasksView && currentMyTaskView === 'all') {
                            return <DisabledActionButton size="sm" variant="success" hoverTitle={t('tasks.actions.completeUnavailable', 'Bu görev şu an tamamlanamaz')}>{t('tasks.actions.complete', 'Tamamla')}</DisabledActionButton>
                          }
                          return null
                        })()}
                        {(() => {
                          if (showOnlyDetailsInTaskGridActions) return null
                          const canCancel = (isDepartmentTasksView && currentMyTaskView !== 'all' && isActionableTaskStatus(task.currentStatus))
                            || (isMyTasksView && isAssignee(task) && isActionableTaskStatus(task.currentStatus))
                          if (canCancel) {
                            return (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (task.createdByRoleCode === 'Reporter' && !isManagerLike) {
                                    setConfirmDialog({
                                      title: t('tasks.actions.cancelNotAllowed', 'İptal Yetkiniz Yok'),
                                      message: t('tasks.actions.cancelManagerTaskNotAllowed', 'Üst Düzey Yönetici\'den gelen talebin görevini iptal etme yetkiniz bulunmamaktadır. Görev iadesi için yöneticinizle iletişime geçiniz.'),
                                      onConfirm: () => setConfirmDialog(null),
                                      confirmLabel: t('common.ok', 'Tamam'),
                                      hideCancel: true
                                    })
                                  } else {
                                    openReturnModal(task.taskId)
                                  }
                                }}
                              >
                                {t('jobs.actions.cancel', 'İptal Et')}
                              </Button>
                            )
                          }
                          // Görsel bütünlük: Görevlerim "Tüm Görevler"de iptal edilemeyen satırlarda pasif İptal Et (card 545).
                          // Birimdeki Görevler "Tüm Görevler"de İptal Et hiç gösterilmez (card #1103 reopened).
                          if (isMyTasksView && currentMyTaskView === 'all') {
                            return <DisabledActionButton size="sm" variant="destructive" hoverTitle={t('tasks.actions.cancelUnavailable', 'Bu görev şu an iptal edilemez')}>{t('jobs.actions.cancel', 'İptal Et')}</DisabledActionButton>
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
            totalCount={columnFilteredTasks.length}
            pageSize={tasksPageSize}
            currentPage={tasksPage}
            onPageSizeChange={setTasksPageSize}
            onPageChange={setTasksPage}
          />
        </section>
      )}

      {completeModal && (
        <ModalBackdrop>
          <div className="form-card page-stack relative w-full max-w-md">
            <button
              type="button"
              onClick={closeCompleteModal}
              aria-label={t('common.close', 'Kapat')}
              className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <X className="size-4" />
            </button>
            <h2 className="border-b border-slate-200 pb-2 text-xl font-extrabold text-slate-950">{t('tasks.actions.completeTitle', 'Görevi Tamamla')}</h2>
            <p className="helper-copy text-left" style={{ fontSize: '0.85rem' }}>
              <span className="font-semibold text-orange-500">{completeModal.displayNumber}</span>
              {' '}
              {t('tasks.actions.completeHelpRequired', 'Görevi tamamlamak için tamamlama notu giriniz.')}
            </p>
            <label className="job-field">
              <span className="job-field-label">{t('tasks.actions.completionNote', 'Tamamlama Notu')} <span className="text-red-500">*</span></span>
              <textarea
                className="field-textarea"
                rows={3}
                value={completionNote}
                onChange={e => setCompletionNote(e.target.value)}
                placeholder={t('tasks.actions.completionNotePlaceholder', 'Tamamlama hakkında not ekleyin...')}
                autoFocus
              />
            </label>
            {pendingCompletionAttachments.length > 0 ? (
              <ul className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                {pendingCompletionAttachments.map(item => {
                  const Icon = completionAttachmentIcon(item.fileName)
                  return (
                  <li key={item.attachmentId} className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700">
                      <Icon className="size-3" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 break-words text-left text-[10px] font-normal text-slate-700">{item.fileName}</span>
                    <button
                      type="button"
                      className="shrink-0 text-[11px] font-medium text-red-500 hover:text-red-600"
                      disabled={completeSaving || completionAttachmentUploading}
                      onClick={() => {
                        void api.deleteAttachment(item.attachmentId).then(() => {
                          setPendingCompletionAttachments(current => current.filter(entry => entry.attachmentId !== item.attachmentId))
                        }).catch(err => {
                          setCompletionAttachmentError(err instanceof Error ? err.message : t('common.error'))
                        })
                      }}
                    >
                      {t('common.delete', 'Sil')}
                    </button>
                  </li>
                  )
                })}
              </ul>
            ) : null}
            {completionAttachmentError ? (
              <p className="text-xs font-medium text-red-600">{completionAttachmentError}</p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className={`inline-flex h-8 cursor-pointer items-center justify-center gap-0.5 rounded-lg bg-white px-2 text-xs font-semibold text-slate-800 ring-1 ring-[var(--color-border)] transition-colors hover:bg-slate-50 ${completeSaving || completionAttachmentUploading ? 'pointer-events-none opacity-60' : ''}`}>
                <Paperclip className="size-3.5" />
                {t('attachments.addFile', 'Dosya ekle')}
                <input
                  ref={completeFileInputRef}
                  type="file"
                  accept={COMPLETION_ATTACHMENT_ACCEPT}
                  multiple
                  className="hidden"
                  disabled={completeSaving || completionAttachmentUploading}
                  onChange={event => void handleCompletionFilesSelected(event.target.files)}
                />
              </label>
              <div className="inline-actions justify-end">
                <Button type="button" variant="secondary" onClick={closeCompleteModal} disabled={completeSaving || completionAttachmentUploading}>
                  {t('common.dismiss', 'Vazgeç')}
                </Button>
                <Button type="button" variant="success" disabled={completeSaving || completionAttachmentUploading || !completionNote.trim()} onClick={() => void handleCompleteConfirm()}>
                  {completeSaving ? t('common.loading') : t('tasks.actions.complete', 'Tamamla')}
                </Button>
              </div>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {returnModal && (
        <ModalBackdrop>
          <div className="form-card page-stack relative w-full max-w-md">
            {/* Sağ üstte kapatma (X) ikonu. */}
            <button
              type="button"
              onClick={closeReturnModal}
              aria-label={t('common.close', 'Kapat')}
              className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <X className="size-4" />
            </button>

            {returnModal.step === 'cancel' && (
              <>
                <h2 className="text-xl font-extrabold text-slate-950">{t('tasks.actions.cancelTask', 'Görevi İptal Et')}</h2>
                <p className="helper-copy" style={{ fontSize: '0.85rem' }}>{t('tasks.actions.cancelHelp', 'Görevi iptal etmek için neden belirtiniz.')}</p>
                <label className="job-field">
                  <span className="job-field-label">{t('tasks.actions.cancelReason', 'İptal Nedeni')}</span>
                  <textarea
                    className="field-textarea"
                    rows={3}
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder={t('tasks.actions.cancelReasonPlaceholder', 'İptal nedenini açıklayınız...')}
                    autoFocus
                  />
                </label>
                <div className="inline-actions justify-end">
                  <Button type="button" variant="secondary" onClick={closeReturnModal}>
                    {t('common.dismiss', 'Vazgeç')}
                  </Button>
                  <Button type="button" variant="destructive" disabled={returnSaving || !cancelReason.trim()} onClick={() => void handleCancelTask()}>
                    {returnSaving ? t('common.loading') : t('tasks.actions.cancelTask', 'Görevi İptal Et')}
                  </Button>
                </div>
              </>
            )}

            {/* ── Görev Yönlendir (Manager) ── */}
            {returnModal.step === 'return' && (
              <>
                <h2 className="mb-1 border-b border-slate-200 pb-2 text-base font-semibold text-slate-950">
                  {t('tasks.actions.redirectReporterTaskWithinUnit', 'Görevi Birim İçi Yönlendir')}
                </h2>
                <p className="helper-copy" style={{ fontSize: '0.85rem' }}>{t('tasks.actions.returnUnitHelp', 'Görev sadece aynı birim içinde yönlendirilebilir.')}</p>
                <div className="job-field">
                  <span className="job-field-label">{t('tasks.department', 'Birim')}</span>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    {departments.find(d => d.departmentId === returnModal.assignedDepartmentId)?.name ?? '—'}
                  </div>
                </div>
                <label className="job-field">
                  <span className="job-field-label">{t('tasks.draftUser', 'Kullanıcı (isteğe bağlı)')}</span>
                  <select className="field-select" value={returnUserId} onChange={e => setReturnUserId(e.target.value)}>
                    <option value="" disabled hidden>
                      {t('tasks.userSelection', 'Personel seçiniz')}
                    </option>
                    {returnDeptUsers.map(u => (
                      <option key={u.userId} value={u.userId}>{u.displayName}</option>
                    ))}
                  </select>
                </label>
                <div className="inline-actions justify-end">
                  <Button type="button" variant="secondary" onClick={closeReturnModal}>
                    {t('common.exit', 'Çıkış')}
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    disabled={returnSaving || !returnDeptId}
                    onClick={() => void handleReturn()}
                  >
                    {returnSaving ? t('common.loading') : t('tasks.actions.route', 'Görevi Yönlendir')}
                  </Button>
                </div>
              </>
            )}

          </div>
        </ModalBackdrop>
      )}

      {statusChangeModal && (
        <ModalBackdrop>
          <div className="form-card page-stack relative w-full max-w-md">
            <button
              type="button"
              onClick={closeStatusChangeModal}
              aria-label={t('common.close', 'Kapat')}
              className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <X className="size-4" />
            </button>
            <h2 className="mb-1 border-b border-slate-200 pb-1.5 text-base font-semibold text-slate-950">
              {t('tasks.actions.changeStatusTitle', 'Görev Durum Değişikliği')}
            </h2>
            <p className="helper-copy -mt-0.5 mb-2" style={{ fontSize: '0.85rem' }}>
              <span className="font-semibold text-orange-500">{statusChangeModal.displayNumber}</span>{' '}
              {t('tasks.actions.changeStatusHelp', 'Görev durumunu değiştirmek için neden belirtiniz.')}
            </p>
            <label className="job-field">
              <span className="job-field-label">{t('tasks.actions.changeStatusReason', 'Neden')} <span className="text-red-500">*</span></span>
              <textarea
                className="field-textarea"
                rows={3}
                value={statusChangeReason}
                onChange={e => setStatusChangeReason(e.target.value)}
                placeholder={t('tasks.actions.changeStatusReasonPlaceholder', 'Durum değişikliği nedenini açıklayınız...')}
                autoFocus
              />
            </label>
            <label className="job-field">
              <span className="job-field-label">{t('tasks.actions.changeStatusSelect', 'Görev Durumu Seç')}</span>
              <select className="field-select" value={statusChangeTarget} onChange={e => setStatusChangeTarget(e.target.value)}>
                <option value="" disabled hidden>{t('tasks.actions.changeStatusPlaceholder', 'Görev durumu seçiniz')}</option>
                {STATUS_CHANGE_OPTIONS.filter(o => o.value !== statusChangeModal.currentStatus).map(o => (
                  <option key={o.value} value={o.value}>{t(o.labelKey, o.fallback)}</option>
                ))}
              </select>
            </label>
            <div className="inline-actions justify-end">
              <Button type="button" variant="secondary" onClick={closeStatusChangeModal}>
                {t('common.dismiss', 'Vazgeç')}
              </Button>
              <Button type="button" className="bg-orange-500 text-white hover:bg-orange-600" disabled={statusChangeSaving || !statusChangeReason.trim() || !statusChangeTarget} onClick={() => void handleStatusChangeConfirm()}>
                {statusChangeSaving ? t('common.loading') : t('tasks.actions.changeStatus', 'Durum Değiştir')}
              </Button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
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
