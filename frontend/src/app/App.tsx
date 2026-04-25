import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

const AppShell = lazy(() => import('./AppShell').then(module => ({ default: module.AppShell })))
const AuditLogsPage = lazy(() => import('../pages/AuditLogsPage').then(module => ({ default: module.AuditLogsPage })))
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
        <Route path="/display" element={<WallboardPage />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/social" element={<SocialMessagesPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/audit" element={<AuditLogsPage />} />
          <Route
            path="/settings"
            element={user?.role === 'SystemAdmin' ? <SettingsPage /> : <Navigate to="/dashboard" replace />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
