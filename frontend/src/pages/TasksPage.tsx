import { ArrowRight, CheckCheck, FileText, History, Info, ListChecks, MapPin, MessageSquareText, Paperclip, Printer, Route, Search, PenLine, X, XCircle } from 'lucide-react'
import { DueDatePill } from '../components/ui/due-date-pill'
import { GridExtraTimeMarkers } from '../components/ui/extra-time-markers'
import { DateCell } from '../components/ui/date-cell'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'
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
import { SimpleImageAttachmentIcon } from '../components/ui/SimpleImageAttachmentIcon'
import { AddressDetailFields } from '../components/ui/AddressDetailFields'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../data/izmir-locations'
import { stringListSelectOptions } from '../utils/formDropdownOptions'
import { ADDRESS_OPEN_ADDRESS_MAX_LENGTH, ADDRESS_STREET_MAX_LENGTH } from '../utils/addressLimits'
import { DetailModalHeaderBrand } from '../components/branding/DetailModalHeaderBrand'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { DisabledActionButton } from '../components/ui/DisabledActionButton'
import { RichTextContent } from '../components/ui/RichTextContent'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { Toast } from '../components/ui/toast'
import { StatusPill } from '../components/ui/status-pill'
import { GridStatusLabel } from '../components/ui/GridStatusLabel'
import { useAuth } from '../context/AuthContext'
import type { AssignmentHistory, Department, JobDetail, SocialMessage, Task, TaskDetail, TaskListScope, User } from '../types/platform'
import { getLocale, getPriorityColorClass, getPriorityLabel, getStatusPillClass, getTaskStatusTone, getTaskDisplayStatus, formatOverdueInProgressStatus } from '../utils/localization'
import { TablePagination } from '../components/ui/table-pagination'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { DetailModalTitle } from '../utils/detailModalTitle'
import { printHtmlDocument } from '../utils/printDocument'
import { richTextToPlainText } from '../utils/richText'
import { toDateTimePickerValue } from '../utils/dateTimePicker'
import { formatJobDisplayNumberText } from '../utils/requestNumberText'
import { lowercaseFileExtension } from '../utils/fileNameDisplay'

const COMPLETION_ATTACHMENT_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']
const COMPLETION_ATTACHMENT_ACCEPT = COMPLETION_ATTACHMENT_EXTENSIONS.join(',')
const COMPLETION_ATTACHMENT_MAX_SIZE = 5 * 1024 * 1024

function completionAttachmentExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function completionAttachmentIcon(name: string) {
  return ['.jpg', '.jpeg', '.png'].includes(completionAttachmentExtension(name)) ? SimpleImageAttachmentIcon : FileText
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
import { formatJobDestinationsWithAssignees, formatRequestApproverDisplay, getJobTargetApproverDisplayName, shouldShowRequestApproverField } from '../utils/jobDetails'
import { ModalBackdrop } from '../components/ui/modal-backdrop'
import { parseRoutineTaskEditHistory, getRoutineEditFieldChanges, snapshotAttachmentsToAttachmentList, buildRoutineSnapshotFromTaskDetail, type RoutineTaskEditHistoryEntry } from '../utils/routineTaskEditHistory'
import { isDepartmentStaffUser, userWorksInAnyDepartment } from '../utils/userDepartments'
import { ChannelIcon } from '../components/ui/channel-icon'
import { WhatsAppConversationModal } from '../components/WhatsAppConversationModal'
import { MyRequestSectionHeading } from '../components/jobs/my-request-detail/MyRequestSectionHeading'
import { MyRequestDetailMainCard, MyRequestInfoFieldsList } from '../components/jobs/my-request-detail/MyRequestDetailMainCard'
import { MyRequestDetailBottomCards } from '../components/jobs/my-request-detail/MyRequestDetailBottomCards'
import { buildMyRequestDetailFields } from '../components/jobs/my-request-detail/myRequestDetailFields'
import { StackedFieldValue } from '../components/jobs/my-request-detail/StackedFieldValue'
import { JobProcessTimeline } from '../components/jobs/my-request-detail/JobProcessTimeline'
import type { JobProcessStep } from '../components/jobs/my-request-detail/buildJobProcessSteps'
import { StatusChangeTransition } from '../components/jobs/my-request-detail/StatusChangeTransition'
import { normalizeTitleCaseField } from '../utils/textNormalization'

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
      <ScopeChipDateRange from={filterFrom} to={filterTo} onFromChange={onFromChange} onToChange={onToChange} forceDown />
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
    ['Talep Yapılan Birim', formatJobDestinationsWithAssignees(parentJob)],
    ['Öncelik', getPriorityLabel(t, parentJob.priority)],
    ['Durum', getCitizenRequestStatusLabel(t, parentJob)],
    ['Talep Tarihi', fd(parentJob.createdAtUtc)],
    ...(shouldShowCitizenTargetApprovalDate(parentJob)
      ? [['Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi', formatApprovalDateText(formatDueDateTime(targetApproval?.decidedAtUtc, locale), getJobTargetApproverDisplayName(parentJob))]]
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
    ['Talebin Birim Yöneticisinin Onay Tarihi', formatApprovalDateText(formatDueDateTime(ownerApproval?.decidedAtUtc, locale), ownerApproval?.approvedByDisplayName)],
    ...(shouldShowCitizenTargetApprovalDate(parentJob)
      ? [['Talebi Gerçekleştiren Birim Yöneticisinin Onay Tarihi', formatApprovalDateText(formatDueDateTime(targetApproval?.decidedAtUtc, locale), getJobTargetApproverDisplayName(parentJob))]]
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
      blink
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
  // Son Tarihi Geçmiş: turuncu (card #1701) — mavi in-progress ile karışmasın.
  if (value === 'overdue') return 'scope-chip--overdue'
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
  // Kendine atayan yönetici, talebi ayrı sayfaya yönlenmeden aynı popup içinde düzenler (card #1476 reopen).
  const [editJobModal, setEditJobModal] = useState<{
    jobId: string
    title: string
    description: string
    priority: string
    startDateUtc: string
    dueDateUtc: string
  } | null>(null)
  const [editJobSaving, setEditJobSaving] = useState(false)
  // Rutin görev düzenlemede Mahalle seçimi için (card #1489).
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(getNeighborhoodsForDistrict(getSavedDistrictId())), [])
  // Rutin görev de ayrı sayfaya (Rutin Görev Düzenle) gitmeden aynı popup içinde düzenlenir (card #1494 reopen).
  const [editRoutineTaskModal, setEditRoutineTaskModal] = useState<{
    taskId: string
    title: string
    description: string
    priority: string
    dueDateUtc: string
    neighborhood: string | null
    street: string | null
    openAddress: string | null
  } | null>(null)
  const [editRoutineTaskSaving, setEditRoutineTaskSaving] = useState(false)
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

  /** Tamamla/İptal onay popup'ı kapandıktan sonra açık detay popup'ını son duruma çeker (card #1656). */
  const refreshOpenTaskDetailAfterAction = async (taskId: string) => {
    const detailIsOpen = selectedTask?.taskId === taskId || taskDetail?.taskId === taskId
    if (!detailIsOpen) {
      await reload()
      return
    }
    const jobId = taskDetail?.jobId ?? selectedTask?.jobId ?? null
    const [updatedDetail, updatedList, parentJob] = await Promise.all([
      api.getTaskById(taskId),
      api.getTasks(currentScope),
      jobId ? api.getJobById(jobId).catch(() => null) : Promise.resolve(null),
    ])
    setTaskDetail(updatedDetail)
    setSelectedTask(current => {
      if (!current || current.taskId !== taskId) return current
      return {
        ...current,
        ...updatedDetail,
        ownerDepartmentName: current.ownerDepartmentName,
        jobNumber: current.jobNumber,
        jobNumberYear: current.jobNumberYear,
      } as Task
    })
    if (parentJob) setParentJobDetail(parentJob)
    setTasks(updatedList)
  }

  const handleCompleteConfirm = async () => {
    if (!completeModal || !completionNote.trim()) return
    const completedTaskId = completeModal.taskId
    setCompleteSaving(true)
    try {
      await api.completeTask(completedTaskId, completionNote.trim())
      setPendingCompletionAttachments([])
      invalidateTasks(queryClient, completedTaskId, selectedTask?.jobId ?? taskDetail?.jobId)
      setCompleteModal(null)
      setCompletionNote('')
      setCompletionAttachmentError(null)
      // Arka plandaki detay popup açık kalsın ama son duruma çekilsin (card #1656).
      await refreshOpenTaskDetailAfterAction(completedTaskId)
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
    const cancelledTaskId = returnModal.taskId
    setReturnSaving(true)
    try {
      await api.cancelTask(cancelledTaskId, cancelReason.trim())
      invalidateTasks(queryClient, cancelledTaskId, selectedTask?.jobId ?? taskDetail?.jobId)
      closeReturnModal()
      // İptal onay popup'ı kapandıktan sonra detay popup alanlarını yenile (card #1656).
      await refreshOpenTaskDetailAfterAction(cancelledTaskId)
      showToast(t('tasks.actions.cancelSuccess', 'Görev iptal edildi.'))
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
  // Atanmış görevler normalde düzenlenemez; birim yöneticisi talebi oluşturup görevi kendine
  // atadıysa (AssigningManagerId == kendisi) kendi talebini düzenleyebilir (card #1471).
  const canEditSelfAssignedManagerTask = (task: Pick<Task, 'jobSourceType' | 'assignedUserId' | 'currentStatus' | 'assigningManagerDisplayName'>) =>
    task.jobSourceType !== 'Routine'
    && task.assignedUserId === user?.userId
    && isActionableTaskStatus(task.currentStatus)
    && isManagerLike
    && Boolean(task.assigningManagerDisplayName)
    && task.assigningManagerDisplayName === user?.displayName
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
  const openRoutineTaskEdit = async (taskId: string) => {
    const detail = await api.getTaskById(taskId).catch(() => null)
    if (!detail) return
    const job = await api.getJobById(detail.jobId).catch(() => null)
    // Düzenleme modu Son Tarih alanını devralır; yarım kalmış "Değiştir"/"Ek süre" mini
    // akışları temizlenmezse Vazgeç sonrası eski onay kutusu yanlışlıkla yeniden görünür.
    setDueDateEdit(null)
    setExtraTimeEdit(null)
    setExtraTimeReview(null)
    setEditRoutineTaskModal({
      taskId,
      title: detail.title,
      description: detail.description,
      priority: detail.priority,
      dueDateUtc: toDateTimePickerValue(detail.dueDateUtc),
      neighborhood: job?.neighborhood ?? null,
      street: job?.street ?? null,
      openAddress: job?.openAddress ?? null,
    })
  }
  const handleSaveEditRoutineTask = async () => {
    if (!editRoutineTaskModal) return
    setEditRoutineTaskSaving(true)
    try {
      const updated = await api.updateRoutineTask(editRoutineTaskModal.taskId, {
        title: editRoutineTaskModal.title,
        description: editRoutineTaskModal.description,
        priority: editRoutineTaskModal.priority,
        dueDateUtc: editRoutineTaskModal.dueDateUtc ? new Date(editRoutineTaskModal.dueDateUtc).toISOString() : null,
        notes: null,
        neighborhood: editRoutineTaskModal.neighborhood,
        street: editRoutineTaskModal.street,
        openAddress: editRoutineTaskModal.openAddress,
      })
      invalidateTasks(queryClient, updated.taskId, updated.jobId)
      if (selectedTask?.taskId === editRoutineTaskModal.taskId) {
        const refreshedDetail = await api.getTaskById(editRoutineTaskModal.taskId).catch(() => null)
        if (refreshedDetail) setTaskDetail(refreshedDetail)
      }
      // Adres Bilgileri Job üzerinde tutuluyor; kaydettikten sonra salt-okunur görünüm
      // (parentJobDetail) yenilenmezse eski adres gösterilmeye devam ederdi (review bulgusu).
      if (parentJobDetail?.jobId === updated.jobId) {
        const refreshedJob = await api.getJobById(updated.jobId).catch(() => null)
        if (refreshedJob) setParentJobDetail(refreshedJob)
      }
      setEditRoutineTaskModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setEditRoutineTaskSaving(false)
    }
  }
  // Kendine atayan yönetici talebi ayrı sayfaya gitmeden aynı popup içinde düzenler (card #1476 reopen).
  const openEditJobModal = (job: JobDetail) => {
    setDueDateEdit(null)
    setExtraTimeEdit(null)
    setExtraTimeReview(null)
    setEditJobModal({
      jobId: job.jobId,
      title: job.title,
      description: job.description ?? '',
      priority: job.priority,
      startDateUtc: toDateTimePickerValue(job.startDateUtc),
      dueDateUtc: toDateTimePickerValue(job.dueDateUtc),
    })
  }
  const openEditJobModalById = async (jobId: string) => {
    const job = await api.getJobById(jobId).catch(() => null)
    if (job) openEditJobModal(job)
  }
  const handleSaveEditJob = async () => {
    if (!editJobModal) return
    setEditJobSaving(true)
    try {
      await api.updateJob(editJobModal.jobId, {
        title: editJobModal.title,
        description: editJobModal.description,
        priority: editJobModal.priority,
        startDateUtc: editJobModal.startDateUtc ? new Date(editJobModal.startDateUtc).toISOString() : null,
        dueDateUtc: editJobModal.dueDateUtc ? new Date(editJobModal.dueDateUtc).toISOString() : null,
      })
      invalidateTasks(queryClient, selectedTask?.taskId, editJobModal.jobId)
      const refreshedJob = await api.getJobById(editJobModal.jobId).catch(() => null)
      if (refreshedJob) setParentJobDetail(refreshedJob)
      setEditJobModal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setEditJobSaving(false)
    }
  }
  // Kendine atayan yönetici talebini düzenlerken İlgili Talep Detayları'ndaki Ekler/Fotoğraflar
  // artık düzenlenebilir (card #1519).
  const handleParentJobAttachmentUpload = async (file: File, onProgress?: (percent: number) => void) => {
    if (!parentJobDetail) return
    const uploadedForJobId = parentJobDetail.jobId
    const attachment = await api.uploadJobAttachment(uploadedForJobId, file, onProgress)
    setParentJobDetail(current => current && current.jobId === uploadedForJobId
      ? { ...current, attachments: [...(current.attachments ?? []), attachment] }
      : current)
  }
  const handleParentJobAttachmentDelete = async (attachmentId: string) => {
    await api.deleteAttachment(attachmentId)
    setParentJobDetail(current => current ? { ...current, attachments: (current.attachments ?? []).filter(item => item.attachmentId !== attachmentId) } : current)
  }
  // Rutin görevi düzenlerken Ekler/Fotoğraflar artık düzenlenebilir (card #1519).
  const handleRoutineTaskAttachmentUpload = async (file: File, onProgress?: (percent: number) => void) => {
    if (!editRoutineTaskModal) return
    const attachment = await api.uploadTaskAttachment(editRoutineTaskModal.taskId, file, onProgress)
    setTaskDetail(current => current && current.taskId === editRoutineTaskModal.taskId
      ? { ...current, attachments: [...(current.attachments ?? []), attachment] }
      : current)
  }
  const handleRoutineTaskAttachmentDelete = async (attachmentId: string) => {
    await api.deleteAttachment(attachmentId)
    setTaskDetail(current => current
      ? { ...current, attachments: (current.attachments ?? []).filter(item => item.attachmentId !== attachmentId) }
      : current)
  }
  const getUserName = (userId?: string | null) => users.find(item => item.userId === userId)?.displayName ?? '—'
  // Görev/Rutin görev düzenleme artık ayrı bir forma geçmeden, Taleplerim detay popup'ındaki
  // gibi AYNI Görev Detayları düzeni içinde satır satır editable hale geliyor (card #1500).
  const activeTaskEditDraft = editJobModal ?? editRoutineTaskModal
  const isEditingTaskDetail = Boolean(activeTaskEditDraft)
  const isSavingTaskEdit = editJobSaving || editRoutineTaskSaving
  const updateActiveTaskEditDraft = (patch: Partial<{ title: string; description: string; priority: string; dueDateUtc: string }>) => {
    if (editJobModal) setEditJobModal(m => m && ({ ...m, ...patch }))
    else if (editRoutineTaskModal) setEditRoutineTaskModal(m => m && ({ ...m, ...patch }))
  }
  // Rutin görev düzenlemede Adres Bilgileri de düzenlenebilir (card #1489); editJobModal'da
  // bu alanlar yok, bu yüzden updateActiveTaskEditDraft'tan ayrı tutulur.
  const updateRoutineTaskAddressDraft = (patch: Partial<{ neighborhood: string | null; street: string | null; openAddress: string | null }>) => {
    setEditRoutineTaskModal(m => m && ({ ...m, ...patch }))
  }
  const handleSaveActiveTaskEdit = () => {
    if (editJobModal) void handleSaveEditJob()
    else if (editRoutineTaskModal) void handleSaveEditRoutineTask()
  }
  const handleCancelActiveTaskEdit = () => {
    setEditJobModal(null)
    setEditRoutineTaskModal(null)
    setDueDateEdit(null)
    setExtraTimeEdit(null)
    setExtraTimeReview(null)
  }
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
    setEditJobModal(null)
    setEditRoutineTaskModal(null)
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
    setEditJobModal(null)
    setEditRoutineTaskModal(null)
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
    setEditJobModal(null)
    setEditRoutineTaskModal(null)
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
      case 'attachments': return t('attachments.taskSectionTitle', 'Görev Ekleri')
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
            className="detail-modal-shell detail-modal-shell--my-request flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Sabit başlık — Taleplerim detay popup'ı ile birebir aynı tasarım dili (my-request-detail-header). */}
            <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-6 py-3">
              <div className="detail-modal-header-title min-w-0">
                <div className="my-request-detail-header__title">
                  <DetailModalTitle title={detailScopeLabel} />
                </div>
              </div>
              <DetailModalHeaderBrand />
              <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center justify-end gap-2">
                {parentJobDetail
                  && isCitizenRequestJob(parentJobDetail)
                  && canShowCitizenWhatsAppConversation(parentJobDetail, citizenSourceMessage) && (
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
                {isEditingTaskDetail ? (
                  <>
                    <Button type="button" size="lg" variant="success" disabled={isSavingTaskEdit} onClick={handleSaveActiveTaskEdit}>
                      {isSavingTaskEdit ? t('common.saving', 'Kaydediliyor...') : t('common.save', 'Kaydet')}
                    </Button>
                    <Button type="button" size="lg" variant="secondary" disabled={isSavingTaskEdit} onClick={handleCancelActiveTaskEdit}>
                      {t('common.cancel', 'Vazgeç')}
                    </Button>
                  </>
                ) : (
                  <>
                    {showRouteTaskDetailAction && selectedTask && (canRouteTaskDetail ? (
                      <Button
                        type="button"
                        size="lg"
                        className="inline-flex items-center gap-1.5 bg-[#007985] text-white shadow-sm hover:bg-[#006570]"
                        onClick={() => openRouteModal(selectedTask.taskId)}
                      >
                        <Route className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t('tasks.actions.route', 'Görevi Yönlendir')}
                      </Button>
                    ) : (
                      <DisabledActionButton
                        size="lg"
                        className="inline-flex items-center gap-1.5 bg-[#007985] text-white"
                        hoverTitle={t('tasks.actions.routeUnavailable', 'Bu görev yönlendirilemez')}
                      >
                        <Route className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t('tasks.actions.route', 'Görevi Yönlendir')}
                      </DisabledActionButton>
                    ))}
                    {isMyTasksView && selectedTask && canChangeTaskStatusFromDetail(selectedTask) && (
                      (taskDetail?.statusChangeHistory?.length ?? 0) > 0 ? (
                        <DisabledActionButton
                          size="lg"
                          className="bg-orange-500 text-white"
                          hoverTitle={t('tasks.actions.changeStatusUsed', 'Görevin durumu yalnızca bir kez değiştirilebilir')}
                        >
                          {t('tasks.actions.changeStatus', 'Durum Değiştir')}
                        </DisabledActionButton>
                      ) : (
                        <Button
                          type="button"
                          size="lg"
                          className="bg-orange-500 text-white hover:bg-orange-600"
                          onClick={() => openStatusChangeModal(selectedTask)}
                        >
                          {t('tasks.actions.changeStatus', 'Durum Değiştir')}
                        </Button>
                      )
                    )}
                    {isMyTasksView && selectedTask
                      && (!canChangeTaskStatusFromDetail(selectedTask) || currentMyTaskView === 'completed' || currentMyTaskView === 'rejected')
                      && (canEditRoutineTask(selectedTask) ? (
                      <Button
                        type="button"
                        size="lg"
                        className="inline-flex items-center gap-1.5 bg-[#007985] text-white hover:bg-[#006570]"
                        onClick={() => void openRoutineTaskEdit(selectedTask.taskId)}
                      >
                        <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t('common.edit', 'Düzenle')}
                      </Button>
                    ) : taskDetail && canEditSelfAssignedManagerTask(taskDetail) && parentJobDetail ? (
                      <Button
                        type="button"
                        size="lg"
                        className="inline-flex items-center gap-1.5 bg-[#007985] text-white hover:bg-[#006570]"
                        onClick={() => openEditJobModal(parentJobDetail)}
                      >
                        <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t('common.edit', 'Düzenle')}
                      </Button>
                    ) : selectedTask.jobSourceType === 'Routine' ? (
                      <DisabledActionButton
                        size="lg"
                        className="inline-flex items-center gap-1.5 bg-[#007985] text-white"
                        hoverTitle={t('tasks.actions.editUnavailable', 'Bu görev düzenlenemez')}
                      >
                        <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t('common.edit', 'Düzenle')}
                      </DisabledActionButton>
                    ) : null)}
                    {isMyTasksView && canCompleteTask && (
                      <Button type="button" size="lg" variant="success" className="inline-flex items-center gap-1.5" onClick={() => selectedTask && handleComplete(selectedTask)}>
                        <CheckCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t('tasks.actions.complete', 'Tamamla')}
                      </Button>
                    )}
                    {isMyTasksView && canCompleteTask && (
                      <Button type="button" size="lg" variant="destructive" className="inline-flex items-center gap-1.5" onClick={() => openReturnModal(taskDetail.taskId)}>
                        <XCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                        {t('tasks.actions.cancelTask', 'Görevi İptal Et')}
                      </Button>
                    )}
                    {taskDetail
                      && isDepartmentTasksView
                      && currentMyTaskView !== 'all'
                      && canManageDepartmentTaskActions(taskDetail)
                      && isActionableTaskStatus(taskDetail.currentStatus) && (
                        <Button type="button" size="lg" variant="destructive" className="inline-flex items-center gap-1.5" onClick={() => openReturnModal(taskDetail.taskId)}>
                          <XCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                          {t('tasks.actions.cancelTask', 'Görevi İptal Et')}
                        </Button>
                    )}
                  </>
                )}
                {taskDetail && (
                  <Button
                    type="button"
                    size="lg"
                    variant="ghost"
                    className="detail-print-action inline-flex items-center gap-1.5 text-slate-700 hover:bg-slate-100"
                    onClick={() => printTaskDetail(taskDetail, selectedTask, parentJobDetail, citizenSourceMessage, t, locale)}
                    aria-label={t('common.print', 'Yazdır')}
                  >
                    <Printer className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    {t('common.print', 'Yazdır')}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={closeTaskDetail}
                  className="detail-modal-header-close flex size-9 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
                  aria-label={t('common.close', 'Kapat')}
                >
                  <X className="size-5" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* Kaydırılabilir içerik alanı */}
            <div className="flex-1 overflow-y-auto p-6">
              {detailLoading ? (
                <div className="loading">{t('common.loading')}</div>
              ) : taskDetail ? (
                <>
                  {/* Görev bilgi kutusu — Taleplerim detay popup'ı ile birebir aynı tasarım dili:
                      solda başlık + açıklama, ortada Görev Bilgileri, sağda Süreç timeline'ı
                      (MyRequestDetailMainCard düzeni). */}
                  <section className="my-request-detail-main form-card page-stack mb-5">
                    {/* Sol menüdeki "Görevlerim" ikonuyla aynı (ListChecks) — card #1429. */}
                    <MyRequestSectionHeading icon={ListChecks} tone="primary">
                      {t('tasks.detail.title', 'Görev Detayları')}
                    </MyRequestSectionHeading>
                    <div className="my-request-detail-main__grid overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
                      <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                        <MyRequestSectionHeading icon={FileText} className="my-request-title-heading">
                          <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                            <span className={`min-w-0 overflow-hidden${isReporterCreated(selectedTask?.createdByRoleCode) ? ' text-[#f97316]' : ''}`}>
                              {activeTaskEditDraft ? (
                                <textarea
                                  className="field-textarea my-request-title-heading-edit__textarea font-semibold"
                                  value={activeTaskEditDraft.title}
                                  maxLength={50}
                                  rows={Math.min(3, Math.max(1, Math.ceil((activeTaskEditDraft.title.length || 1) / 28)))}
                                  onChange={e => updateActiveTaskEditDraft({ title: e.target.value })}
                                  required
                                />
                              ) : (
                                normalizeTitleCaseField(taskDetail.title)
                              )}
                            </span>
                            <span className="ml-auto flex shrink-0 max-w-full flex-col items-end justify-center gap-1 text-right">
                              <span className="max-w-full break-words text-xs font-semibold leading-tight text-slate-500">{formatTaskDisplayNumber(selectedTask)}</span>
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold leading-tight text-orange-600">
                                {taskDetail.jobSourceType === 'Routine' ? t('tasks.type.routine', 'Rutin') : t('tasks.type.assigned', 'Atanmış')}
                              </span>
                            </span>
                          </span>
                        </MyRequestSectionHeading>
                        {activeTaskEditDraft ? (
                          <RichTextEditor
                            value={activeTaskEditDraft.description}
                            onChange={value => updateActiveTaskEditDraft({ description: value })}
                            minHeight="min-h-40"
                          />
                        ) : (
                          <RichTextContent
                            value={resolveTaskDescription(taskDetail, parentJobDetail)}
                            emptyText={t('tasks.detail.noDescription', 'Açıklama yok')}
                            className="rich-text-content mt-1.5 text-xs leading-5 text-slate-900"
                          />
                        )}
                      </div>
                      <div className="min-w-0 border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                        <MyRequestSectionHeading icon={Info} className="job-detail-card-title--spread">
                          <span className="grid min-w-0 w-full flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                            <span className="min-w-0">{t('tasks.detail.infoFields', 'Görev Bilgileri')}</span>
                            {parentJobDetail ? (
                              <span className="ml-auto flex flex-col items-end text-right text-[11px] leading-tight">
                                <span className="font-semibold text-slate-500">{t('jobs.columns.priority', 'Öncelik')}</span>
                                <span className={`font-bold ${parentJobDetail.priority === 'Normal' ? 'text-emerald-700' : getPriorityColorClass(parentJobDetail.priority)}`}>
                                  {getPriorityLabel(t, parentJobDetail.priority)}
                                </span>
                              </span>
                            ) : null}
                          </span>
                        </MyRequestSectionHeading>
                        <div className="my-request-detail-fields divide-y divide-slate-100">
                          {[
                            ...(taskDetail.jobSourceType !== 'Routine'
                              ? [{
                                  label: 'Talep Yeri / Oluşturan',
                                  value: <StackedFieldValue top={selectedTask.ownerDepartmentName} bottom={selectedTask.createdByDisplayName} />,
                                }]
                              : []),
                            // Atayan yönetici üstte, görevi yapan hemen altında kalır (card #1613).
                            ...(taskDetail.jobSourceType !== 'Routine'
                              ? [{
                                  label: (
                                    <>
                                      {t('tasks.detail.assigningManager', 'Görevi Atayan Yönetici')}
                                      {parentJobDetail?.managerNote?.trim() ? (
                                        <span className="ml-1 whitespace-nowrap font-semibold text-emerald-600">
                                          (
                                          <button
                                            type="button"
                                            className="underline underline-offset-2 hover:text-emerald-700"
                                            onClick={() => setConfirmDialog({
                                              title: t('jobs.managerNote.title', 'Yönetici Notu'),
                                              titleDivider: true,
                                              titleTone: 'success',
                                              message: parentJobDetail.managerNote!,
                                              hideCancel: true,
                                              variant: 'success',
                                              confirmLabel: t('common.close', 'Kapat'),
                                              onConfirm: () => {},
                                            })}
                                          >
                                            {t('jobs.managerNote.title', 'Yönetici Notu')}
                                          </button>
                                          )
                                        </span>
                                      ) : null}
                                    </>
                                  ),
                                  value: taskDetail.assigningManagerDisplayName ?? '—',
                                }]
                              : []),
                            // Görev yönlendirilince sahibi artık güncel atanan kullanıcıdır;
                            // assignedUser önce, yoksa owner (card #719).
                            // Üst düzey (Reporter) talepten atanmış görevde Görevi Yapan turuncu (card #1648).
                            {
                              label: t('tasks.columns.owner', 'Görevi Yapan'),
                              value: (
                                <span className={isReporterCreated(selectedTask?.createdByRoleCode) ? 'font-semibold text-[#f97316]' : undefined}>
                                  {taskDetail.assignedUserDisplayName ?? taskDetail.ownerDisplayName ?? '—'}
                                </span>
                              ),
                            },
                            // Yönlendirme varsa: Durum Değişikliği ile aynı geçiş özeti; ayrı kart değil (card #1746).
                            ...(taskDetail.jobSourceType !== 'Routine' && visibleAssignmentHistory.length > 0
                              ? [{
                                  label: t('tasks.detail.taskAssignmentHistory', 'Görev Atama Geçmişi'),
                                  value: (() => {
                                    const latest = visibleAssignmentHistory[0]
                                    const first = visibleAssignmentHistory[visibleAssignmentHistory.length - 1]
                                    return (
                                      <div className="task-process-status-change__transition">
                                        <div className="task-process-status-change__side">
                                          <div className="task-process-status-change__status text-slate-900">
                                            {getUserName(first.toUserId)}
                                          </div>
                                          <div className="task-process-status-change__date">
                                            {formatDateTime(first.actionDateUtc, locale)}
                                          </div>
                                        </div>
                                        <ArrowRight className="task-process-status-change__arrow" aria-hidden="true" />
                                        <div className="task-process-status-change__side">
                                          <div className="task-process-status-change__status text-slate-900">
                                            {getUserName(latest.toUserId)}
                                          </div>
                                          <div className="task-process-status-change__date">
                                            {formatDateTime(latest.actionDateUtc, locale)}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })(),
                                }]
                              : []),
                            ...(() => {
                              const statusChangeWithReason = (taskDetail.statusChangeHistory ?? []).find(item => item.reason?.trim())
                              return statusChangeWithReason
                                ? [{
                                    label: t('tasks.detail.statusChangeReason', 'Durum Değişikliği Nedeni'),
                                    value: statusChangeWithReason.reason!.trim(),
                                  }]
                                : []
                            })(),
                            ...(taskDetail.currentStatus === 'Completed'
                              ? [{
                                  label: t('tasks.actions.completionNote', 'Tamamlama Notu'),
                                  value: richTextToPlainText(taskDetail.notes ?? '') || '—',
                                  tone: 'completion' as const,
                                }]
                              : taskDetail.currentStatus === 'Cancelled' || taskDetail.currentStatus === 'Rejected'
                                ? [{
                                    label: t('tasks.detail.cancelNote', 'İptal Notu'),
                                    value: taskDetail.revisionReason?.trim() || '—',
                                    tone: 'cancel' as const,
                                  }]
                                : []),
                            // Görev Ekleri artık ayrı bir kart değil, Durum Değişikliği'nin hemen
                            // altında diğer verilerle aynı hizada tek satır (card #1482); sadece
                            // görev Tamamlandı/İptal Edildi olduğunda gösterilir (card #1520).
                            ...(taskDetail.jobSourceType !== 'Routine'
                              && (taskDetail.currentStatus === 'Completed' || taskDetail.currentStatus === 'Cancelled')
                              ? [{
                                  label: t('tasks.detail.attachments', 'Görev Ekleri'),
                                  // Dosya adı mavi; liste iki satırı aşarsa kendi içinde kayar (card #1617).
                                  value: (taskDetail.attachments?.length ?? 0) === 0 ? '—' : (
                                    <div className="flex max-h-11 flex-col items-end gap-1 overflow-y-auto pr-0.5 [scrollbar-gutter:stable]">
                                      {taskDetail.attachments!.map(attachment => {
                                        const AttachmentIcon = completionAttachmentIcon(attachment.fileName)
                                        return (
                                          <button
                                            key={attachment.attachmentId}
                                            type="button"
                                            className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:text-blue-700"
                                            onClick={() => void handleDownloadTaskAttachment(attachment.attachmentId, attachment.fileName)}
                                          >
                                            <AttachmentIcon className="size-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                                            <span className="truncate">{lowercaseFileExtension(attachment.fileName)}</span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  ),
                                }]
                              : []),
                            ...(activeTaskEditDraft
                              ? [{
                                  label: t('tasks.newRequest.priority', 'Öncelik'),
                                  value: (
                                    <select
                                      className="field-select ml-auto w-auto"
                                      value={activeTaskEditDraft.priority}
                                      onChange={e => updateActiveTaskEditDraft({ priority: e.target.value })}
                                    >
                                      {editJobModal && <option value="Low">{t('enum.priority.Low', 'Düşük')}</option>}
                                      <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
                                      <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                                      <option value="VeryHigh">{t('enum.priority.VeryHigh', 'Çok Yüksek')}</option>
                                      <option value="Critical">{t('enum.priority.Critical', 'Kritik')}</option>
                                    </select>
                                  ),
                                }]
                              : []),
                            ...(editJobModal
                              ? [{
                                  label: t('jobs.form.startDate', 'Başlangıç Tarihi'),
                                  value: (
                                    <DateTimePicker
                                      value={editJobModal.startDateUtc}
                                      onChange={v => setEditJobModal(m => m && ({ ...m, startDateUtc: v }))}
                                      placeholder={t('jobs.form.startDate', 'Başlangıç Tarihi')}
                                      forceUp
                                    />
                                  ),
                                }]
                              : []),
                          ].map((row, fieldIndex) => {
                            const tone = 'tone' in row ? row.tone : undefined
                            return (
                            <div key={fieldIndex} className="job-detail-field-row job-detail-field-row--request-info">
                              <div className={`job-detail-field-row__label ${tone === 'cancel' ? 'text-red-600' : tone === 'completion' ? 'text-emerald-600' : ''}`}>{row.label}</div>
                              <div className={`job-detail-field-row__value ${tone === 'cancel' ? 'text-red-600' : tone === 'completion' ? 'text-emerald-600' : ''}`}>{row.value}</div>
                            </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="min-w-0 p-4">
                        {(() => {
                          // Süreç timeline'ı — Taleplerim popup'ındaki JobProcessTimeline birebir yeniden
                          // kullanılır; Durum/Son Tarih ve ek süre akışları timeline adımlarına taşındı.
                          const isCompletedTimelineTask = taskDetail.currentStatus === 'Completed'
                          const isCancelledTimelineTask = taskDetail.currentStatus === 'Cancelled' || taskDetail.currentStatus === 'Rejected'
                          const dueDateStep: JobProcessStep = {
                            id: 'dueDate',
                            label: t('tasks.columns.dueDate', 'Son Tarih'),
                            displayValue: formatDueDateTime(taskDetail.dueDateUtc, locale),
                            dateTimeUtc: taskDetail.dueDateUtc ?? null,
                            state: isCompletedTimelineTask || isCancelledTimelineTask ? 'completed' : 'upcoming',
                          }
                          // CancelTask → TaskCancelled (StatusChangeHistory'de yok); detay UpdatedAtUtc
                          // audit zamanını taşır (card #1795).
                          const cancelledAtUtc = taskDetail.statusChangeHistory?.find(entry =>
                            entry.toStatus === 'Cancelled' || entry.toStatus === 'Rejected'
                          )?.changedAtUtc
                            ?? taskDetail.updatedAtUtc
                            ?? selectedTask?.updatedAtUtc
                            ?? null
                          const steps: JobProcessStep[] = [
                            {
                              id: 'requestDate',
                              label: t('tasks.columns.taskDate', 'Görev Tarihi'),
                              displayValue: formatDateTime(taskDetail.createdAtUtc, locale),
                              dateTimeUtc: taskDetail.createdAtUtc,
                              state: 'completed',
                            },
                            ...(isCompletedTimelineTask
                              ? [dueDateStep, {
                                  id: 'completionDate' as const,
                                  label: t('tasks.columns.completedAt', 'Tamamlanma Tarihi'),
                                  displayValue: formatDateTime(taskDetail.completedAtUtc, locale),
                                  dateTimeUtc: taskDetail.completedAtUtc ?? null,
                                  state: 'terminal-success' as const,
                                }]
                              : isCancelledTimelineTask
                                ? [dueDateStep, {
                                    id: 'cancelDate' as const,
                                    label: t('tasks.columns.cancelledAt', 'İptal Tarihi'),
                                    displayValue: formatDateTime(cancelledAtUtc, locale),
                                    dateTimeUtc: cancelledAtUtc,
                                    state: 'terminal-danger' as const,
                                  }]
                                : [
                                    {
                                      id: 'status' as const,
                                      label: t('tasks.columns.status', 'Durum'),
                                      displayValue: getTaskDisplayStatus(t, taskDetail),
                                      dateTimeUtc: null,
                                      // Son Tarihi Geçmiş → turuncu (#1644). Yapılmakta → mavi pending
                                      // (#1659; talep Süreç #1651 ile aynı).
                                      state: ((taskDetail.dueDateUtc != null && new Date(taskDetail.dueDateUtc).getTime() < Date.now())
                                        ? 'current'
                                        : 'pending') as 'current' | 'pending',
                                    },
                                    dueDateStep,
                                  ]),
                          ]
                          const statusContent = (
                            <span className="inline">
                              {getTaskDisplayStatus(t, taskDetail)}
                              {taskDetail.statusActorDisplayName ? ` (${taskDetail.statusActorDisplayName})` : ''}
                            </span>
                          )
                          // Terminal notlar artık durum satırında gösterilmez; Görev Detayları kutusunda yer alır.
                          const statusNoteContent = undefined
                          const dueDateContent = activeTaskEditDraft ? (
                            <div className="mt-1 my-request-detail-edit-due-date">
                              <DateTimePicker
                                value={activeTaskEditDraft.dueDateUtc}
                                onChange={value => updateActiveTaskEditDraft({ dueDateUtc: value })}
                                placeholder={t('jobs.form.dueDate', 'Bitiş Tarihi')}
                                forceUp
                              />
                            </div>
                          ) : dueDateEdit?.taskId === taskDetail.taskId ? (
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
                          ) : extraTimeEdit?.taskId === taskDetail.taskId ? (
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
                          ) : extraTimeReview?.taskId === taskDetail.taskId ? (
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
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">{formatDueDateTime(taskDetail.dueDateUtc, locale)}</span>
                              {canReviewExtraTime ? (
                                // Yöneticiye bekleyen ek süre talebi tek bir aksiyon linki olarak gösterilir;
                                // ayrı bir "(Ek süre talebi)" işaretiyle tekrar edilmez (card #1404 reopen).
                                <button
                                  type="button"
                                  className="text-xs font-bold text-amber-500 underline-offset-2 hover:text-amber-600 hover:underline"
                                  onClick={openExtraTimeReview}
                                >
                                  ({t('tasks.actions.viewExtraTimeRequest', 'Ek süre talebini gör')})
                                </button>
                              ) : (
                                // Detayda yalnız bekleyen işaret; onaylandı/reddedildi ifadesi gride özeldir (card #1386).
                                <GridExtraTimeMarkers hasPending={taskDetail.hasPendingExtraTimeRequest} inline />
                              )}
                              {canChangeTaskDueDate && (
                                <button
                                  type="button"
                                  className="text-xs font-bold text-emerald-600 underline underline-offset-2 hover:text-emerald-700"
                                  onClick={openDueDateEdit}
                                >
                                  {t('common.change', 'Değiştir')}
                                </button>
                              )}
                              {canRequestExtraTime && (
                                <button
                                  type="button"
                                  className="text-xs font-bold text-amber-600 underline underline-offset-2 hover:text-amber-700"
                                  onClick={openExtraTimeEdit}
                                >
                                  {t('tasks.actions.extraTimeRequest', 'Ek süre iste')}
                                </button>
                              )}
                              {showExtraTimeDecisionBadge && latestExtraTimeApproval && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold">
                                  <span className="text-slate-400">{t('tasks.actions.extraTimeRequest', 'Ek süre iste')}</span>
                                  {latestExtraTimeApproval.decision === 'Approved' && (
                                    <span className="text-emerald-600">({t('tasks.actions.extraTimeApprovedShort', 'onay')})</span>
                                  )}
                                  {latestExtraTimeApproval.decision === 'Rejected' && (
                                    <span className="text-red-600">({t('tasks.actions.extraTimeRejectedShort', 'red')})</span>
                                  )}
                                </span>
                              )}
                            </div>
                          )
                          const statusChangeHistory = taskDetail.statusChangeHistory ?? []
                          const firstStatusChange = statusChangeHistory[statusChangeHistory.length - 1]
                          const latestStatusChange = statusChangeHistory[0]
                          const firstChangedStatus = firstStatusChange
                            ? firstStatusChange.fromStatus ?? firstStatusChange.toStatus
                            : null
                          return (
                            <>
                              <JobProcessTimeline
                                steps={steps}
                                locale={locale}
                                statusContent={statusContent}
                                statusActorName={taskDetail.statusActorDisplayName ?? null}
                                statusNoteContent={statusNoteContent}
                                dueDateContent={dueDateContent}
                              />
                              {firstStatusChange && latestStatusChange && firstChangedStatus ? (
                                <div className="task-process-status-change mt-1 border-t border-slate-100 pt-1">
                                  <div className="job-detail-field-row job-detail-field-row--request-info task-process-status-change__row">
                                    <div className="job-detail-field-row__label">{t('tasks.detail.statusChangeHistory', 'Durum Değişikliği')}</div>
                                    <div className="job-detail-field-row__value">
                                      <StatusChangeTransition
                                        fromStatus={firstChangedStatus}
                                        toStatus={latestStatusChange.toStatus}
                                        fromAtUtc={firstStatusChange.changedAtUtc}
                                        toAtUtc={latestStatusChange.changedAtUtc}
                                        locale={locale}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </section>

                  {/* Rutin görevlerde 2. satır: Adres Bilgileri + Ekler / Fotoğraflar (card 575) */}
                  {taskDetail.jobSourceType === 'Routine' && (() => {
                    const isCompleted = taskDetail.currentStatus === 'Completed'
                    const isEditingThisRoutineTask = editRoutineTaskModal?.taskId === taskDetail.taskId
                    return (
                      <section className="my-request-detail-bottom mb-5 grid gap-4 lg:grid-cols-3">
                        <div className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
                          <MyRequestSectionHeading icon={MapPin}>
                            {t('address.detailSectionTitle', 'Adres Bilgileri')}
                          </MyRequestSectionHeading>
                          {isEditingThisRoutineTask ? (
                            <div className="my-request-edit-fields grid gap-2">
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold text-slate-500">{t('address.neighborhoodLabel', 'Mahalle')}</span>
                                <SingleSelectDropdown
                                  openUp
                                  searchable
                                  options={neighborhoodOptions}
                                  value={editRoutineTaskModal.neighborhood ?? ''}
                                  onChange={neighborhood => updateRoutineTaskAddressDraft(neighborhood
                                    ? { neighborhood }
                                    : { neighborhood: '', street: '', openAddress: '' })}
                                  placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
                                />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold text-slate-500">{t('address.streetLabel', 'Cadde / Sokak / Bulvar')}</span>
                                <input
                                  className="field-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                  placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
                                  maxLength={ADDRESS_STREET_MAX_LENGTH}
                                  value={editRoutineTaskModal.street ?? ''}
                                  onChange={e => updateRoutineTaskAddressDraft({ street: e.target.value })}
                                  disabled={!editRoutineTaskModal.neighborhood}
                                />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold text-slate-500">{t('address.openAddressLabel', 'Açık Adres')}</span>
                                <textarea
                                  className="field-textarea min-h-[2.75rem] resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                                  placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
                                  maxLength={ADDRESS_OPEN_ADDRESS_MAX_LENGTH}
                                  value={editRoutineTaskModal.openAddress ?? ''}
                                  onChange={e => updateRoutineTaskAddressDraft({ openAddress: e.target.value })}
                                  disabled={!editRoutineTaskModal.neighborhood}
                                />
                              </label>
                            </div>
                          ) : (
                            <AddressDetailFields
                              neighborhood={parentJobDetail?.neighborhood}
                              street={parentJobDetail?.street}
                              openAddress={parentJobDetail?.openAddress}
                            />
                          )}
                        </div>
                        <div className="my-request-detail-card my-request-detail-card--attachments routine-task-attachments-card rounded-xl border border-slate-200 bg-white p-4">
                          <MyRequestSectionHeading icon={Paperclip}>
                            {t('attachments.taskSectionTitle', 'Görev Ekleri')}
                          </MyRequestSectionHeading>
                          <AttachmentSection
                            attachments={taskDetail.attachments ?? []}
                            readOnly={!isEditingThisRoutineTask}
                            compact
                            displayMode="rich-list"
                            emptyText={t('attachments.routineEmpty', 'Rutin Görev için ek/fotoğraf bulunmamaktadır.')}
                            onUpload={isEditingThisRoutineTask ? handleRoutineTaskAttachmentUpload : undefined}
                            onDelete={isEditingThisRoutineTask ? handleRoutineTaskAttachmentDelete : undefined}
                          />
                          {isCompleted && (
                            <p className="mt-2 text-xs font-medium text-amber-600">
                              {t('attachments.routineLocked', 'Rutin görev tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')}
                            </p>
                          )}
                        </div>
                        <div className="my-request-detail-card rounded-xl border border-slate-200 bg-white p-4">
                          <MyRequestSectionHeading icon={History}>
                            {t('tasks.detail.routineEditHistoryTitle', 'Rutin Görev Düzenleme Geçmişi')}
                          </MyRequestSectionHeading>
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
                    // Yönlenme sebebi yalnızca Target rollü kayıttan okunur; Owner kaydının Notes'u
                    // farklı bir özelliğe (ccc:owner-task-request JSON) ait olabilir (card #1444).
                    const fulfillingJobDepartment = parentJobDetail.departments.find(
                      dept => dept.departmentId === taskDetail.assignedDepartmentId && dept.role === 'Target',
                    )
                    const parentForwardReason = fulfillingJobDepartment?.notes?.trim() || null
                    const parentForwardSourceUser = fulfillingJobDepartment?.requestedByUserId
                      ? users.find(item => item.userId === fulfillingJobDepartment.requestedByUserId)
                      : null
                    const parentForwardSourceDepartmentName = parentForwardSourceUser?.departments?.find(department => department.isPrimary)?.name
                      ?? parentForwardSourceUser?.departments?.[0]?.name
                      ?? null
                    const parentForwardReasonDisplay = parentForwardReason ? (
                      <span className="text-teal-800">
                        {parentForwardSourceDepartmentName ?? t('jobs.forward.sourceFallback', 'Talebi Yönlendiren Birim')}
                        <span aria-hidden="true"> / </span>
                        {parentForwardReason}
                      </span>
                    ) : null
                    const isCitizenParentJob = isCitizenRequestJob(parentJobDetail)
                    const parentOverdue = parentJobDetail.dueDateUtc != null
                      && new Date(parentJobDetail.dueDateUtc).getTime() < Date.now()
                      && parentJobDetail.status !== 'Completed'
                      && parentJobDetail.status !== 'Cancelled'
                      && parentJobDetail.status !== 'Rejected'
                    const parentStatusClass = parentJobDetail.status === 'Completed'
                      ? 'text-emerald-600'
                      : parentJobDetail.status === 'Cancelled'
                        ? 'text-rose-600'
                        : 'text-orange-500'
                    // Süreç Durum: süresi geçmişte birleşik etiket (card #1646 / Birimdeki Görevler #1647).
                    const parentStatusContent = isCitizenParentJob
                      ? getCitizenRequestStatusLabel(t, parentJobDetail)
                      : parentJobDetail.status === 'Completed'
                        ? t('jobs.status.completed', 'Tamamlandı')
                        : parentJobDetail.status === 'Cancelled'
                          ? t('jobs.status.cancelled', 'İptal Edildi')
                          : parentOverdue
                            ? formatOverdueInProgressStatus(t)
                            : t('jobs.status.inProgress', 'Yapılmakta')
                    const parentRequestNumberSuffix = parentForwardReasonDisplay ? (
                      <span className="text-xs font-bold text-teal-800">({t('jobs.forward.badge', 'Yönlendirilen Talep')})</span>
                    ) : null
                    const parentRequestNumberText = isCitizenParentJob
                      ? formatCitizenRequestNumber(citizenSourceMessage ?? { createdAtUtc: parentJobDetail.createdAtUtc }, locale)
                      : formatJobDisplayNumberText(parentJobDetail, locale)
                    const parentRequestTypeText = parentJobDetail.requestType === 'ExternalUnit'
                      ? t('jobs.requestType.external', 'Birim Dışı')
                      : t('jobs.requestType.internal', 'Birim İçi')
                    const parentExtraFields = parentForwardReasonDisplay ? [{
                      label: t('jobs.forward.reasonLabel', 'Talep Yönlenme Sebebi'),
                      value: parentForwardReasonDisplay,
                    }] : []
                    // Talep Bilgileri, Adres Bilgileri ile yer değiştirip alt satıra taşındığı için
                    // (card #1449) burada bağımsız olarak yeniden kurulur.
                    const parentTitleLabel = t('jobs.form.title', 'Talep Başlığı')
                    const parentRequestNoLabel = t('jobs.columns.requestNo', 'Talep No')
                    const parentCitizenRequestNoLabel = t('jobs.detail.citizenRequestNo', 'Vatandaş Talep No')
                    const parentPriorityLabel = t('jobs.columns.priority', 'Öncelik')
                    const parentProjectLabel = t('jobs.form.isProject', 'Proje mi')
                    const parentInfoFields = buildMyRequestDetailFields(
                      parentJobDetail, t, locale, citizenSourceMessage, parentRequestNumberSuffix, parentExtraFields, false,
                    ).filter(field => {
                      // Talep Başlığı verisi İlgili Talep Detayları'ndan tamamen kaldırıldı (card #1464).
                      if (field.label === parentTitleLabel) return false
                      if ([parentRequestNoLabel, parentCitizenRequestNoLabel].includes(field.label)) return false
                      if ([parentPriorityLabel, parentProjectLabel].includes(field.label)) return false
                      return true
                    })
                    const parentAddressColumnContent = (
                      <>
                        <MyRequestSectionHeading icon={MapPin}>
                          {t('address.detailSectionTitle', 'Adres Bilgileri')}
                        </MyRequestSectionHeading>
                        <AddressDetailFields
                          variant="stacked"
                          neighborhood={parentJobDetail.neighborhood}
                          street={parentJobDetail.street}
                          openAddress={parentJobDetail.openAddress}
                        />
                      </>
                    )
                    // Kendine atayan yönetici kendi talebini düzenlerken (card #1519) Yönetici Notu
                    // hiç gösterilmez ve Ekler/Fotoğraflar düzenlenebilir olur.
                    const isSelfAssignedManagerTask = canEditSelfAssignedManagerTask(taskDetail)
                    const isEditingThisParentJob = editJobModal?.jobId === parentJobDetail.jobId
                    const parentInfoCardContent = (
                      <>
                        <MyRequestSectionHeading icon={Info} className="w-full">
                          <span className="grid min-w-0 w-full flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                            <span className="min-w-0">{t('jobs.detail.requestInfoFields', 'Talep Bilgileri')}</span>
                            <span className="ml-auto flex max-w-full flex-col items-end justify-center gap-1 text-right">
                              <span className="flex max-w-full flex-wrap items-center justify-end gap-1 text-xs font-semibold leading-tight text-slate-500">
                                {isCitizenParentJob && (
                                  <ChannelIcon channel={citizenSourceMessage?.channel ?? 'WhatsApp'} className="size-3.5 shrink-0" />
                                )}
                                <span>{parentRequestNumberText}</span>
                                {parentRequestNumberSuffix}
                              </span>
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold leading-tight text-orange-600">{parentRequestTypeText}</span>
                            </span>
                          </span>
                        </MyRequestSectionHeading>
                        <MyRequestInfoFieldsList
                          fields={parentInfoFields}
                          detail={parentJobDetail}
                          t={t}
                          separatePriorityProjectRows
                          extraTrailingRows={isEditingThisParentJob ? undefined : [
                            {
                              label: t('attachments.requestSectionTitle', 'Talep Ekleri'),
                              // Görev Ekleri satırıyla aynı sunum: mavi ad, iki satırı aşınca scroll (card #1617).
                              value: (parentJobDetail.attachments?.length ?? 0) === 0 ? '—' : (
                                <div className="flex max-h-11 flex-col items-end gap-1 overflow-y-auto pr-0.5 [scrollbar-gutter:stable]">
                                  {parentJobDetail.attachments!.map(attachment => {
                                    const AttachmentIcon = completionAttachmentIcon(attachment.fileName)
                                    return (
                                      <button
                                        key={attachment.attachmentId}
                                        type="button"
                                        className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:text-blue-700"
                                        onClick={() => void handleDownloadTaskAttachment(attachment.attachmentId, attachment.fileName)}
                                      >
                                        <AttachmentIcon className="size-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                                        <span className="truncate">{lowercaseFileExtension(attachment.fileName)}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              ),
                            },
                            // Yönetici notu yalnızca doluysa Talep Ekleri'nin hemen altında gösterilir (card #1538);
                            // vatandaş talebi veya kendine atayan yönetici için hiç gösterilmez (card #1519 devamı).
                            ...(!isCitizenParentJob && !isSelfAssignedManagerTask && parentJobDetail.managerNote?.trim()
                              ? [{
                                  label: t('jobs.managerNote.title', 'Yönetici Notu'),
                                  value: <span className="whitespace-pre-wrap text-right">{parentJobDetail.managerNote}</span>,
                                }]
                              : []),
                          ]}
                        />
                      </>
                    )
                    return (
                      <section className="page-stack mb-5">
                        <MyRequestDetailMainCard
                          detail={parentJobDetail}
                          locale={locale}
                          citizenSourceMessage={citizenSourceMessage}
                          detailStatusClass={parentStatusClass}
                          statusContent={parentStatusContent}
                          sectionTitle={t('tasks.detail.parentJobTitle', 'İlgili Talep Detayları')}
                          requestNumberSuffix={parentRequestNumberSuffix}
                          extraFields={parentExtraFields}
                          includeAssigneeField={false}
                          hideTitleText
                          forceShowOwnerApproval
                          middleColumnOverride={parentAddressColumnContent}
                          leftColumnBelowHeading={parentInfoCardContent}
                          boxedColumns
                          canChangeDueDate={false}
                          detailDueDateEdit={null}
                          onOpenDueDateEdit={() => undefined}
                          onCloseDueDateEdit={() => undefined}
                          onDueDateChange={() => undefined}
                          onDueDateSave={() => undefined}
                        />
                        <MyRequestDetailBottomCards
                          detail={parentJobDetail}
                          // Yönetici Notu artık dolu olduğunda Talep Bilgileri listesinde Talep Ekleri'nin
                          // hemen altında satır olarak gösteriliyor; ayrı kart tekrar oluşturulmaz (card #1538).
                          showManagerNoteColumn={false}
                          canEditManagerNote={false}
                          canManageCoordination={false}
                          managerNoteDraft=""
                          managerNoteEditing={false}
                          managerNoteSaved={false}
                          managerNoteSaving={false}
                          onManagerNoteDraftChange={() => undefined}
                          onManagerNoteEditStart={() => undefined}
                          onManagerNoteSave={() => undefined}
                          onManagerNoteDeleteConfirm={() => undefined}
                          setConfirmDialog={() => undefined}
                          isEditing={isEditingThisParentJob}
                          canEditJobAttachments={isEditingThisParentJob}
                          showAttachmentLockNotice={taskDetail.currentStatus === 'Completed'}
                          attachmentLockText={t('attachments.lockedCompletedRequest', 'Talep tamamlandığı için sonradan Ek/Fotoğraf eklenemez.')}
                          attachmentUploading={false}
                          onAttachmentUpload={handleParentJobAttachmentUpload}
                          onAttachmentDelete={handleParentJobAttachmentDelete}
                          hideAddressCard
                          hideAttachmentsCard={!isEditingThisParentJob}
                        />
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
                        <div className="routine-edit-history-attachment-compare rounded-lg border border-slate-200 bg-white p-3">
                          <div className="mb-2 text-xs font-semibold text-slate-500">{t('tasks.detail.routineEditBefore', 'Önceki')}</div>
                          <AttachmentSection
                            attachments={snapshotAttachmentsToAttachmentList(entry.snapshot.attachments)}
                            readOnly
                            compact
                            displayMode="rich-list"
                            emptyText={t('attachments.routineEmpty', 'Rutin Görev için ek/fotoğraf bulunmamaktadır.')}
                          />
                        </div>
                        <div className="routine-edit-history-attachment-compare rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                          <div className="mb-2 text-xs font-semibold text-emerald-700">{t('tasks.detail.routineEditAfter', 'Sonraki')}</div>
                          <AttachmentSection
                            attachments={snapshotAttachmentsToAttachmentList(afterSnapshot.attachments)}
                            readOnly
                            compact
                            displayMode="rich-list"
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
                  // Üst düzey (Reporter) talepten gelen atanmış görev: Başlık + Görevi Yapan turuncu (card #1648).
                  const reporterTitleClass = isReporterTask ? 'text-[#f97316]' : ''
                  const reporterAssigneeClass = isReporterTask ? 'text-orange-500 font-semibold' : 'text-slate-600'

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
                            <div className="table-number-cell__value font-mono flex w-full flex-col items-center justify-center gap-0.5 text-center">
                              <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
                                <ChannelIcon channel={getCitizenTaskChannel(task, socialByJobId)} className="size-4 shrink-0" />
                                <span className={reporterLinkedRequestClass}>{linkedRequestNumber}</span>
                              </span>
                              {task.forwardReason ? <span className="font-sans font-bold text-teal-800">({t('jobs.forward.badge', 'Yönlendirilen Talep')})</span> : null}
                            </div>
                          )
                          : (
                            <div className="table-number-cell__value font-mono flex w-full flex-col items-center justify-center gap-0.5 text-center">
                              <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
                                <span className={reporterLinkedRequestClass}>{linkedRequestNumber}</span>
                              </span>
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
                      {/* Bugün atanan görevler: Görev Tarihi altında yanıp sönen yeşil "Yeni"
                          (Görevlerim #589; Birimdeki/Personelim #1668). Terminalde gizlenir (#606). */}
                      {(isMyTasksView || isDepartmentTasksView || isStaffTasksView)
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
                    <td><span className={`cell-title ${reporterTitleClass}`}>{task.title}</span></td>
                    {(isStaffTasksView || isMyTasksView || isDepartmentTasksView) && (
                      <td>
                        <div className="mx-auto max-w-[11rem] text-center">
                          <StatusPill tone={task.jobSourceType === 'Routine' ? 'neutral' : 'success'} className="text-[0.82rem]">
                            {task.jobSourceType === 'Routine' ? t('tasks.type.routine', 'Rutin') : t('tasks.type.assigned', 'Atanmış')}
                          </StatusPill>
                          <div className={`mt-1 truncate text-xs ${reporterAssigneeClass}`}>
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
                            <GridStatusLabel
                              t={t}
                              label={getTaskDisplayStatus(t, task)}
                              channel={isCitizenRequestJob({ requestType: task.jobRequestType, sourceType: task.jobSourceType })
                                ? getCitizenTaskChannel(task, socialByJobId)
                                : null}
                              footer={statusDate
                                ? <span className={`text-[0.68rem] font-bold ${task.currentStatus === 'Completed' ? 'text-emerald-700' : 'text-red-700'}`}>{formatDateTime(statusDate, locale)}</span>
                                : undefined}
                            />
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
                            onClick={() => void openRoutineTaskEdit(task.taskId)}
                          >
                            <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                            {t('common.edit', 'Düzenle')}
                          </Button>
                        ) : canEditSelfAssignedManagerTask(task) ? (
                          <Button
                            size="sm"
                            className="inline-flex items-center gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
                            onClick={() => void openEditJobModalById(task.jobId)}
                          >
                            <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                            {t('common.edit', 'Düzenle')}
                          </Button>
                        ) : task.jobSourceType === 'Routine' ? (
                          <DisabledActionButton
                            size="sm"
                            className="button-placeholder inline-flex items-center gap-1.5 bg-teal-700 text-white"
                            hoverTitle={t('tasks.actions.editUnavailable', 'Bu görev düzenlenemez')}
                          >
                            <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                            {t('common.edit', 'Düzenle')}
                          </DisabledActionButton>
                        ) : null)}
                        {!showOnlyDetailsInTaskGridActions && currentScope === 'department-pool' && !task.assignedUserId && (
                          <Button size="sm" onClick={() => handleClaim(task.taskId)}>{t('tasks.actions.claim', 'Claim')}</Button>
                        )}
                        {(() => {
                          if (showOnlyDetailsInTaskGridActions) return null
                          const canComplete = isMyTasksView && isAssignee(task) && isActionableTaskStatus(task.currentStatus)
                          if (canComplete) {
                            return (
                              <Button size="sm" variant="success" className="inline-flex items-center gap-1.5" onClick={() => handleComplete(task)}>
                                <CheckCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                                {t('tasks.actions.complete', 'Tamamla')}
                              </Button>
                            )
                          }
                          if (isMyTasksView && currentMyTaskView === 'all') {
                            return (
                              <DisabledActionButton size="sm" variant="success" className="inline-flex items-center gap-1.5" hoverTitle={t('tasks.actions.completeUnavailable', 'Bu görev şu an tamamlanamaz')}>
                                <CheckCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                                {t('tasks.actions.complete', 'Tamamla')}
                              </DisabledActionButton>
                            )
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

      {completeModal && createPortal(
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
              <span className="job-field-label">{t('tasks.actions.completionNote', 'Tamamlama Notu')} <span className="text-[10px] font-normal text-slate-400">(max 100 karakter)</span> <span className="text-red-500">*</span></span>
              <textarea
                className="field-textarea"
                rows={3}
                maxLength={100}
                value={completionNote}
                onChange={e => setCompletionNote(e.target.value)}
                placeholder={t('tasks.actions.completionNotePlaceholder', 'Tamamlama hakkında not ekleyin...')}
                autoFocus
              />
            </label>
            {pendingCompletionAttachments.length > 0 ? (
              <ul className="completion-attachment-list rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                {pendingCompletionAttachments.map(item => {
                  const Icon = completionAttachmentIcon(item.fileName)
                  return (
                  <li key={item.attachmentId} className="inline-flex min-w-0 items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700">
                      <Icon className="size-3" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 break-words text-left text-[10px] font-normal leading-5 text-slate-700">{lowercaseFileExtension(item.fileName)}</span>
                    <button
                      type="button"
                      className="shrink-0 self-center text-[11px] font-medium leading-5 text-red-500 hover:text-red-600"
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
                <Button
                  type="button"
                  variant="success"
                  className="inline-flex items-center gap-1.5"
                  disabled={completeSaving || completionAttachmentUploading || !completionNote.trim()}
                  onClick={() => void handleCompleteConfirm()}
                >
                  {completeSaving ? t('common.loading') : (
                    <>
                      <CheckCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                      {t('tasks.actions.complete', 'Tamamla')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </ModalBackdrop>,
        document.body,
      )}

      {returnModal && createPortal(
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
                <h2 className="border-b border-slate-200 pb-2 pr-8 text-base font-semibold text-slate-950">{t('tasks.actions.cancelTaskModalTitle', 'Görevi İptal Et')}</h2>
                <p className="text-base font-medium leading-6 text-slate-700">{t('tasks.actions.cancelHelp', 'Görevi iptal etmek için neden belirtiniz.')}</p>
                <label className="job-field">
                  <span className="job-field-label">{t('tasks.actions.cancelReason', 'İptal Nedeni')} <span className="text-[10px] font-normal text-slate-400">(max 100 karakter)</span> <span className="text-red-500">*</span></span>
                  <textarea
                    className="field-textarea"
                    rows={3}
                    maxLength={100}
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
                <div className="job-field">
                  <span className="job-field-label">{t('tasks.draftUser', 'Kullanıcı (isteğe bağlı)')}</span>
                  <SingleSelectDropdown
                    className="w-full"
                    triggerClassName="text-xs font-medium"
                    menuScrollClassName="task-return-user-menu-scroll"
                    options={returnDeptUsers.map(userOption => ({ value: userOption.userId, label: userOption.displayName }))}
                    value={returnUserId}
                    onChange={setReturnUserId}
                    placeholder={t('tasks.userSelection', 'Personel seçiniz')}
                    emptyText={t('tasks.noUsers', 'Personel bulunamadı')}
                  />
                </div>
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
        </ModalBackdrop>,
        document.body,
      )}

      {statusChangeModal && createPortal(
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
              <span className="job-field-label">{t('tasks.actions.changeStatusReason', 'Neden')} <span className="text-[10px] font-normal text-slate-400">(max 100 karakter)</span> <span className="text-red-500">*</span></span>
              <textarea
                className="field-textarea"
                rows={3}
                maxLength={100}
                value={statusChangeReason}
                onChange={e => setStatusChangeReason(e.target.value)}
                placeholder={t('tasks.actions.changeStatusReasonPlaceholder', 'Durum değişikliği nedenini açıklayınız...')}
                autoFocus
              />
            </label>
            <div className="job-field">
              <span className="job-field-label">{t('tasks.actions.changeStatusSelect', 'Görev Durumu Seç')}</span>
              <SingleSelectDropdown
                className="w-full"
                triggerClassName="text-xs font-medium"
                menuScrollClassName="task-status-change-menu-scroll"
                options={STATUS_CHANGE_OPTIONS
                  .filter(option => option.value !== statusChangeModal.currentStatus)
                  .map(option => ({ value: option.value, label: t(option.labelKey, option.fallback) }))}
                value={statusChangeTarget}
                onChange={setStatusChangeTarget}
                placeholder={t('tasks.actions.changeStatusPlaceholder', 'Görev durumu seçiniz')}
              />
            </div>
            <div className="inline-actions justify-end">
              <Button type="button" variant="secondary" onClick={closeStatusChangeModal}>
                {t('common.dismiss', 'Vazgeç')}
              </Button>
              <Button type="button" className="bg-orange-500 text-white hover:bg-orange-600" disabled={statusChangeSaving || !statusChangeReason.trim() || !statusChangeTarget} onClick={() => void handleStatusChangeConfirm()}>
                {statusChangeSaving ? t('common.loading') : t('tasks.actions.changeStatus', 'Durum Değiştir')}
              </Button>
            </div>
          </div>
        </ModalBackdrop>,
        document.body,
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
