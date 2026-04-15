import { Building, ChevronLeft, ChevronRight, LayoutDashboard, Menu, MessageSquareMore, ScrollText, Settings2, SquareKanban, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MunicipalitySeal } from '../components/branding/MunicipalitySeal'
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher'
import { SidebarNav } from '../components/layout/SidebarNav'
import { Button } from '../components/ui/button'
import { useAuth } from '../context/AuthContext'
import { getRoleLabel } from '../utils/localization'

export function AppShell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return window.localStorage.getItem('ccc_sidebar_collapsed') === 'true'
  })
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem('ccc_sidebar_collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const institutionName = user?.tenantName || 'Tire Belediyesi'
  const municipalityName = institutionName.replace(/\s+Belediyesi?$/i, '').trim()
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

  return (
    <div className="min-h-dvh bg-[color:var(--color-background)] md:h-dvh md:overflow-hidden lg:flex">
      <div className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-white/94 px-3 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="sidebar-chip text-slate-700"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label={t('nav.settings')}
            >
              <Menu className="size-4.5" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">{institutionName}</div>
              <div className="truncate text-xs text-[color:var(--color-muted-foreground)]">{getRoleLabel(t, user?.role ?? '')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Button size="sm" variant="secondary" onClick={handleLogout}>{t('shell.logout')}</Button>
          </div>
        </div>
      </div>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/40" onClick={() => setIsMobileNavOpen(false)} aria-label="Close navigation" />
          <aside className="sidebar-shell relative z-10 flex h-full w-[88vw] max-w-[320px] flex-col p-3 shadow-2xl">
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-white/8 bg-white/6 p-3">
              <div className="sidebar-brand">
                <MunicipalitySeal compact alt={`${institutionName} logo`} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{institutionName}</div>
                  <div className="truncate text-xs text-white/70">{t('shell.subtitle')}</div>
                </div>
              </div>
              <button type="button" className="sidebar-chip" onClick={() => setIsMobileNavOpen(false)} aria-label="Close menu">
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
              <div className="flex items-center justify-between gap-2">
                <LanguageSwitcher compact />
                <Button size="sm" variant="secondary" onClick={handleLogout}>{t('shell.logout')}</Button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <aside
        className={`sidebar-shell hidden h-dvh shrink-0 flex-col border-r px-3 py-3 transition-[width] duration-200 lg:flex ${isSidebarCollapsed ? 'w-[88px]' : 'w-[252px]'}`}
      >
        <div className="flex h-full flex-col gap-3 rounded-[var(--radius-2xl)] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3">
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-white/8 bg-white/6 p-3">
            <div className="sidebar-brand min-w-0">
              <MunicipalitySeal compact={isSidebarCollapsed} alt={`${institutionName} logo`} />
              {!isSidebarCollapsed ? (
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">{institutionName}</div>
                  <div className="truncate text-xs text-white/68">{t('shell.subtitle', { municipalityName })}</div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="sidebar-chip hidden lg:inline-flex"
              onClick={() => setIsSidebarCollapsed(current => !current)}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </button>
          </div>

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
            <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'flex-col' : 'justify-between'}`}>
              <LanguageSwitcher compact={isSidebarCollapsed} />
              <Button size="sm" variant="secondary" onClick={handleLogout}>{isSidebarCollapsed ? '<-' : t('shell.logout')}</Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-x-clip md:min-h-0 md:overflow-hidden">
        <main className="flex min-h-[calc(100dvh-3.6rem)] w-full max-w-none flex-col px-3 py-3 sm:px-4 md:h-[calc(100dvh-3.6rem)] md:min-h-0 md:overflow-hidden lg:h-dvh lg:px-6 lg:py-4 xl:px-7 2xl:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
