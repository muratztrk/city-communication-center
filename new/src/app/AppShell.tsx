import { Building, LayoutDashboard, MessageSquareMore, ScrollText, Settings2, SquareKanban, Users } from 'lucide-react'
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

  const institutionName = user?.tenantName || 'Tire Belediyesi'
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

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full bg-[color:var(--color-sidebar)] px-4 py-4 text-[color:var(--color-sidebar-foreground)] shadow-[var(--shadow-soft)] lg:sticky lg:top-0 lg:h-screen lg:w-[280px] lg:shrink-0">
        <div className="flex h-full flex-col gap-4 rounded-[var(--radius-2xl)] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-4 sm:p-5">
          <div className="rounded-[var(--radius-xl)] border border-white/8 bg-white/6 p-4">
            <div className="flex flex-col items-center gap-4 text-center">
              <MunicipalitySeal alt={`${institutionName} logo`} />
              <div className="space-y-1">
                <h1 className="text-[1.65rem] font-extrabold text-white">{institutionName}</h1>
                <p className="text-sm text-white/68">{t('shell.subtitle')}</p>
              </div>
            </div>
          </div>

          <SidebarNav items={navItems} />

          <div className="mt-auto space-y-3 rounded-[var(--radius-xl)] border border-white/8 bg-white/6 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/52">{t('shell.liveTenant')}</div>
            <div className="space-y-1">
              <div className="text-base font-semibold text-white">{user?.displayName}</div>
              <div className="text-sm text-white/70">{getRoleLabel(t, user?.role ?? '')}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <LanguageSwitcher />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  logout()
                  navigate('/')
                }}
              >
                {t('shell.logout')}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-x-clip lg:overflow-y-auto">
        <main className="mx-auto w-full max-w-[1560px] px-4 py-4 sm:px-5 lg:px-6 lg:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
