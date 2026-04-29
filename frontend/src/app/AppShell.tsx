import { Building, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, ClipboardCheck, ClipboardList, ClipboardPlus, Clock3, FolderKanban, Home, Inbox, LayoutDashboard, ListChecks, LogOut, Menu, MonitorUp, MessageSquareMore, ScrollText, Send, Settings2, SquareKanban, Users, Workflow, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MunicipalitySeal } from '../components/branding/MunicipalitySeal'
import { NotificationBell } from '../components/layout/NotificationBell'
import { SidebarNav, type SidebarNavItem, type SidebarNavLinkItem } from '../components/layout/SidebarNav'
import { Button } from '../components/ui/button'
import { useAuth } from '../context/AuthContext'
import { useTenantTheme } from '../context/ThemeContext'
import { canRoleAccessPage, ROLE_PAGE_ACCESS_EVENT, type PageAccessKey } from '../lib/rolePageAccess'
import { getRoleLabel } from '../utils/localization'

export function AppShell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { appearance } = useTenantTheme()
  const [accessVersion, setAccessVersion] = useState(0)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem('ccc_sidebar_collapsed') === 'true'
  })
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem('ccc_sidebar_collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  useEffect(() => {
    const updateAccess = () => setAccessVersion(version => version + 1)
    window.addEventListener('storage', updateAccess)
    window.addEventListener(ROLE_PAGE_ACCESS_EVENT, updateAccess)
    return () => {
      window.removeEventListener('storage', updateAccess)
      window.removeEventListener(ROLE_PAGE_ACCESS_EVENT, updateAccess)
    }
  }, [])

  const institutionName = user?.tenantName || 'Tire Belediyesi'
  const municipalityName = institutionName.replace(/\s+Belediyesi?$/i, '').trim()
  const logoUrl = appearance.logoUrl?.trim() || null
  const userDisplayName = user?.displayName || '-'
  const userRoleLabel = getRoleLabel(t, user?.role ?? '')
  const userInitials = userDisplayName
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  type NavLinkConfig = SidebarNavLinkItem & { pageKey: PageAccessKey }
  type NavGroupConfig = {
    type: 'group'
    label: string
    icon: typeof LayoutDashboard
    children: NavLinkConfig[]
  }
  type NavConfigItem = NavLinkConfig | NavGroupConfig

  const navItemConfigs: NavConfigItem[] = [
    { pageKey: 'dashboard' as const, path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { pageKey: 'createRequest' as const, path: '/requests/new', label: t('nav.createRequest', 'Talep Oluştur'), icon: ClipboardPlus },
    {
      type: 'group',
      label: t('nav.myRequests', 'Taleplerim'),
      icon: ClipboardList,
      children: [
        { pageKey: 'myRequests' as const, path: '/my-requests?view=created', label: t('nav.myRequestsCreated', 'Oluşturduğum Talepler'), icon: Send },
        { pageKey: 'myRequests' as const, path: '/my-requests?view=pending', label: t('nav.myRequestsPending', 'Bekleyen Taleplerim'), icon: Clock3 },
        { pageKey: 'myRequests' as const, path: '/my-requests?view=approved', label: t('nav.myRequestsApproved', 'Onaylanmış Taleplerim'), icon: CheckCircle2 },
        { pageKey: 'myRequests' as const, path: '/my-requests?view=rejected', label: t('nav.myRequestsRejected', 'Reddedilen/İptal Taleplerim'), icon: XCircle },
        { pageKey: 'myRequests' as const, path: '/my-requests?view=all', label: t('nav.myRequestsAll', 'Tüm Taleplerim'), icon: Inbox },
      ],
    },
    {
      type: 'group',
      label: t('nav.myTasks', 'Görevlerim'),
      icon: ListChecks,
      children: [
        { pageKey: 'myTasks' as const, path: '/my-tasks?view=pending', label: t('nav.myTasksPending', 'Bekleyen Görevlerim'), icon: Clock3 },
        { pageKey: 'myTasks' as const, path: '/my-tasks?view=completed', label: t('nav.myTasksCompleted', 'Tamamlanmış Görevlerim'), icon: ClipboardCheck },
        { pageKey: 'myTasks' as const, path: '/my-tasks?view=rejected', label: t('nav.myTasksRejected', 'Reddedilen/İptal Görevlerim'), icon: XCircle },
        { pageKey: 'myTasks' as const, path: '/my-tasks?view=all', label: t('nav.myTasksAll', 'Tüm Görevlerim'), icon: Inbox },
      ],
    },
    {
      type: 'group',
      label: t('nav.incomingRequests', 'Birime Gelen Talepler'),
      icon: FolderKanban,
      children: [
        { pageKey: 'tasks' as const, path: '/tasks', label: t('nav.incomingRequestsInternal', 'Birim İçi Gelen Talepler'), icon: SquareKanban },
        { pageKey: 'jobs' as const, path: '/jobs', label: t('nav.incomingRequestsExternal', 'Birim Dışı Gelen Talepler'), icon: Workflow },
        { pageKey: 'incomingRequests' as const, path: '/incoming-requests', label: t('nav.incomingRequestsAll', 'Birime Gelen Tüm Talepler'), icon: CircleDot },
      ],
    },
    { pageKey: 'social' as const, path: '/social', label: t('nav.social'), icon: MessageSquareMore },
    { pageKey: 'display' as const, path: '/display', label: t('nav.display'), icon: MonitorUp },
    { pageKey: 'departments' as const, path: '/departments', label: t('nav.departments'), icon: Building },
    { pageKey: 'users' as const, path: '/users', label: t('nav.users'), icon: Users },
    { pageKey: 'settings' as const, path: '/settings', label: t('nav.settings'), icon: Settings2 },
    { pageKey: 'audit' as const, path: '/audit', label: t('nav.audit'), icon: ScrollText },
  ]

  const navItems = navItemConfigs.reduce<SidebarNavItem[]>((items, item) => {
    if ('children' in item) {
      const children = item.children
        .filter(child => canRoleAccessPage(user?.role, child.pageKey))
        .map(child => ({ path: child.path, label: child.label, icon: child.icon }))

      if (children.length > 0) {
        items.push({ type: 'group', label: item.label, icon: item.icon, children })
      }

      return items
    }

    const { pageKey, ...link } = item
    if (canRoleAccessPage(user?.role, pageKey)) {
      items.push(link)
    }

    return items
  }, [])
  void accessVersion

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const breadcrumbSegments = location.pathname.split('/').filter(Boolean)
  const breadcrumbLabels: Record<string, string> = {
    dashboard: t('nav.dashboard'),
    requests: t('nav.createRequest', 'Talep Oluştur'),
    new: t('nav.createRequest', 'Talep Oluştur'),
    'my-tasks': t('nav.myTasks', 'Görevlerim'),
    'my-requests': t('nav.myRequests', 'Taleplerim'),
    'incoming-requests': t('nav.incomingRequestsAll', 'Birime Gelen Tüm Talepler'),
    tasks: t('nav.tasks'),
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
    'incoming-requests': t('nav.incomingRequests', 'Birime Gelen Talepler'),
    tasks: t('nav.incomingRequests', 'Birime Gelen Talepler'),
    directorate: t('nav.groupJobs'),
    coordinated: t('nav.groupJobs'),
    jobs: t('nav.groupJobs'),
    display: t('nav.groupJobs'),
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
    'my-tasks': ListChecks,
    'my-requests': Send,
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
  const currentBreadcrumbParent = currentBreadcrumbSegment ? breadcrumbParent[currentBreadcrumbSegment] : null
  const currentBreadcrumbLabel = currentBreadcrumbSegment ? breadcrumbLabels[currentBreadcrumbSegment] || currentBreadcrumbSegment : null
  const CurrentBreadcrumbIcon = currentBreadcrumbSegment ? breadcrumbIcon[currentBreadcrumbSegment] : null

  return (
    <div className="min-h-dvh bg-[color:var(--color-background)] lg:flex">
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
          <Button size="sm" variant="destructive" onClick={handleLogout} className="gap-1.5">
            <LogOut className="size-3.5" />
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
                <MunicipalitySeal compact alt={`${institutionName} logo`} src={logoUrl} className="h-24 w-24 rounded-[1.9rem]" />
                <div className="min-w-0">
                  <div className="text-2xl font-bold leading-tight break-words text-white text-center">{t('shell.subtitle', { municipalityName })}</div>
                </div>
              </div>
              <button type="button" className="sidebar-chip absolute right-3 top-3" onClick={() => setIsMobileNavOpen(false)} aria-label="Close menu">
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto scrollbar-none">
              <SidebarNav items={navItems} onNavigate={() => setIsMobileNavOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}

      <aside
        className={`sidebar-shell relative hidden h-dvh shrink-0 flex-col border-r px-3 py-3 transition-[width] duration-200 lg:flex ${isSidebarCollapsed ? 'w-[88px]' : 'w-[252px]'}`}
      >
        <div className="flex h-full flex-col gap-3 rounded-[var(--radius-2xl)] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3">
          <div className="relative rounded-[var(--radius-xl)] border border-white/8 bg-white/6 p-3">
            {!isSidebarCollapsed ? (
              <div className="flex flex-col items-center gap-2.5">
                <MunicipalitySeal alt={`${institutionName} logo`} src={logoUrl} className="h-20 w-full max-w-full rounded-[1.7rem]" />
                <div className="min-w-0 w-full text-center text-sm font-bold leading-tight break-words text-white">{t('shell.subtitle', { municipalityName })}</div>
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

          <div className="flex-1 overflow-y-auto">
            <SidebarNav items={navItems} collapsed={isSidebarCollapsed} />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-x-clip md:flex md:min-h-0 md:flex-col md:overflow-visible">
        <div className="hidden items-center justify-between border-b border-[var(--color-border)] bg-white/94 px-6 py-2.5 backdrop-blur lg:flex">
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
            <NotificationBell />
            <div className="flex min-w-0 max-w-[17rem] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 shadow-sm" title={`${userDisplayName} - ${userRoleLabel}`}>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-xs font-black text-white">
                {userInitials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900">{userDisplayName}</div>
                <div className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">{userRoleLabel}</div>
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={handleLogout} className="gap-1.5">
              <LogOut className="size-3.5" />
              {t('shell.logout')}
            </Button>
          </div>
        </div>
        <main id="main-content" className="flex min-h-[calc(100dvh-3.6rem)] w-full max-w-none flex-col px-3 py-3 sm:px-4 md:min-h-0 md:flex-1 md:overflow-y-auto lg:px-6 lg:py-4 xl:px-7 2xl:px-8">
          {breadcrumbSegments.length > 0 && location.pathname !== '/dashboard' ? (
            <div className="mb-2">
              <button type="button" className="back-button" onClick={() => navigate(-1)}>
                ← {t('common.back', 'Geri')}
              </button>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
