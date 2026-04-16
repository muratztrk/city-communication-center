import { Building, ChevronLeft, ChevronRight, Home, LayoutDashboard, LogOut, Menu, MessageSquareMore, ScrollText, Settings2, SquareKanban, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MunicipalitySeal } from '../components/branding/MunicipalitySeal'
import { SidebarNav } from '../components/layout/SidebarNav'
import { Button } from '../components/ui/button'
import { useAuth } from '../context/AuthContext'
import { useTenantTheme } from '../context/ThemeContext'
import { getRoleLabel } from '../utils/localization'

export function AppShell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { appearance } = useTenantTheme()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem('ccc_sidebar_collapsed') === 'true'
  })
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem('ccc_sidebar_collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const institutionName = user?.tenantName || 'Tire Belediyesi'
  const municipalityName = institutionName.replace(/\s+Belediyesi?$/i, '').trim()
  const logoUrl = appearance.logoUrl?.trim() || null
  const navItems = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/tasks', label: t('nav.tasks'), icon: SquareKanban },
    { path: '/social', label: t('nav.social'), icon: MessageSquareMore },
    { path: '/departments', label: t('nav.departments'), icon: Building },
    { path: '/users', label: t('nav.users'), icon: Users },
    { path: '/audit', label: t('nav.audit'), icon: ScrollText },
  ]

  if (user?.role === 'SystemAdmin') {
    navItems.push({ path: '/settings', label: t('nav.settings'), icon: Settings2 })
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const breadcrumbSegments = location.pathname.split('/').filter(Boolean)
  const breadcrumbLabels: Record<string, string> = {
    dashboard: t('nav.dashboard'),
    tasks: t('nav.tasks'),
    social: t('nav.social'),
    departments: t('nav.departments'),
    users: t('nav.users'),
    audit: t('nav.audit'),
    settings: t('nav.settings'),
  }

  const breadcrumbParent: Record<string, string> = {
    tasks: t('nav.groupTasks'),
    social: t('nav.groupSocial'),
    departments: t('nav.groupAdmin'),
    users: t('nav.groupAdmin'),
    audit: t('nav.groupAdmin'),
    settings: t('nav.groupAdmin'),
  }

  const breadcrumbIcon: Record<string, typeof LayoutDashboard> = {
    dashboard: LayoutDashboard,
    tasks: SquareKanban,
    social: MessageSquareMore,
    departments: Building,
    users: Users,
    audit: ScrollText,
    settings: Settings2,
  }

  return (
    <div className="min-h-dvh bg-[color:var(--color-background)] md:h-dvh md:overflow-hidden lg:flex">
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
              <div className="truncate text-xs text-[color:var(--color-muted-foreground)]">{getRoleLabel(t, user?.role ?? '')}</div>
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
            <div className="mt-3 flex-1 overflow-y-auto">
              <SidebarNav items={navItems} onNavigate={() => setIsMobileNavOpen(false)} />
            </div>
            <div className="mt-3 space-y-3 rounded-[var(--radius-xl)] border border-white/8 bg-white/6 p-3">
              <div>
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-white/55">{t('shell.liveTenant')}</div>
                <div className="mt-1 text-sm font-semibold text-white">{user?.displayName}</div>
                <div className="text-xs text-white/70">{getRoleLabel(t, user?.role ?? '')}</div>
              </div>
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

          <div className="mt-auto space-y-3 rounded-[var(--radius-xl)] border border-white/8 bg-white/6 p-3">
            {!isSidebarCollapsed ? (
              <>
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-white/55">{t('shell.liveTenant')}</div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-white">{user?.displayName}</div>
                  <div className="text-xs text-white/70">{getRoleLabel(t, user?.role ?? '')}</div>
                </div>
              </>
            ) : (
              <div className="flex justify-center">
                <div className="sidebar-chip text-xs font-semibold">{user?.displayName?.slice(0, 2).toUpperCase()}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-x-clip md:min-h-0 md:overflow-hidden">
        <div className="hidden items-center justify-between border-b border-[var(--color-border)] bg-white/94 px-6 py-2.5 backdrop-blur lg:flex">
          <nav className="flex items-center gap-1.5 text-sm text-[color:var(--color-muted-foreground)]" aria-label="Breadcrumb">
            <button type="button" className="flex items-center gap-1 hover:text-slate-700" onClick={() => navigate('/dashboard')}>
              <Home className="size-4" />
              <span>{t('nav.home')}</span>
            </button>
            {breadcrumbSegments.map((segment) => {
              const label = breadcrumbLabels[segment] || segment
              const parent = breadcrumbParent[segment]
              const Icon = breadcrumbIcon[segment]
              return (
                <span key={segment} className="flex items-center gap-1.5">
                  {parent ? (
                    <>
                      <ChevronRight className="size-3.5 text-slate-300" />
                      <span>{parent}</span>
                    </>
                  ) : null}
                  <ChevronRight className="size-3.5 text-slate-300" />
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--color-primary)]/10 px-2 py-0.5 font-medium text-[color:var(--color-primary)]">
                    {Icon ? <Icon className="size-3.5" /> : null}
                    {label}
                  </span>
                </span>
              )
            })}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[color:var(--color-muted-foreground)]">{user?.displayName}</span>
            <Button size="sm" variant="destructive" onClick={handleLogout} className="gap-1.5">
              <LogOut className="size-3.5" />
              {t('shell.logout')}
            </Button>
          </div>
        </div>
        <main id="main-content" className="flex min-h-[calc(100dvh-3.6rem)] w-full max-w-none flex-col px-3 py-3 sm:px-4 md:h-[calc(100dvh-3.6rem)] md:min-h-0 md:overflow-hidden lg:h-[calc(100dvh-3.25rem)] lg:px-6 lg:py-4 xl:px-7 2xl:px-8">
          {breadcrumbSegments.length > 0 && location.pathname !== '/dashboard' ? (
            <div className="mb-2">
              <button type="button" className="inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-muted-foreground)] hover:text-slate-900" onClick={() => navigate(-1)}>
                ← Geri
              </button>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
