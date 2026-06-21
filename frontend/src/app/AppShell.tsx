import { ArrowUpRight, BookOpen, Building, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDot, ClipboardList, ClipboardPlus, ClipboardCheck, CheckCircle2, Clock3, FolderKanban, Home, Inbox, KeyRound, LayoutDashboard, ListChecks, LogOut, Mail, Menu, MonitorUp, MessageSquareMore, ScrollText, Settings2, SquareKanban, Users, Workflow, X, XCircle } from 'lucide-react'
import { AppFooter } from '../components/layout/AppFooter'
import { ScrollFab } from '../components/layout/ScrollFab'
import { ChangePasswordModal } from '../components/system/ChangePasswordModal'

declare const __APP_VERSION__: string
const SUPPORT_EMAIL = 'lumespecsoftware@gmail.com'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MunicipalitySeal } from '../components/branding/MunicipalitySeal'
import { GlobalSearchBar } from '../components/layout/GlobalSearchBar'
import { NotificationBell, type NotificationDetailTarget } from '../components/layout/NotificationBell'
import { TasksPage } from '../pages/TasksPage'
import { JobsPage } from '../pages/JobsPage'
import { SidebarNav, type SidebarNavItem, type SidebarNavLinkItem } from '../components/layout/SidebarNav'
import { Button } from '../components/ui/button'
import { useAuth } from '../context/AuthContext'
import { useTenantTheme } from '../context/ThemeContext'
import { api } from '../api/client'
import { getActiveDepartmentId, setActiveDepartmentId } from '../api/http'
import { queryKeys } from '../api/queryKeys'
import { canRoleAccessPage, ROLE_PAGE_ACCESS_EVENT, type PageAccessKey } from '../lib/rolePageAccess'
import type { DepartmentSummary } from '../types/platform'
import { getRoleLabel } from '../utils/localization'


function useResponsiveZoom() {
  const compute = useCallback(() => {
    const rawFrameWidth = Math.max(window.outerWidth || 0, window.innerWidth)
    const screenWidth = window.screen?.availWidth || window.screen?.width || 0
    // Browser zoom-out inflates CSS pixel width (for example 15.6" screens can look
    // like 1920px+ at 80%-90%). Cap by physical screen width when available so the
    // app does not jump into a large-monitor scale while the user changes browser zoom.
    const frameWidth = screenWidth > 0 && rawFrameWidth > screenWidth
      ? screenWidth
      : rawFrameWidth
    // 27" monitors can hover around the 1920px breakpoint when browser zoom moves
    // from 100% to 110%. When the browser is near full-width, use the stable screen
    // width so the app does not jump between layout scales.
    const w = screenWidth >= 1920 && frameWidth >= screenWidth * 0.7
      ? screenWidth
      : frameWidth
    // İçerik ölçeği, tarayıcı %100 yakınlaştırmadayken %90'daki gibi sığsın diye
    // bir ek 0.9 katsayısı içerir (card 375). Sidebar ölçeği aynı bırakıldı.
    if (w >= 2560) return { sidebar: 0.92, content: 0.79 }
    if (w >= 1920) return { sidebar: 1.0, content: 0.90 }
    if (w >= 1680) return { sidebar: 0.90, content: 0.86 }
    if (w >= 1440) return { sidebar: 0.84, content: 0.81 }
    return { sidebar: 0.78, content: 0.76 }
  }, [])
  const [zoom, setZoom] = useState(compute)
  useEffect(() => {
    const onResize = () => setZoom(compute())
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [compute])
  return zoom
}

export function AppShell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { appearance } = useTenantTheme()
  const zoom = useResponsiveZoom()
  const [accessVersion, setAccessVersion] = useState(0)
  const [activeDepartmentVersion, setActiveDepartmentVersion] = useState(0)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [activeDeptId, setActiveDeptId] = useState<string | null>(getActiveDepartmentId)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [notificationDetailTarget, setNotificationDetailTarget] = useState<NotificationDetailTarget | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const userDepartmentsQuery = useQuery({
    queryKey: queryKeys.departments.me(),
    queryFn: () => api.getMyDepartments(),
  })
  const userDepartments = useMemo(() => userDepartmentsQuery.data ?? [], [userDepartmentsQuery.data])

  useEffect(() => {
    if (!userDepartmentsQuery.data) return
    const currentDeptId = getActiveDepartmentId()
    if (userDepartments.length > 0 && (!currentDeptId || !userDepartments.some(d => d.departmentId === currentDeptId))) {
      const primary = userDepartments.find(d => d.isPrimary) ?? userDepartments[0]
      setActiveDepartmentId(primary.departmentId, true) // silent: don't trigger Outlet remount on initial load
      const frame = window.requestAnimationFrame(() => setActiveDeptId(primary.departmentId))
      return () => window.cancelAnimationFrame(frame)
    } else {
      const frame = window.requestAnimationFrame(() => setActiveDeptId(currentDeptId))
      return () => window.cancelAnimationFrame(frame)
    }
  }, [userDepartments, userDepartmentsQuery.data])

  useEffect(() => {
    const handler = () => setActiveDeptId(getActiveDepartmentId())
    window.addEventListener('activeDepartmentChanged', handler)
    return () => window.removeEventListener('activeDepartmentChanged', handler)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDeptSelect = (dept: DepartmentSummary) => {
    setActiveDepartmentId(dept.departmentId) // also fires activeDepartmentChanged → setActiveDepartmentVersion
    setActiveDeptId(dept.departmentId)
    setActiveDepartmentVersion(v => v + 1)   // direct increment ensures Outlet remounts and data re-fetches
    setIsUserMenuOpen(false)
  }

  useEffect(() => {
    const updateAccess = () => setAccessVersion(version => version + 1)
    window.addEventListener('storage', updateAccess)
    window.addEventListener(ROLE_PAGE_ACCESS_EVENT, updateAccess)
    return () => {
      window.removeEventListener('storage', updateAccess)
      window.removeEventListener(ROLE_PAGE_ACCESS_EVENT, updateAccess)
    }
  }, [])

  useEffect(() => {
    const updateActiveDepartment = () => setActiveDepartmentVersion(version => version + 1)
    window.addEventListener('activeDepartmentChanged', updateActiveDepartment)
    return () => window.removeEventListener('activeDepartmentChanged', updateActiveDepartment)
  }, [])

  const institutionName = user?.tenantName || 'Tire Belediyesi'
  const municipalityName = institutionName.replace(/\s+Belediyesi?$/i, '').trim()
  const logoUrl = appearance.logoUrl?.trim() || null
  const userDisplayName = user?.displayName || '-'
  const userRoleLabel = getRoleLabel(t, user?.role ?? '')
  // Yerel (Manual) kullanıcılar parolasını değiştirebilir; LDAP kullanıcıları dizinde yönetilir.
  const isLocalUser = (user?.userSource ?? '').toLowerCase() === 'manual'
  const canOpenUserMenu = userDepartments.length > 1 || isLocalUser
  const userInitials = userDisplayName
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  type NavLinkConfig = SidebarNavLinkItem & { pageKey?: PageAccessKey; requiredRole?: string }

  type NavLinkConfigEx = NavLinkConfig & { separatorAfter?: boolean; separatorBefore?: boolean }

  const navItemConfigs: NavLinkConfigEx[] = [
    { pageKey: 'dashboard' as const, path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, separatorAfter: true },
    { pageKey: 'createRequest' as const, path: '/requests/new', label: t('nav.createRequest', 'Talep Oluştur'), icon: ClipboardPlus },
    { pageKey: 'myRequests' as const, path: '/my-requests?view=pending', label: t('nav.myRequests', 'Taleplerim'), icon: ClipboardList },
    { pageKey: 'social' as const, path: '/social', label: t('nav.social'), icon: MessageSquareMore },
    { pageKey: 'incomingRequests' as const, path: '/incoming-requests?kind=all', label: t('nav.incomingRequests', 'Birime Gelen Talepler'), icon: FolderKanban },
    { path: '/outgoing-requests', label: t('nav.outgoingRequests', 'Birimden Giden Talepler'), icon: ArrowUpRight, requiredRole: 'Manager' },
    { pageKey: 'createRoutineTask' as const, path: '/routine-tasks/new', label: t('nav.createRoutineTask', 'Rutin Görev Oluştur'), icon: ClipboardCheck, separatorBefore: true },
    { pageKey: 'myTasks' as const, path: '/my-tasks?view=pending', label: t('nav.myTasks', 'Görevlerim'), icon: ListChecks },
    { path: '/department-tasks?flow=all', label: t('nav.departmentTasks', 'Birimdeki Görevler'), icon: SquareKanban, requiredRole: 'Manager' },
    { path: '/staff-tasks', label: t('nav.staffTasks', 'Personelimin Görevleri'), icon: Users, requiredRole: 'Manager' },
    { pageKey: 'display' as const, path: '/display', label: t('nav.display'), icon: MonitorUp, newTab: true, separatorBefore: true, separatorAfter: true },
    { pageKey: 'departments' as const, path: '/departments', label: t('nav.departments'), icon: Building },
    { pageKey: 'users' as const, path: '/users', label: t('nav.users'), icon: Users },
    { pageKey: 'settings' as const, path: '/settings', label: t('nav.settings'), icon: Settings2 },
    { pageKey: 'audit' as const, path: '/audit', label: t('nav.audit'), icon: ScrollText },
  ]

  const navItems = navItemConfigs.reduce<SidebarNavItem[]>((items, item) => {
    const canUse = item.requiredRole ? user?.role === item.requiredRole : item.pageKey ? canRoleAccessPage(user?.role, item.pageKey) : false
    if (canUse) {
      if (item.separatorBefore && items.length > 0) items.push({ type: 'separator' })
      items.push({ path: item.path, label: item.label, icon: item.icon, newTab: item.newTab })
      if (item.separatorAfter) items.push({ type: 'separator' })
    }
    return items
  }, [])
  void accessVersion

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const breadcrumbSegments = location.pathname.split('/').filter(Boolean)

  const viewParam = useMemo(() => new URLSearchParams(location.search).get('view') ?? '', [location.search])
  const requestKindParam = useMemo(() => new URLSearchParams(location.search).get('kind') ?? '', [location.search])

  const myRequestsViewLabels: Record<string, string> = {
    pending: t('nav.myRequestsPending', 'Bekleyen Taleplerim'),
    approved: t('nav.myRequestsApproved', 'Onaylanmış Taleplerim'),
    'in-progress': t('jobs.myViews.inProgress', 'Yapılmakta Olan Taleplerim'),
    overdue: t('jobs.myViews.overdue', 'Son Tarihi Geçmiş Taleplerim'),
    completed: t('jobs.myViews.completed', 'Tamamlanmış Taleplerim'),
    rejected: t('nav.myRequestsRejected', 'İptal Taleplerim'),
    all: t('nav.myRequestsAll', 'Tüm Taleplerim'),
  }
  const myRequestsViewIcons: Record<string, typeof LayoutDashboard> = {
    pending: Clock3,
    approved: CheckCircle2,
    'in-progress': Workflow,
    overdue: Clock3,
    completed: ClipboardCheck,
    rejected: XCircle,
    all: Inbox,
  }

  const myTasksViewLabels: Record<string, string> = {
    pending: t('nav.myTasksPending', 'Bekleyen Görevlerim'),
    completed: t('nav.myTasksCompleted', 'Tamamlanmış Görevlerim'),
    rejected: t('nav.myTasksRejected', 'İptal Görevlerim'),
    all: t('nav.myTasksAll', 'Tüm Görevlerim'),
  }
  const myTasksViewIcons: Record<string, typeof LayoutDashboard> = {
    pending: Clock3,
    completed: ClipboardCheck,
    rejected: XCircle,
    all: Inbox,
  }
  const outgoingRequestsViewLabels: Record<string, string> = {
    pending: t('jobs.outgoingViews.pending', 'Bekleyen Talepler'),
    approved: t('jobs.outgoingViews.approved', 'Onaylanmış Talepler'),
    'in-progress': t('jobs.outgoingViews.inProgress', 'Yapılmakta Olan Talepler'),
    overdue: t('jobs.outgoingViews.overdue', 'Son Tarihi Geçmiş Talepler'),
    completed: t('jobs.outgoingViews.completed', 'Tamamlanmış Talepler'),
    rejected: t('jobs.outgoingViews.rejected', 'Reddedilen/İptal Talepler'),
    all: t('jobs.outgoingViews.all', 'Tümü'),
  }
  const outgoingRequestsViewIcons: Record<string, typeof LayoutDashboard> = {
    pending: Clock3,
    approved: CheckCircle2,
    'in-progress': Workflow,
    overdue: Clock3,
    completed: ClipboardCheck,
    rejected: XCircle,
    all: Inbox,
  }
  const flowParam = useMemo(() => new URLSearchParams(location.search).get('flow') ?? '', [location.search])
  const departmentTasksViewLabels: Record<string, string> = {
    internal: t('nav.departmentTasksInternal', 'Birim İçi Oluşan Görevler'),
    external: t('nav.departmentTasksExternal', 'Birim Dışı Oluşan Görevler'),
    all: t('nav.departmentTasksAll', 'Birimde Oluşan Tüm Görevler'),
  }
  const departmentTasksViewIcons: Record<string, typeof LayoutDashboard> = {
    internal: SquareKanban,
    external: Workflow,
    all: CircleDot,
  }
  const requestKindLabels: Record<string, string> = {
    internal: t('requests.create.internalTitle', 'Birim İçi'),
    external: t('requests.create.externalTitle', 'Birim Dışı'),
    citizen: t('requests.create.citizenTitle', 'Vatandaş Talepleri'),
  }
  const requestKindIcons: Record<string, typeof LayoutDashboard> = {
    internal: SquareKanban,
    external: Workflow,
    citizen: MessageSquareMore,
  }

  const breadcrumbLabels: Record<string, string> = {
    dashboard: t('nav.dashboard'),
    requests: t('nav.createRequest', 'Talep Oluştur'),
    new: t('nav.createRequest', 'Talep Oluştur'),
    'my-tasks': (viewParam && myTasksViewLabels[viewParam]) || t('nav.myTasks', 'Görevlerim'),
    'my-requests': (viewParam && myRequestsViewLabels[viewParam]) || t('nav.myRequests', 'Taleplerim'),
    'outgoing-requests': (viewParam && outgoingRequestsViewLabels[viewParam]) || t('nav.outgoingRequests', 'Birimden Giden Talepler'),
    'department-tasks': (flowParam && departmentTasksViewLabels[flowParam]) || t('nav.departmentTasks', 'Birimdeki Görevler'),
    'staff-tasks': t('nav.staffTasks', 'Personelimin Görevleri'),
    'incoming-requests': t('nav.incomingRequestsAll', 'Birime Gelen Tüm Talepler'),
    tasks: t('nav.incomingRequests', 'Birime Gelen Talepler'),
    directorate: t('nav.jobs'),
    coordinated: t('nav.jobs'),
    jobs: t('nav.jobs'),
    display: t('nav.display'),
    social: t('nav.social'),
    departments: t('nav.departments'),
    users: t('nav.users'),
    audit: t('nav.audit'),
    settings: t('nav.settings'),
  }

  const breadcrumbParent: Record<string, string> = {
    'my-tasks': t('nav.myTasks', 'Görevlerim'),
    'my-requests': t('nav.myRequests', 'Taleplerim'),
    'outgoing-requests': t('nav.outgoingRequests', 'Birimden Giden Talepler'),
    'department-tasks': t('nav.departmentTasks', 'Birimdeki Görevler'),
    'staff-tasks': t('nav.staffTasks', 'Personelimin Görevleri'),
    'incoming-requests': t('nav.incomingRequests', 'Birime Gelen Talepler'),
    tasks: t('nav.incomingRequests', 'Birime Gelen Talepler'),
    directorate: t('nav.incomingRequests', 'Birime Gelen Talepler'),
    coordinated: t('nav.incomingRequests', 'Birime Gelen Talepler'),
    jobs: t('nav.incomingRequests', 'Birime Gelen Talepler'),
    display: t('nav.display'),
    social: t('nav.groupSocial'),
    departments: t('nav.groupAdmin'),
    users: t('nav.groupAdmin'),
    audit: t('nav.groupAdmin'),
    settings: t('nav.groupAdmin'),
  }

  const breadcrumbSkipSegments = new Set(['projects', 'requests'])

  const breadcrumbIcon: Record<string, typeof LayoutDashboard> = {
    dashboard: LayoutDashboard,
    requests: ClipboardPlus,
    new: ClipboardPlus,
    'my-tasks': (viewParam && myTasksViewIcons[viewParam]) || ListChecks,
    'my-requests': (viewParam && myRequestsViewIcons[viewParam]) || Clock3,
    'outgoing-requests': (viewParam && outgoingRequestsViewIcons[viewParam]) || ArrowUpRight,
    'department-tasks': (flowParam && departmentTasksViewIcons[flowParam]) || SquareKanban,
    'staff-tasks': Users,
    'incoming-requests': FolderKanban,
    tasks: SquareKanban,
    directorate: FolderKanban,
    coordinated: Workflow,
    jobs: FolderKanban,
    display: MonitorUp,
    social: MessageSquareMore,
    departments: Building,
    users: Users,
    audit: ScrollText,
    settings: Settings2,
  }
  const visibleBreadcrumbSegments = breadcrumbSegments.filter(segment => !breadcrumbSkipSegments.has(segment))
  const currentBreadcrumbSegment = visibleBreadcrumbSegments.at(-1)
  const requestKindBreadcrumbLabel = currentBreadcrumbSegment === 'new' ? requestKindLabels[requestKindParam] : null
  const currentBreadcrumbParent = currentBreadcrumbSegment ? (requestKindBreadcrumbLabel ? t('nav.createRequest', 'Talep Oluştur') : breadcrumbParent[currentBreadcrumbSegment]) : null
  const currentBreadcrumbLabel = currentBreadcrumbSegment ? requestKindBreadcrumbLabel || breadcrumbLabels[currentBreadcrumbSegment] || currentBreadcrumbSegment : null
  const CurrentBreadcrumbIcon = currentBreadcrumbSegment ? (requestKindBreadcrumbLabel ? requestKindIcons[requestKindParam] : breadcrumbIcon[currentBreadcrumbSegment]) : null

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[color:var(--color-sidebar)]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg">
        Skip to content
      </a>
      <div className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white/94 px-3 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="sidebar-chip text-slate-700"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label={t('nav.openMenu', 'Open menu')}
            >
              <Menu className="size-4.5" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">{institutionName}</div>
              <div className="truncate text-xs text-[color:var(--color-muted-foreground)]">{user?.displayName}</div>
            </div>
          </div>
          <Button variant="destructive" onClick={handleLogout} className="gap-2 px-5">
            <LogOut className="size-4.5" />
            {t('shell.logout')}
          </Button>
        </div>
      </div>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t('nav.navigation', 'Navigation')}
          onKeyDown={(e) => { if (e.key === 'Escape') setIsMobileNavOpen(false) }}>
          <button type="button" className="absolute inset-0 bg-slate-950/40" onClick={() => setIsMobileNavOpen(false)} aria-label="Close navigation" />
          <aside className="sidebar-shell relative z-10 flex h-full w-[88vw] max-w-[320px] flex-col p-3 shadow-2xl">
            <div className="relative rounded-[var(--radius-xl)] border border-white/8 bg-white/6 p-3">
              <div className="flex min-w-0 flex-col items-center gap-3 pr-12 text-center">
                <MunicipalitySeal compact alt={`${institutionName} logo`} src={logoUrl} />
                <div className="min-w-0">
                  <div className="text-2xl font-bold leading-tight break-words text-white text-center">{t('shell.subtitle', { municipalityName })}</div>
                </div>
              </div>
              <button type="button" className="sidebar-chip absolute right-3 top-3" onClick={() => setIsMobileNavOpen(false)} aria-label="Close menu">
                <X className="size-4" />
              </button>
            </div>
            <div className="sidebar-scroll-area mt-3 flex-1 overflow-y-auto">
              <SidebarNav items={navItems} onNavigate={() => setIsMobileNavOpen(false)} />
            </div>
            <div className="shrink-0 pt-2">
              <div className="rounded-[var(--radius-xl)] border border-white/8 bg-white/6 px-3 py-2.5">
                <p className="mb-2 text-center text-[0.55rem] font-bold tracking-[0.18em] text-white/25 uppercase select-none">
                  v{__APP_VERSION__}
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/10"
                >
                  <Mail className="size-5 shrink-0 text-white/60" />
                  <div className="min-w-0">
                    <p className="text-[0.58rem] font-bold uppercase tracking-wider text-white/30">
                      {t('shell.supportLine', 'Destek Hattı')}
                    </p>
                    <p className="truncate text-[0.72rem] font-bold text-white/55">{SUPPORT_EMAIL}</p>
                  </div>
                </a>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Main area: sidebar + content — fills remaining height */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
      <aside
        style={{ zoom: zoom.sidebar }}
        className={`sidebar-shell relative hidden h-full shrink-0 flex-col border-r px-2.5 py-2.5 transition-[width] duration-200 lg:flex ${isSidebarCollapsed ? 'w-[80px]' : 'w-[272px]'}`}
      >
        <img
          src="/header-ataturk.png"
          alt="Atatürk"
          className="absolute left-0 top-0 h-16 w-auto opacity-80 select-none pointer-events-none z-10"
        />
        <div className="flex h-full flex-col gap-2.5 rounded-[var(--radius-2xl)] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-2.5">
          <div className="relative rounded-[var(--radius-xl)] p-2.5">
            {!isSidebarCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <MunicipalitySeal alt={`${institutionName} logo`} src={logoUrl} className="w-full" />
                <div className="min-w-0 w-full text-center text-xs font-bold leading-tight break-words text-white">{t('shell.subtitle', { municipalityName })}</div>
              </div>
            ) : (
              <div className="flex justify-center">
                <MunicipalitySeal compact alt={`${institutionName} logo`} src={logoUrl} />
              </div>
            )}
          </div>

          <button
            type="button"
            className="sidebar-collapse-toggle hidden lg:inline-flex"
            onClick={() => setIsSidebarCollapsed(current => !current)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </button>

          <div className="sidebar-scroll-area flex-1 overflow-y-auto">
            <SidebarNav
              items={navItems}
              collapsed={isSidebarCollapsed}
            />
          </div>

          {/* Sidebar footer: version + support email */}
          <div className="shrink-0 border-t border-white/20 pt-2">
            {!isSidebarCollapsed ? (
              <div className="rounded-[var(--radius-xl)] border border-white/8 bg-white/6 px-3 py-2.5">
                <p className="mb-2 text-center text-[0.55rem] font-bold tracking-[0.18em] text-white/25 uppercase select-none">
                  v{__APP_VERSION__}
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/10"
                >
                  <Mail className="size-3.5 shrink-0 text-white/60" />
                  <span className="truncate text-[0.68rem] font-semibold text-white/55">{SUPPORT_EMAIL}</span>
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 pb-0.5">
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  title={t('shell.supportLine', 'Destek Hattı')}
                  className="flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-white/10"
                >
                  <Mail className="size-3.5 text-white/60" />
                </a>
                <span className="text-[0.5rem] font-bold uppercase tracking-widest text-white/22 select-none">
                  v{__APP_VERSION__}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex flex-1 min-w-0 min-h-0 flex-col">
      <div style={{ zoom: zoom.content }} className="app-content-shell my-2 mr-2 min-w-0 flex-1 overflow-x-clip rounded-2xl border border-[var(--color-border)] bg-white shadow-sm md:flex md:min-h-0 md:flex-col md:overflow-visible">
        <div className="relative z-40 hidden items-center justify-between border-b border-[var(--color-border)] bg-white/94 px-5 py-2 backdrop-blur lg:flex">
          <nav className="flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-1 text-sm text-[color:var(--color-muted-foreground)] shadow-sm" aria-label="Breadcrumb">
            <button type="button" className="inline-flex h-8 min-w-0 items-center gap-1 rounded-full px-2.5 font-semibold text-slate-600 hover:bg-white hover:text-slate-800" onClick={() => navigate('/dashboard')}>
              <Home className="size-4" />
              <span className="truncate">{t('nav.home')}</span>
            </button>
            {currentBreadcrumbParent ? (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-slate-300" />
                <span className="max-w-[14rem] truncate px-2 font-semibold text-slate-500">{currentBreadcrumbParent}</span>
              </>
            ) : null}
            {currentBreadcrumbLabel ? (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-slate-300" />
                <span className="inline-flex h-8 min-w-0 max-w-[18rem] items-center gap-1 rounded-full bg-white px-3 font-bold text-[color:var(--color-primary)] shadow-sm ring-1 ring-slate-200">
                  {CurrentBreadcrumbIcon ? <CurrentBreadcrumbIcon className="size-3.5 shrink-0" /> : null}
                  <span className="truncate">{currentBreadcrumbLabel}</span>
                </span>
              </>
            ) : null}
          </nav>
          <div className="flex items-center gap-3">
            <GlobalSearchBar />
            <NotificationBell onOpenDetail={setNotificationDetailTarget} />
            <a
              href="https://lumespec.com/apps/city-communication-center/guide/"
              target="_blank"
              rel="noopener noreferrer"
              title={t('shell.userGuide', 'Kullanım Kılavuzu')}
              className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 shadow-sm transition-colors hover:border-[color:var(--color-primary)]/40 hover:bg-[color:var(--color-primary)]/8 hover:text-[color:var(--color-primary)]"
            >
              <BookOpen className="size-4" />
            </a>
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => canOpenUserMenu && setIsUserMenuOpen(v => !v)}
                className={`flex min-w-0 max-w-[17rem] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 shadow-sm${canOpenUserMenu ? ' cursor-pointer transition-colors hover:border-slate-300 hover:shadow-md' : ' cursor-default'}`}
                title={`${userDisplayName} - ${user?.departmentName || userRoleLabel}`}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-xs font-black text-white">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-900">{userDisplayName}</div>
                  <div className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {userDepartments.length > 1
                      ? (userDepartments.find(d => d.departmentId === activeDeptId)?.name ?? user?.departmentName ?? userRoleLabel)
                      : (user?.departmentName || userRoleLabel)}
                  </div>
                </div>
                {canOpenUserMenu && (
                  <ChevronDown className={`size-3.5 shrink-0 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                )}
              </button>
              {isUserMenuOpen && canOpenUserMenu && (
                <div
                  role="menu"
                  aria-label={t('userMenu.label', 'Kullanıcı menüsü')}
                  className="absolute right-0 top-full z-50 mt-1.5 min-w-[220px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
                >
                  {userDepartments.length > 1 && (
                    <>
                      <div className="px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-slate-400">
                        {t('departmentSwitcher.heading', 'Görev Yaptığım Birimler')}
                      </div>
                      <div className="pb-1.5" role="listbox" aria-label={t('departmentSwitcher.label', 'Birim seçin')}>
                        {userDepartments.map(dept => {
                          const isActive = dept.departmentId === activeDeptId
                          return (
                            <button
                              key={dept.departmentId}
                              role="option"
                              aria-selected={isActive}
                              type="button"
                              onClick={() => handleDeptSelect(dept)}
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                            >
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-primary)]/10">
                                <Building className="size-4 text-[color:var(--color-primary)]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-slate-800">{dept.name}</div>
                                {dept.isPrimary ? (
                                  <div className="text-xs text-slate-400">{t('departmentSwitcher.primaryLabel', 'Asıl Birim')}</div>
                                ) : null}
                              </div>
                              {isActive ? <Check className="size-4 shrink-0 text-[color:var(--color-primary)]" /> : null}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                  {isLocalUser && (
                    <>
                      {userDepartments.length > 1 && <div className="border-t border-slate-100" />}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setIsUserMenuOpen(false); setIsChangePasswordOpen(true) }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                      >
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-primary)]/10">
                          <KeyRound className="size-4 text-[color:var(--color-primary)]" />
                        </div>
                        <div className="truncate text-sm font-semibold text-slate-800">
                          {t('changePassword.menuItem', 'Parolamı Değiştir')}
                        </div>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <Button variant="destructive" onClick={handleLogout} className="gap-2 px-5">
              <LogOut className="size-4.5" />
              {t('shell.logout')}
            </Button>
          </div>
        </div>
        <main id="main-content" className="flex min-h-[calc(100dvh-3.6rem)] w-full max-w-none flex-col px-3 py-3 sm:px-4 md:min-h-0 md:flex-1 md:overflow-y-auto lg:px-5 lg:py-3 xl:px-6 2xl:px-7">
          {breadcrumbSegments.length > 0 && location.pathname !== '/dashboard' ? (
            <div className="mb-2">
              <button type="button" className="back-button" onClick={() => navigate(-1)}>
                ← {t('common.back', 'Geri')}
              </button>
            </div>
          ) : null}
          <Outlet key={activeDepartmentVersion} />
        </main>
      </div>
      <AppFooter />
      </div>
      </div> {/* end main area row */}
      <ScrollFab />
      {isChangePasswordOpen && <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />}
      {notificationDetailTarget?.kind === 'task' && (
        <TasksPage
          fixedScope="mine"
          detailOnly
          notificationTaskId={notificationDetailTarget.id}
          onNotificationDetailClose={() => setNotificationDetailTarget(null)}
        />
      )}
      {notificationDetailTarget?.kind === 'job' && (
        <JobsPage
          mode="myRequests"
          detailOnly
          notificationJobId={notificationDetailTarget.id}
          onNotificationDetailClose={() => setNotificationDetailTarget(null)}
        />
      )}
    </div>
  )
}
