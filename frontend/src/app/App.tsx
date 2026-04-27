import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { canRoleAccessPage, type PageAccessKey } from '../lib/rolePageAccess'

const AppShell = lazy(() => import('./AppShell').then(module => ({ default: module.AppShell })))
const AuditLogsPage = lazy(() => import('../pages/AuditLogsPage').then(module => ({ default: module.AuditLogsPage })))
const CreateRequestPage = lazy(() => import('../pages/CreateRequestPage').then(module => ({ default: module.CreateRequestPage })))
const DepartmentsPage = lazy(() => import('../pages/DepartmentsPage').then(module => ({ default: module.DepartmentsPage })))
const DashboardPage = lazy(() => import('../pages/DashboardPage').then(module => ({ default: module.DashboardPage })))
const LoginPage = lazy(() => import('../pages/LoginPage').then(module => ({ default: module.LoginPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(module => ({ default: module.SettingsPage })))
const SocialMessagesPage = lazy(() => import('../pages/SocialMessagesPage').then(module => ({ default: module.SocialMessagesPage })))
const TasksPage = lazy(() => import('../pages/TasksPage').then(module => ({ default: module.TasksPage })))
const UsersPage = lazy(() => import('../pages/UsersPage').then(module => ({ default: module.UsersPage })))
const JobsPage = lazy(() => import('../pages/JobsPage').then(module => ({ default: module.JobsPage })))
const WallboardPage = lazy(() => import('../pages/WallboardPage').then(module => ({ default: module.WallboardPage })))

function LoadingScreen() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-panel rounded-[var(--radius-2xl)] border border-[var(--color-border)] px-6 py-6 text-center shadow-[var(--shadow-soft)]">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[color:var(--color-primary)]/15 border-t-[color:var(--color-primary)]" />
        <p className="mt-4 text-sm font-semibold text-[color:var(--color-muted-foreground)]">{t('common.loading')}</p>
      </div>
    </div>
  )
}

function PageAccessGate({ pageKey, role, children }: { pageKey: PageAccessKey; role?: string; children: ReactNode }) {
  return canRoleAccessPage(role, pageKey) ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/display" element={<PageAccessGate pageKey="display" role={user?.role}><WallboardPage /></PageAccessGate>} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PageAccessGate pageKey="dashboard" role={user?.role}><DashboardPage /></PageAccessGate>} />
          <Route path="/requests/new" element={<PageAccessGate pageKey="createRequest" role={user?.role}><CreateRequestPage /></PageAccessGate>} />
          <Route path="/my-tasks" element={<PageAccessGate pageKey="myTasks" role={user?.role}><TasksPage fixedScope="mine" /></PageAccessGate>} />
          <Route path="/my-requests" element={<PageAccessGate pageKey="myRequests" role={user?.role}><JobsPage mode="myRequests" fixedScope="mine" /></PageAccessGate>} />
          <Route path="/tasks" element={<PageAccessGate pageKey="tasks" role={user?.role}><TasksPage /></PageAccessGate>} />
          <Route path="/jobs" element={<PageAccessGate pageKey="jobs" role={user?.role}><JobsPage /></PageAccessGate>} />
          <Route path="/social" element={<PageAccessGate pageKey="social" role={user?.role}><SocialMessagesPage /></PageAccessGate>} />
          <Route path="/departments" element={<PageAccessGate pageKey="departments" role={user?.role}><DepartmentsPage /></PageAccessGate>} />
          <Route path="/users" element={<PageAccessGate pageKey="users" role={user?.role}><UsersPage /></PageAccessGate>} />
          <Route path="/audit" element={<PageAccessGate pageKey="audit" role={user?.role}><AuditLogsPage /></PageAccessGate>} />
          <Route
            path="/settings"
            element={user?.role === 'SystemAdmin' && canRoleAccessPage(user?.role, 'settings') ? <SettingsPage /> : <Navigate to="/dashboard" replace />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
