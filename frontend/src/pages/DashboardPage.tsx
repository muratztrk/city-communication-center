import { ClipboardList, Clock3, ListChecks, MessageSquareMore, SquareKanban } from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { getActiveDepartmentId } from '../api/http'
import { StatusPill } from '../components/ui/status-pill'
import { PieChart, PieLegendSearch } from '../components/ui/PieChart'
import { DashboardChartDrilldownModal } from '../components/DashboardChartDrilldownModal'
import { CitizenChannelMessagesModal } from '../components/CitizenChannelMessagesModal'
import { AllCitizenRequestsModal } from '../components/AllCitizenRequestsModal'
import { AllDepartmentRequestsModal } from '../components/AllDepartmentRequestsModal'
import { useAuth } from '../context/AuthContext'
import { isModuleUsable } from '../lib/licenseModules'
import { getEffectiveUserRoles } from '../lib/rolePageAccess'
import { hasCitizenRequestManagerRole } from '../utils/roleAccess'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'
import { toApiDateParam, toDateTimePickerValue } from '../utils/dateTimePicker'
import { getDashboardChartTitleIcon } from '../utils/dashboardChartIcons'
import type { DashboardChartResponse } from '../types/platform'

const DASHBOARD_SCROLL_KEY = 'ccc.dashboard.scrollTop'

function getDashboardScrollEl(): HTMLElement | null {
  // Desktop: scroll `main#main-content` üzerinde; shell `md:overflow-visible` (#r545 / #17 reopen).
  const main = document.getElementById('main-content')
  if (main instanceof HTMLElement) return main
  const shell = document.querySelector('.app-content-shell')
  return shell instanceof HTMLElement ? shell : null
}

function saveDashboardScroll() {
  const el = getDashboardScrollEl()
  if (el) sessionStorage.setItem(DASHBOARD_SCROLL_KEY, String(el.scrollTop))
}

interface MetricCard {
  label: string
  sublabel?: string
  value: number | undefined
  icon: React.ElementType
  path: string
  iconBg: string
  iconColor: string
}

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
type TaskChartFilter = 'all' | 'assigned' | 'routine'
type TaskChartKey = 'dashboard.charts.staffTasks' | 'dashboard.charts.myTasks'

const TASK_CHART_KEYS = new Set<TaskChartKey>([
  'dashboard.charts.staffTasks',
  'dashboard.charts.myTasks',
])

/** Pie chart bölümünden kaldırılan grafikler (card #2521). */
const REMOVED_PIE_CHART_KEYS = new Set([
  'dashboard.charts.departmentTasks',
  'dashboard.charts.requestPriority',
  'dashboard.charts.requestPriorityAll',
])

/** Banner Ara... ile aynı kutu; personel pie'ları hariç listedeki pie'larda (R549/R550). */
const PIE_LEGEND_SEARCH_KEYS = new Set([
  'dashboard.charts.requestTags',
  'dashboard.charts.neighborhoodCompletedRequests',
  'dashboard.charts.neighborhoodOpenRequests',
  'dashboard.charts.neighborhoodAllRequests',
  'dashboard.charts.citizenDepartmentOpenRequests',
  'dashboard.charts.citizenDepartmentAllRequests',
  'dashboard.charts.citizenDepartmentCompletedRequests',
  'dashboard.charts.externalRequestCreators',
  'dashboard.charts.externalRequestPending',
  'dashboard.charts.externalRequestInProgress',
  'dashboard.charts.externalRequestFulfillers',
  'dashboard.charts.externalProjectsInProgress',
  'dashboard.charts.externalProjectsCompleted',
])

// Pie chart başlığı + lejant metinleri tıklanınca gidilecek ilgili sayfa (card 759).
const CHART_ROUTES: Record<string, string> = {
  'dashboard.charts.staffTasks': '/staff-tasks',
  'dashboard.charts.staffOverdueTasks': '/staff-tasks',
  'dashboard.charts.departmentTasks': '/department-tasks?flow=all',
  'dashboard.charts.myTasks': '/my-tasks',
  'dashboard.charts.myRequests': '/my-requests',
  'dashboard.charts.incomingRequests': '/incoming-requests',
  'dashboard.charts.outgoingRequests': '/outgoing-requests',
  'dashboard.citizenChannels.title': '/social',
  'dashboard.charts.citizenRequests': '/social',
}

// Üst Düzey Yönetici panosunda dilim tıklaması detay popup'ı açan grafikler (#6a6ceed0).
const DRILLDOWN_CHART_KEYS = new Set([
  'dashboard.charts.citizenRequests',
  'dashboard.charts.requestTags',
  'dashboard.charts.externalRequestCreators',
  'dashboard.charts.externalRequestPending',
  'dashboard.charts.externalRequestInProgress',
  'dashboard.charts.externalRequestFulfillers',
  'dashboard.charts.externalProjectsInProgress',
  'dashboard.charts.externalProjectsCompleted',
  'dashboard.charts.neighborhoodCompletedRequests',
  'dashboard.charts.neighborhoodInProgressRequests',
  'dashboard.charts.neighborhoodProcessingRequests',
  'dashboard.charts.citizenDepartmentProcessingRequests',
  'dashboard.charts.citizenDepartmentInProgressRequests',
  'dashboard.charts.citizenDepartmentCompletedRequests',
  'dashboard.charts.neighborhoodAllRequests',
  'dashboard.charts.neighborhoodOpenRequests',
  'dashboard.charts.citizenDepartmentAllRequests',
  'dashboard.charts.citizenDepartmentOpenRequests',
  // Vatandaş Talep Kanalları → VT grid popup (#6a6d0181); ayrı modal.
  'dashboard.citizenChannels.title',
])

/** Split dashboard chart allowlists (Reporter / Operator — cards #1833/#1810). */
const CITIZEN_DASHBOARD_CHART_KEYS = new Set([
  'dashboard.charts.neighborhoodAllRequests',
  'dashboard.charts.citizenDepartmentAllRequests',
  'dashboard.charts.citizenRequests',
  'dashboard.charts.neighborhoodOpenRequests',
  'dashboard.charts.neighborhoodCompletedRequests',
  'dashboard.charts.citizenDepartmentOpenRequests',
  'dashboard.charts.citizenDepartmentCompletedRequests',
  'dashboard.charts.requestTags',
  'dashboard.citizenChannels.title',
])

/** Mahalle/birim durum pie'ları vatandaş anasayfada birleşik 3 dilimli pie'lara toplanır (#2935/#2936). */
const CITIZEN_SOURCE_CHART_KEYS = {
  neighborhoodAll: [
    'dashboard.charts.neighborhoodProcessingRequests',
    'dashboard.charts.neighborhoodInProgressRequests',
    'dashboard.charts.neighborhoodCompletedRequests',
  ],
  neighborhoodOpen: [
    'dashboard.charts.neighborhoodProcessingRequests',
    'dashboard.charts.neighborhoodInProgressRequests',
  ],
  departmentAll: [
    'dashboard.charts.citizenDepartmentProcessingRequests',
    'dashboard.charts.citizenDepartmentInProgressRequests',
    'dashboard.charts.citizenDepartmentCompletedRequests',
  ],
  departmentOpen: [
    'dashboard.charts.citizenDepartmentProcessingRequests',
    'dashboard.charts.citizenDepartmentInProgressRequests',
  ],
} as const

/** Anasayfa - Vatandaş grafik sırası (#2935/#2979). */
const CITIZEN_DASHBOARD_CHART_ORDER = [
  'dashboard.charts.neighborhoodAllRequests',
  'dashboard.charts.citizenDepartmentAllRequests',
  'dashboard.charts.citizenRequests',
  'dashboard.charts.neighborhoodCompletedRequests',
  'dashboard.charts.neighborhoodOpenRequests',
  'dashboard.charts.citizenDepartmentOpenRequests',
  'dashboard.charts.citizenDepartmentCompletedRequests',
  'dashboard.charts.requestTags',
  'dashboard.citizenChannels.title',
]

function mergeCitizenEntitySlices(
  charts: DashboardChartResponse[],
  sourceKeys: readonly string[],
): DashboardChartResponse['slices'] {
  const totals = new Map<string, { value: number; colorHint: string }>()
  for (const titleKey of sourceKeys) {
    const chart = charts.find(item => item.titleKey === titleKey)
    if (!chart) continue
    for (const slice of chart.slices) {
      const previous = totals.get(slice.label)
      totals.set(slice.label, {
        value: (previous?.value ?? 0) + slice.value,
        colorHint: previous?.colorHint ?? slice.colorHint,
      })
    }
  }
  return [...totals.entries()]
    .filter(([, item]) => item.value > 0)
    .map(([label, item]) => ({
      label,
      value: item.value,
      colorHint: item.colorHint,
    }))
}

function buildCitizenEntityAggregateChart(
  titleKey: string,
  charts: DashboardChartResponse[],
  sourceKeys: readonly string[],
): DashboardChartResponse {
  return {
    titleKey,
    slices: mergeCitizenEntitySlices(charts, sourceKeys),
  }
}

function citizenChartOrder(titleKey: string): number {
  const index = CITIZEN_DASHBOARD_CHART_ORDER.indexOf(titleKey)
  return index === -1 ? CITIZEN_DASHBOARD_CHART_ORDER.length : index
}

const REPORTER_DEPARTMENT_CHART_ORDER = [
  'dashboard.charts.externalRequestPending',
  'dashboard.charts.externalRequestInProgress',
  'dashboard.charts.externalRequestFulfillers',
  'dashboard.charts.externalProjectsInProgress',
  'dashboard.charts.externalProjectsCompleted',
  'dashboard.charts.externalRequestCreators',
  'dashboard.charts.myRequests',
]

function reporterDepartmentChartOrder(titleKey: string): number {
  const index = REPORTER_DEPARTMENT_CHART_ORDER.indexOf(titleKey)
  return index === -1 ? REPORTER_DEPARTMENT_CHART_ORDER.length : index
}

const REPORTER_DEPARTMENT_CHART_KEYS = new Set(REPORTER_DEPARTMENT_CHART_ORDER)

const OPERATOR_DEPARTMENT_CHART_KEYS = new Set([
  'dashboard.charts.myTasks',
  'dashboard.charts.myRequests',
])

export type DashboardView = 'full' | 'citizen' | 'departments'

interface DashboardPageProps {
  view?: DashboardView
}

// Lejant dilim etiketi → hedef sayfadaki ilgili scope chip (card 797).
const SLICE_VIEW: Record<string, string> = {
  'dashboard.chart.pending': 'pending',
  'dashboard.chart.pendingApproval': 'pending-approval',
  'dashboard.chart.externalPendingApproval': 'external-pending',
  'dashboard.chart.overdue': 'overdue',
  'dashboard.chart.completed': 'completed',
  'dashboard.chart.cancelled': 'rejected',
  'dashboard.chart.approved': 'approved',
  'dashboard.chart.inProgress': 'approved',
}

const INCOMING_SLICE_STATUS: Record<string, string> = {
  'dashboard.chart.pendingApproval': 'pending-approval',
  'dashboard.chart.pending': 'pending-approval',
  'dashboard.chart.citizenProcessingReceived': 'processing-received',
  'dashboard.chart.overdue': 'overdue',
  'dashboard.chart.approved': 'approved',
  // Yapılmakta Olan → mavi "Yapılmakta Olan Talepler" chip (#r542 / cards #3+#16)
  'dashboard.chart.inProgress': 'in-progress',
  'dashboard.chart.completed': 'completed',
  'dashboard.chart.cancelled': 'cancelled',
}

const CITIZEN_SLICE_STATUS: Record<string, string> = {
  'dashboard.chart.citizenProcessingReceived': 'processing-received',
  'dashboard.chart.overdue': 'overdue',
  'dashboard.chart.inProgress': 'in-progress',
  'dashboard.chart.completed': 'completed',
  'dashboard.chart.cancelled': 'cancelled',
}

const STAFF_SLICE_USER_ID = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\|/i

function parseStaffSliceUserId(sliceLabel: string): string | undefined {
  const match = sliceLabel.match(STAFF_SLICE_USER_ID)
  return match?.[1]
}

function withQueryParams(basePath: string, params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))
  if (entries.length === 0) return basePath
  const search = new URLSearchParams(entries).toString()
  const [path, existingQuery] = basePath.split('?')
  if (!existingQuery) return `${path}?${search}`
  return `${path}?${existingQuery}&${search}`
}

function pieQueryParams(extra: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return { fromPie: '1', ...extra }
}

function periodQueryParams(from: string, to: string): Record<string, string | undefined> {
  if (!from && !to) return {}
  return { from: from || undefined, to: to || undefined }
}

// Bir dilime tıklanınca gidilecek, ilgili filtrelerle gridview rotası (card 797).
function getSliceRoute(
  titleKey: string,
  sliceLabel: string,
  taskChartFilter?: TaskChartFilter,
  period?: { from: string; to: string },
  options?: { citizenChannelsToIncoming?: boolean },
): string | undefined {
  const dateParams = period ? periodQueryParams(period.from, period.to) : {}

  // Vatandaş kanalları: yönetici/admin → Birime Gelen + kanal (#r542/#r545 / #12/#7)
  if (titleKey === 'dashboard.citizenChannels.title') {
    const channel = sliceLabel.startsWith('channel.')
      ? sliceLabel.slice('channel.'.length)
      : undefined
    if (options?.citizenChannelsToIncoming) {
      return withQueryParams('/incoming-requests', pieQueryParams({
        status: 'all',
        citizen: '1',
        channel,
        ...dateParams,
      }))
    }
    return channel
      ? withQueryParams('/social', pieQueryParams({ channel }))
      : withQueryParams('/social', pieQueryParams())
  }

  if (titleKey === 'dashboard.charts.citizenRequests') {
    const requestStatus = CITIZEN_SLICE_STATUS[sliceLabel]
    return withQueryParams('/social', pieQueryParams({
      channel: 'all',
      requestStatus,
      ...dateParams,
    }))
  }

  const taskTypeParam = taskChartFilter && taskChartFilter !== 'all' ? taskChartFilter : undefined

  if (titleKey === 'dashboard.charts.staffTasks') {
    return withQueryParams('/staff-tasks', pieQueryParams({
      userId: parseStaffSliceUserId(sliceLabel),
      taskType: taskTypeParam,
      ...dateParams,
    }))
  }

  if (titleKey === 'dashboard.charts.staffOverdueTasks') {
    return withQueryParams('/staff-tasks', pieQueryParams({
      userId: parseStaffSliceUserId(sliceLabel),
      view: 'overdue',
      taskType: taskTypeParam,
      ...dateParams,
    }))
  }

  if (titleKey === 'dashboard.charts.incomingRequests') {
    const status = INCOMING_SLICE_STATUS[sliceLabel]
    return withQueryParams('/incoming-requests', pieQueryParams({
      status: status === 'pending-approval' ? undefined : status,
      ...dateParams,
    }))
  }

  // Standart kullanıcı "Birimdeki Görevler" 2 dilimli grafiği; "Benim Görevlerim" → Tüm Görevlerim (card #1345).
  if (sliceLabel === 'dashboard.chart.assignedToMe') {
    return withQueryParams('/my-tasks', pieQueryParams({ view: 'all', taskType: taskTypeParam, ...dateParams }))
  }
  // "Birimdeki Görevler" dilimi/legend metni tıklanabilir değildir (card #1337).
  if (sliceLabel === 'dashboard.chart.departmentTotal') {
    return undefined
  }

  const base = CHART_ROUTES[titleKey]
  if (!base) return undefined

  const view = SLICE_VIEW[sliceLabel]

  if (titleKey === 'dashboard.charts.departmentTasks') {
    return withQueryParams('/department-tasks', pieQueryParams({
      flow: 'all',
      view,
      taskType: taskTypeParam,
      ...dateParams,
    }))
  }

  if (titleKey === 'dashboard.charts.myTasks') {
    return withQueryParams('/my-tasks', pieQueryParams({
      view,
      taskType: taskTypeParam,
      ...dateParams,
    }))
  }

  if (!view) return withQueryParams(base.split('?')[0], pieQueryParams(dateParams))
  return withQueryParams(base.split('?')[0], pieQueryParams({ view, ...dateParams }))
}

export function DashboardPage({ view = 'full' }: DashboardPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const role = currentUser?.role ?? ''
  const isSplitDashboardRole = role === 'Reporter' || role === 'Operator'
  const effectiveView: DashboardView = isSplitDashboardRole
    ? (view === 'full' ? 'citizen' : view)
    : 'full'

  const [period, setPeriod] = useState<Period>('yearly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [taskChartFilters, setTaskChartFilters] = useState<Record<TaskChartKey, TaskChartFilter>>({
    'dashboard.charts.staffTasks': 'all',
    'dashboard.charts.myTasks': 'all',
  })
  const [pieLegendSearches, setPieLegendSearches] = useState<Record<string, string>>({})
  const [chartDrilldown, setChartDrilldown] = useState<{ chartKey: string; sliceKey: string } | null>(null)
  const [allCitizenRequestsOpen, setAllCitizenRequestsOpen] = useState(false)
  const [allDepartmentRequestsOpen, setAllDepartmentRequestsOpen] = useState(false)
  const activeDeptId = getActiveDepartmentId()

  function getPeriodRange(p: Period): { from: string; to: string } {
    // Yerel duvar-saati (YYYY-MM-DDTHH:mm) — chip'te UTC kayması olmasın (#r542 / #8).
    const now = new Date()
    const toStr = toDateTimePickerValue(now.toISOString())
    if (p === 'daily') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      return { from: toDateTimePickerValue(start.toISOString()), to: toStr }
    }
    if (p === 'weekly') {
      const dayOfWeek = now.getDay()
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0)
      return { from: toDateTimePickerValue(start.toISOString()), to: toStr }
    }
    if (p === 'monthly') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      return { from: toDateTimePickerValue(start.toISOString()), to: toStr }
    }
    if (p === 'yearly') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
      return { from: toDateTimePickerValue(start.toISOString()), to: toStr }
    }
    return {
      from: toDateTimePickerValue(customFrom) || customFrom,
      to: toDateTimePickerValue(customTo) || customTo,
    }
  }

  const { from: activeFrom, to: activeTo } = useMemo(
    () => getPeriodRange(period),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, customFrom, customTo],
  )
  const apiFrom = toApiDateParam(activeFrom)
  const apiTo = toApiDateParam(activeTo)

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard.snapshot({ from: activeFrom, to: activeTo, departmentId: activeDeptId }),
    queryFn: () => api.getDashboard(apiFrom, apiTo),
    refetchInterval: 60_000,
  })

  // Pie/kart navigasyonundan dönüşte scroll konumunu geri yükle (#r545 / #17).
  // Desktop scroll `main#main-content`; içerik boyu oturana kadar birkaç kez dene.
  useEffect(() => {
    const raw = sessionStorage.getItem(DASHBOARD_SCROLL_KEY)
    if (raw == null) return
    const top = Number(raw)
    if (!Number.isFinite(top)) {
      sessionStorage.removeItem(DASHBOARD_SCROLL_KEY)
      return
    }
    const restore = () => {
      const el = getDashboardScrollEl()
      if (el) el.scrollTop = top
    }
    restore()
    const timers = [0, 50, 120, 300, 600, 1000].map(ms => window.setTimeout(restore, ms))
    const clearTimer = window.setTimeout(() => {
      sessionStorage.removeItem(DASHBOARD_SCROLL_KEY)
    }, 1200)
    return () => {
      timers.forEach(id => window.clearTimeout(id))
      window.clearTimeout(clearTimer)
    }
  }, [dashboardQuery.isFetched, dashboardQuery.dataUpdatedAt])

  // Modüler lisans (#WGDYIM79 / #MHrIEwuE): Anasayfa-Vatandaş bölümü Vatandaş modülüne, Atanmış/Rutin ayrımı Kurum İçi modülüne bağlı.
  const isInternalModuleUsable = isModuleUsable('internal')
  const canSeeCitizenChannels = isModuleUsable('citizen')
    && (role === 'SystemAdmin' || role === 'Manager' || role === 'Operator' || role === 'Reporter')
  const citizenChannelQuery = useQuery({
    queryKey: queryKeys.dashboard.citizenChannels({ from: activeFrom, to: activeTo, departmentId: activeDeptId }),
    queryFn: () => api.getCitizenChannelChart(apiFrom, apiTo),
    enabled: canSeeCitizenChannels,
    refetchInterval: 60_000,
  })

  const isManagerOrAdmin = role === 'Manager' || role === 'SystemAdmin'
  const statusChartsQuery = useQuery({
    queryKey: queryKeys.dashboard.statusCharts({
      from: activeFrom,
      to: activeTo,
      departmentId: activeDeptId,
      staffTaskType: taskChartFilters['dashboard.charts.staffTasks'],
      myTaskType: taskChartFilters['dashboard.charts.myTasks'],
    }),
    queryFn: () => api.getDashboardStatusCharts(apiFrom, apiTo, {
      staff: taskChartFilters['dashboard.charts.staffTasks'],
      mine: taskChartFilters['dashboard.charts.myTasks'],
    }),
    enabled: true,
    refetchInterval: 60_000,
  })

  const myPendingRequestsMetricValue = useMemo(() => {
    if (!dashboardQuery.data) return undefined
    const chart = statusChartsQuery.data?.charts.find(item => item.titleKey === 'dashboard.charts.myRequests')
    if (!chart) return dashboardQuery.data.myPendingRequestCount
    const pendingLabel = isManagerOrAdmin
      ? 'dashboard.chart.externalPendingApproval'
      : 'dashboard.chart.pending'
    return chart.slices.find(slice => slice.label === pendingLabel)?.value ?? 0
  }, [dashboardQuery.data, statusChartsQuery.data, isManagerOrAdmin])

  const myOverdueRequestsMetricValue = useMemo(() => {
    if (!dashboardQuery.data) return undefined
    const chart = statusChartsQuery.data?.charts.find(item => item.titleKey === 'dashboard.charts.myRequests')
    if (!chart) return 0
    return chart.slices.find(slice => slice.label === 'dashboard.chart.overdue')?.value ?? 0
  }, [dashboardQuery.data, statusChartsQuery.data])

  const myOverdueTasksMetricValue = useMemo(() => {
    if (!dashboardQuery.data) return undefined
    const chart = statusChartsQuery.data?.charts.find(item => item.titleKey === 'dashboard.charts.myTasks')
    if (!chart) return 0
    return chart.slices.find(slice => slice.label === 'dashboard.chart.overdue')?.value ?? 0
  }, [dashboardQuery.data, statusChartsQuery.data])

  const myPendingTasksMetricValue = useMemo(() => {
    if (!dashboardQuery.data) return undefined
    const chart = statusChartsQuery.data?.charts.find(item => item.titleKey === 'dashboard.charts.myTasks')
    if (!chart) return dashboardQuery.data.myPendingTaskNavBadgeCount
    return chart.slices.find(slice => slice.label === 'dashboard.chart.pending')?.value ?? 0
  }, [dashboardQuery.data, statusChartsQuery.data])

  // Hook'lardan sonra redirect — erken return rules-of-hooks bozar (CI lint).
  if (effectiveView === 'citizen' && !isModuleUsable('citizen')) {
    return <Navigate to={role === 'Operator' ? '/dashboard/birimler' : '/citizen-directory'} replace />
  }

  if (effectiveView === 'departments' && role === 'Reporter' && !isModuleUsable('internal')) {
    return <Navigate to={isModuleUsable('citizen') ? '/dashboard' : '/citizen-directory'} replace />
  }

  // Üst Düzey Yönetici (Reporter) yalnızca talep oluşturur; "Bekleyen Görevlerim" gösterilmez.
  const isReporter = role === 'Reporter'
  const isCitizenDashboardDrilldownRole = role === 'Reporter' || role === 'Operator' || role === 'SystemAdmin'
  const hideMetricCards = effectiveView === 'citizen'
    || (effectiveView === 'departments' && role !== 'Operator')

  const managerTaskMetricRow: MetricCard[] = !hideMetricCards && isManagerOrAdmin && dashboardQuery.data
    ? [
        {
          label: t('dashboard.cards.deptPendingTasks', 'Birimdeki Görevler'),
          sublabel: t('dashboard.cards.deptPendingTasksSub', 'Bekleyen Görevler'),
          value: dashboardQuery.data.deptPendingTaskCount,
          icon: SquareKanban,
          path: '/department-tasks?flow=all',
          iconBg: 'bg-emerald-100',
          iconColor: 'text-emerald-600',
        },
        {
          label: t('dashboard.cards.myPendingTasks', 'Bekleyen Görevlerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: myPendingTasksMetricValue ?? dashboardQuery.data.myPendingTaskNavBadgeCount,
          icon: ListChecks,
          path: '/my-tasks?view=pending',
          iconBg: 'bg-violet-100',
          iconColor: 'text-violet-600',
        },
        {
          label: t('tasks.myViews.overdue', 'Geciken Görevlerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: myOverdueTasksMetricValue ?? 0,
          icon: Clock3,
          path: '/my-tasks?view=overdue',
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
        },
      ]
    : []

  const managerBottomMetricRow: MetricCard[] = !hideMetricCards && isManagerOrAdmin && dashboardQuery.data
    ? [
        {
          label: t('dashboard.cards.activeMessages', 'Vatandaş Talepleri'),
          sublabel: t('dashboard.cards.citizenPendingApprovalSub', 'Onay Bekleyen'),
          value: dashboardQuery.data.activeSocialMessageCount,
          icon: MessageSquareMore,
          path: '/incoming-requests?citizen=1&status=processing-received',
          iconBg: 'bg-rose-100',
          iconColor: 'text-rose-600',
        },
        ...(isInternalModuleUsable ? [{
          label: t('dashboard.cards.myPendingRequests', 'Bekleyen Taleplerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: myPendingRequestsMetricValue ?? dashboardQuery.data.myPendingRequestCount,
          icon: ClipboardList,
          path: '/my-requests?view=external-pending',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
        },
        {
          label: t('jobs.myViews.overdue', 'Geciken Taleplerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: myOverdueRequestsMetricValue ?? 0,
          icon: Clock3,
          path: '/my-requests?view=overdue',
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
        }] as MetricCard[] : []),
      ]
    : []

  const useStaffMetricFourCol = !isManagerOrAdmin
    && role !== 'Reporter'
    && (role === 'Staff'
      || role === 'Operator'
      || hasCitizenRequestManagerRole(currentUser)
      || getEffectiveUserRoles(currentUser).includes('Operator'))

  const managerRowHead = managerTaskMetricRow
  const managerRowTail = managerBottomMetricRow

  const staffMetrics: MetricCard[] = !hideMetricCards && !isManagerOrAdmin && dashboardQuery.data
    ? [
        ...(isReporter ? [] : [{
          label: t('dashboard.cards.myPendingTasks', 'Bekleyen Görevlerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: myPendingTasksMetricValue ?? dashboardQuery.data.myPendingTaskNavBadgeCount,
          icon: ListChecks,
          path: '/my-tasks?view=pending',
          iconBg: 'bg-violet-100',
          iconColor: 'text-violet-600',
        },
        {
          label: t('tasks.myViews.overdue', 'Geciken Görevlerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: myOverdueTasksMetricValue ?? 0,
          icon: Clock3,
          path: '/my-tasks?view=overdue',
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
        }]),
        ...(isInternalModuleUsable ? [{
          label: t('dashboard.cards.myPendingRequests', 'Bekleyen Taleplerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: myPendingRequestsMetricValue ?? dashboardQuery.data.myPendingRequestCount,
          icon: ClipboardList,
          path: '/my-requests?view=pending',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-600',
        },
        {
          label: t('jobs.myViews.overdue', 'Geciken Taleplerim'),
          sublabel: t('dashboard.cards.internalExternalSub', '(Birim İçi/Birim Dışı)'),
          value: myOverdueRequestsMetricValue ?? 0,
          icon: Clock3,
          path: '/my-requests?view=overdue',
          iconBg: 'bg-orange-100',
          iconColor: 'text-orange-600',
        }] : []),
      ]
    : []

  const staffMetricGridClass = useStaffMetricFourCol
    ? (staffMetrics.length >= 4 ? 'max-w-7xl sm:grid-cols-4' : 'max-w-7xl sm:grid-cols-2')
    : 'max-w-3xl sm:grid-cols-2'

  // Yönetici dashboard'unda her grafik, üst bölümdeki ilgili hızlı erişim
  // kartlarının aynı dönem verisini kullanır. Böylece sayı ve görsel özet
  // birbirinden kopmaz.
  const statusCharts = statusChartsQuery.data?.charts ?? []
  const citizenAggregateCharts = effectiveView === 'citizen'
    ? [
        buildCitizenEntityAggregateChart(
          'dashboard.charts.neighborhoodAllRequests',
          statusCharts,
          CITIZEN_SOURCE_CHART_KEYS.neighborhoodAll,
        ),
        buildCitizenEntityAggregateChart(
          'dashboard.charts.citizenDepartmentAllRequests',
          statusCharts,
          CITIZEN_SOURCE_CHART_KEYS.departmentAll,
        ),
        buildCitizenEntityAggregateChart(
          'dashboard.charts.neighborhoodOpenRequests',
          statusCharts,
          CITIZEN_SOURCE_CHART_KEYS.neighborhoodOpen,
        ),
        buildCitizenEntityAggregateChart(
          'dashboard.charts.citizenDepartmentOpenRequests',
          statusCharts,
          CITIZEN_SOURCE_CHART_KEYS.departmentOpen,
        ),
      ]
    : []
  const chartCards = [
    ...statusCharts,
    ...citizenAggregateCharts,
    ...(canSeeCitizenChannels && citizenChannelQuery.data ? [citizenChannelQuery.data] : []),
  ].filter(card => {
    if (REMOVED_PIE_CHART_KEYS.has(card.titleKey)) {
      return false
    }
    if (!isInternalModuleUsable && (
      card.titleKey === 'dashboard.charts.myRequests'
      || card.titleKey === 'dashboard.charts.outgoingRequests'
    )) {
      return false
    }
    if (effectiveView === 'citizen') {
      return CITIZEN_DASHBOARD_CHART_KEYS.has(card.titleKey)
    }
    if (effectiveView === 'departments') {
      if (isReporter) return REPORTER_DEPARTMENT_CHART_KEYS.has(card.titleKey)
      if (role === 'Operator') return OPERATOR_DEPARTMENT_CHART_KEYS.has(card.titleKey)
      return false
    }
    // Unified (non-split) dashboard: Reporter still hides task charts.
    return !isReporter || card.titleKey !== 'dashboard.charts.myTasks'
  })

  // Anasayfa - Vatandaş: mahalle/birim tüm + açık birleşik pie'lar; durum üçlülerinden yalnız Tamamlanan kalır (#2979).
  if (effectiveView === 'citizen') {
    chartCards.sort((a, b) => citizenChartOrder(a.titleKey) - citizenChartOrder(b.titleKey))
  }
  if (effectiveView === 'departments' && isReporter) {
    chartCards.sort((a, b) => reporterDepartmentChartOrder(a.titleKey) - reporterDepartmentChartOrder(b.titleKey))
  }

  const pageTitle = effectiveView === 'citizen'
    ? t('dashboard.citizenPanelTitle', 'Vatandaş Paneli')
    : effectiveView === 'departments'
      // Vatandaş operatörü: birim anasayfa banner = "Anasayfa" (#6a75bed6).
      ? (role === 'Operator' ? t('nav.dashboard', 'Anasayfa') : t('nav.dashboardDepartments', 'Anasayfa - Birimler'))
      : t('dashboard.title')

  function renderCard(metric: MetricCard) {
    const Icon = metric.icon
    const [basePath, queryString] = metric.path.split('?')
    const existingParams = queryString
      ? Object.fromEntries(new URLSearchParams(queryString).entries())
      : {}
    const dateParams = periodQueryParams(activeFrom, activeTo)
    const taskTypeExtra: Record<string, string | undefined> = {}
    if (basePath === '/my-tasks' || basePath === '/department-tasks' || basePath === '/staff-tasks') {
      const chartKey = basePath === '/staff-tasks'
        ? 'dashboard.charts.staffTasks'
        : 'dashboard.charts.myTasks'
      const taskType = taskChartFilters[chartKey]
      if (taskType !== 'all') taskTypeExtra.taskType = taskType
    }
    return (
      <button
        key={metric.label}
        type="button"
        className="flex w-full min-w-[15.5rem] items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white px-4 py-3 text-left shadow-[var(--shadow-edge)] transition-colors hover:border-[color:var(--color-primary)]/30 hover:shadow-md cursor-pointer"
        onClick={() => {
          saveDashboardScroll()
          navigate(withQueryParams(basePath, pieQueryParams({ ...existingParams, ...dateParams, ...taskTypeExtra })))
        }}
      >
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${metric.iconBg} ${metric.iconColor}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[0.72rem] font-semibold uppercase leading-snug tracking-[0.08em] text-[color:var(--color-muted-foreground)]">
            {metric.label}
          </div>
          {metric.sublabel ? (
            <div className="text-[0.72rem] font-medium normal-case tracking-normal text-[color:var(--color-muted-foreground)]">
              {metric.sublabel}
            </div>
          ) : null}
        </div>
        <span className="shrink-0 text-lg font-bold leading-none tabular-nums text-slate-900">{metric.value ?? '...'}</span>
      </button>
    )
  }

  return (
    <div className="page-stack desktop-page-shell shrink-0">
      <section className="section-card p-0">
        <div
          className="grid gap-3 border-b border-white/10 px-4 py-3.5 text-white sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] rounded-t-[var(--radius-xl)] lg:rounded-t-[0.85rem]"
          style={{ background: 'linear-gradient(135deg, var(--color-header-from), var(--color-header-to))' }}
        >
          <div className="space-y-1">
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/70">{t('dashboard.liveSummary')}</div>
            <h1 className="page-title !text-white">{pageTitle}</h1>
            <p className="max-w-3xl text-sm leading-6 text-white/82">
              {effectiveView === 'citizen'
                ? t('dashboard.citizenSubtitle', 'Vatandaştan gelen talepleri durumlarına göre takip edin.')
                : t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex items-start justify-start lg:justify-end">
            <StatusPill tone="info" className="bg-white/12 text-white ring-white/15">
              {dashboardQuery.isFetching ? t('common.refreshing') : t('dashboard.liveSummary')}
            </StatusPill>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5 border-b border-[var(--color-border)] bg-[var(--color-background)]">
          <span className="text-xs font-semibold text-[color:var(--color-muted-foreground)] uppercase tracking-wide mr-1">
            {t('dashboard.period.label', 'Dönem')}:
          </span>
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                period === p
                  ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white'
                  : 'border-[var(--color-border)] bg-white text-slate-600 hover:border-[color:var(--color-primary)]/50'
              }`}
            >
              {t(`dashboard.period.${p}`, { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', yearly: 'Yıllık' }[p])}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPeriod('custom')}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
              period === 'custom'
                ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white'
                : 'border-[var(--color-border)] bg-white text-slate-600 hover:border-[color:var(--color-primary)]/50'
            }`}
          >
            {t('dashboard.period.custom', 'Özel')}
          </button>
          {period === 'custom' && (
            <>
              <ScopeChipDateRange from={customFrom} to={customTo} onFromChange={setCustomFrom} onToChange={setCustomTo} forceDown />
            </>
          )}
          {effectiveView === 'citizen' ? (
            <button
              type="button"
              onClick={() => setAllCitizenRequestsOpen(true)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-[color:var(--color-primary)]/50"
            >
              {t('dashboard.allCitizenRequests', 'Tüm Talepler')}
            </button>
          ) : null}
          {effectiveView === 'departments' ? (
            <button
              type="button"
              onClick={() => setAllDepartmentRequestsOpen(true)}
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-[color:var(--color-primary)]/50"
            >
              {t('dashboard.allCitizenRequests', 'Tüm Talepler')}
            </button>
          ) : null}
        </div>

        {hideMetricCards ? null : isManagerOrAdmin ? (
          <div className="px-5 py-3.5 sm:px-8">
            {dashboardQuery.isLoading
              ? (
                <>
                  <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-[72px] min-w-[15.5rem] animate-pulse rounded-[var(--radius-xl)] bg-slate-100" />
                    ))}
                  </div>
                  <div className="mx-auto mt-2 flex max-w-7xl flex-wrap justify-center gap-x-12">
                    {Array.from({ length: isInternalModuleUsable ? 3 : 1 }).map((_, i) => (
                      <div key={i} className="h-[72px] w-full min-w-[15.5rem] max-w-[calc((100%-9rem)/4)] animate-pulse rounded-[var(--radius-xl)] bg-slate-100 sm:max-w-[calc((100%-3rem)/2)]" />
                    ))}
                  </div>
                </>
              )
              : (
                <>
                  <div className="mx-auto grid max-w-7xl gap-x-12 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                    {managerRowHead.map(renderCard)}
                  </div>
                  {managerRowTail.length > 0 ? (
                    <div className="mx-auto mt-2 flex max-w-7xl flex-wrap justify-center gap-x-12 [&>button]:w-full [&>button]:min-w-[15.5rem] [&>button]:sm:max-w-[calc((100%-3rem)/2)] [&>button]:lg:max-w-[calc((100%-9rem)/4)]">
                      {managerRowTail.map(renderCard)}
                    </div>
                  ) : null}
                </>
              )}
          </div>
        ) : (
          <div className="px-5 py-3.5 sm:px-8">
            {useStaffMetricFourCol && staffMetrics.length >= 4 ? (
              <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-12 gap-y-2 [&>button]:w-full [&>button]:min-w-[15.5rem] [&>button]:sm:max-w-[calc((100%-3rem)/2)] [&>button]:lg:max-w-[calc((100%-9rem)/4)]">
                {dashboardQuery.isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-[72px] w-full min-w-[15.5rem] animate-pulse rounded-[var(--radius-xl)] bg-slate-100 sm:max-w-[calc((100%-3rem)/2)] lg:max-w-[calc((100%-9rem)/4)]" />
                    ))
                  : staffMetrics.map(renderCard)}
              </div>
            ) : (
              <div className={`mx-auto grid gap-x-12 gap-y-2 ${staffMetricGridClass}`}>
                {dashboardQuery.isLoading
                  ? Array.from({ length: useStaffMetricFourCol ? 4 : 2 }).map((_, i) => (
                      <div key={i} className="h-[72px] animate-pulse rounded-[var(--radius-xl)] bg-slate-100" />
                    ))
                  : staffMetrics.map(renderCard)}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(statusChartsQuery.isLoading || dashboardQuery.isLoading) && chartCards.length === 0
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="section-card p-4 sm:p-5">
                <div className="mb-4 h-4 w-40 animate-pulse rounded bg-slate-100" />
                <div className="flex items-center gap-4">
                  <div className="size-40 animate-pulse rounded-full bg-slate-100" />
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                    ))}
                  </div>
                </div>
              </div>
            ))
          : chartCards.length === 0 && !statusChartsQuery.isLoading && !dashboardQuery.isLoading
            ? (
              <div className="section-card col-span-full p-4 text-sm text-slate-600 sm:p-5">
                {statusChartsQuery.isError
                  ? (statusChartsQuery.error instanceof Error ? statusChartsQuery.error.message : t('common.error'))
                  : t('dashboard.chart.noData', 'Grafik verisi bulunamadı.')}
              </div>
            )
          : chartCards.map(card => {
            // Standart kullanıcıların erişemediği "Birimdeki Görevler" ile Üst Düzey Yönetici'ye
            // özel birim-dışı dağılım grafikleri (card #835/#763) yalnızca bilgilendirme amaçlıdır;
            // dashboard'dan yönlendirme yapılmaz.
            const isExternalDrilldownOnlyChart =
              card.titleKey === 'dashboard.charts.citizenRequests'
              || card.titleKey === 'dashboard.charts.externalRequestCreators'
              || card.titleKey === 'dashboard.charts.externalRequestPending'
              || card.titleKey === 'dashboard.charts.externalRequestInProgress'
              || card.titleKey === 'dashboard.charts.externalRequestFulfillers'
              || card.titleKey === 'dashboard.charts.externalProjectsInProgress'
              || card.titleKey === 'dashboard.charts.externalProjectsCompleted'
              || card.titleKey === 'dashboard.charts.neighborhoodCompletedRequests'
              || card.titleKey === 'dashboard.charts.neighborhoodInProgressRequests'
              || card.titleKey === 'dashboard.charts.neighborhoodProcessingRequests'
              || card.titleKey === 'dashboard.charts.citizenDepartmentProcessingRequests'
              || card.titleKey === 'dashboard.charts.citizenDepartmentInProgressRequests'
              || card.titleKey === 'dashboard.charts.citizenDepartmentCompletedRequests'
              || card.titleKey === 'dashboard.charts.neighborhoodAllRequests'
              || card.titleKey === 'dashboard.charts.neighborhoodOpenRequests'
              || card.titleKey === 'dashboard.charts.citizenDepartmentAllRequests'
              || card.titleKey === 'dashboard.charts.citizenDepartmentOpenRequests'
              || card.titleKey === 'dashboard.charts.requestTags'
              // Operatör: kanal dilimi popup değil → Vatandaş Talepleri grid (#6a6eeb56).
              || (isCitizenDashboardDrilldownRole && role !== 'Operator' && card.titleKey === 'dashboard.citizenChannels.title')
            // Üst Düzey Yönetici'de Taleplerim hariç tüm grafik dilimleri detay popup'ı açar (card #1343/#1860).
            // Operatör kanal pie → navigate /social?channel= (#6a6eeb56); diğer roller drilldown popup.
            const isDrilldownChart = isCitizenDashboardDrilldownRole
              && DRILLDOWN_CHART_KEYS.has(card.titleKey)
              && !(role === 'Operator' && card.titleKey === 'dashboard.citizenChannels.title')
            const chartRoute = isExternalDrilldownOnlyChart ? undefined : CHART_ROUTES[card.titleKey]
            const chartKey = card.titleKey as TaskChartKey
            const taskFilter = TASK_CHART_KEYS.has(chartKey) ? taskChartFilters[chartKey] : undefined
            const periodRange = { from: activeFrom, to: activeTo }
            const chartTitleIcon = getDashboardChartTitleIcon(card.titleKey)
            const ChartTitleIcon = chartTitleIcon
            const chartTitleIconClass = card.titleKey === 'dashboard.charts.requestTags' && role === 'Staff'
              ? 'size-3.5 shrink-0 text-emerald-600'
              : 'size-3.5 shrink-0 text-slate-500'
            return (
            <section key={card.titleKey} className="section-card relative overflow-hidden p-4 sm:p-5">
              <div className="relative z-10 mb-4 flex items-center justify-between gap-3">
                {chartRoute ? (
                  <button
                    type="button"
                    onClick={() => {
                      saveDashboardScroll()
                      navigate(withQueryParams(chartRoute, {
                        taskType: taskFilter && taskFilter !== 'all' ? taskFilter : undefined,
                        ...periodQueryParams(activeFrom, activeTo),
                      }))
                    }}
                    className="flex cursor-pointer items-center gap-1.5 border-b border-slate-200 pb-0.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:text-[color:var(--color-primary)]"
                  >
                    {ChartTitleIcon ? <ChartTitleIcon className={chartTitleIconClass} aria-hidden="true" /> : null}
                    <span>{t(card.titleKey)}</span>
                  </button>
                ) : (
                  <h2 className="flex items-center gap-1.5 border-b border-slate-200 pb-0.5 text-sm font-semibold text-slate-700">
                    {ChartTitleIcon ? <ChartTitleIcon className={chartTitleIconClass} aria-hidden="true" /> : null}
                    <span>{t(card.titleKey)}</span>
                  </h2>
                )}
                <div className="flex shrink-0 items-center gap-2">
                  {/* Görev tipi filtre butonları standart kullanıcılarda da görünür (Görevlerim + Birimdeki Görevler) (card 762). */}
                  {/* Atanmış/Rutin ayrımı birim-içi iş takibine özgü — Vatandaş modülü tek başına lisanslıyken gizlenir (#MHrIEwuE). */}
                  {isInternalModuleUsable && TASK_CHART_KEYS.has(card.titleKey as TaskChartKey) && (
                    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={t('tasks.filters.taskType', 'Görev tipi')}>
                      {(['assigned', 'routine', 'all'] as const).map(filter => {
                        const active = taskChartFilters[chartKey] === filter
                        return (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setTaskChartFilters(current => ({ ...current, [chartKey]: filter }))}
                            className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${active ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            {t(`dashboard.taskFilter.${filter}`, { assigned: 'Atanmış', routine: 'Rutin', all: 'Tümü' }[filter])}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {/* Ara... başlık satırı sağı (R550). Talep Etiketi de aynı satır (#2606). */}
                  {PIE_LEGEND_SEARCH_KEYS.has(card.titleKey) ? (
                    <PieLegendSearch
                      value={pieLegendSearches[card.titleKey] ?? ''}
                      onChange={value => setPieLegendSearches(current => ({ ...current, [card.titleKey]: value }))}
                    />
                  ) : null}
                </div>
              </div>
              <PieChart
                slices={card.slices}
                noDataLabel={t('dashboard.chart.noData')}
                showZeroSlices
                legendSearch={pieLegendSearches[card.titleKey] ?? ''}
                formatSliceLabel={
                  (role === 'Staff' || role === 'Operator') && card.titleKey === 'dashboard.charts.myRequests'
                    ? (raw, translate) => (raw === 'dashboard.chart.approved'
                      ? translate('dashboard.chart.approvedOrInProgress', 'Onaylanan/Yapılmakta')
                      : undefined)
                    : undefined
                }
                onSelect={isDrilldownChart ? slice => {
                setChartDrilldown({ chartKey: card.titleKey, sliceKey: slice.label })
              } : isExternalDrilldownOnlyChart ? undefined : slice => {
                const route = getSliceRoute(card.titleKey, slice.label, taskFilter, periodRange, {
                  citizenChannelsToIncoming: isManagerOrAdmin,
                })
                if (route) {
                  saveDashboardScroll()
                  navigate(route)
                }
              }} isSliceSelectable={isDrilldownChart || isExternalDrilldownOnlyChart
                ? undefined
                // Rotası olmayan dilim (örn. Birimdeki Görevler) tıklanabilir görünmesin (card #1337).
                : slice => Boolean(getSliceRoute(card.titleKey, slice.label, taskFilter, periodRange, {
                  citizenChannelsToIncoming: isManagerOrAdmin,
                }))} />
              </section>
            )
          })}
      </section>

      {dashboardQuery.isError ? (
        <div className="error">{dashboardQuery.error instanceof Error ? dashboardQuery.error.message : t('common.error')}</div>
      ) : null}
      {statusChartsQuery.isError ? (
        <div className="error">{statusChartsQuery.error instanceof Error ? statusChartsQuery.error.message : t('common.error')}</div>
      ) : null}

      {allCitizenRequestsOpen ? (
        <AllCitizenRequestsModal onClose={() => setAllCitizenRequestsOpen(false)} />
      ) : null}
      {allDepartmentRequestsOpen ? (
        <AllDepartmentRequestsModal onClose={() => setAllDepartmentRequestsOpen(false)} />
      ) : null}
      {chartDrilldown?.chartKey === 'dashboard.citizenChannels.title' ? (
        <CitizenChannelMessagesModal
          key={`${chartDrilldown.chartKey}|${chartDrilldown.sliceKey}`}
          sliceKey={chartDrilldown.sliceKey}
          from={apiFrom}
          to={apiTo}
          jobDetailTitle={t('jobs.taskType.CitizenRequest', 'Vatandaş Talebi')}
          onClose={() => setChartDrilldown(null)}
        />
      ) : chartDrilldown ? (
        <DashboardChartDrilldownModal
          key={`${chartDrilldown.chartKey}|${chartDrilldown.sliceKey}`}
          chartKey={chartDrilldown.chartKey}
          sliceKey={chartDrilldown.sliceKey}
          from={apiFrom}
          to={apiTo}
          jobDetailTitle={
            effectiveView === 'citizen'
              ? t('jobs.taskType.CitizenRequest', 'Vatandaş Talebi')
              : effectiveView === 'departments'
                ? t('dashboard.pieJobDetailTitle', 'Talep')
                : undefined
          }
          onClose={() => setChartDrilldown(null)}
        />
      ) : null}
    </div>
  )
}
