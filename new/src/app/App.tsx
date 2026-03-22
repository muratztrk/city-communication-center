import { Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppShell } from './AppShell'
import { useAuth } from '../context/AuthContext'
import { AuditLogsPage } from '../pages/AuditLogsPage'
import { DepartmentsPage } from '../pages/DepartmentsPage'
import { DashboardPage } from '../pages/DashboardPage'
import { LoginPage } from '../pages/LoginPage'
import { SettingsPage } from '../pages/SettingsPage'
import { SocialMessagesPage } from '../pages/SocialMessagesPage'
import { TasksPage } from '../pages/TasksPage'
import { UsersPage } from '../pages/UsersPage'

function LoadingScreen() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface-panel rounded-[var(--radius-2xl)] px-8 py-8 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[color:var(--color-primary)]/20 border-t-[color:var(--color-primary)]" />
        <p className="mt-4 text-sm font-semibold text-slate-600">{t('common.loading')}</p>
      </div>
    </div>
  )
}

export default function App() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const { t } = useTranslation()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
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
  )
}
