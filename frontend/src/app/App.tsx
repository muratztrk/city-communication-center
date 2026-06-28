import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { canAnyRoleAccessPage, getEffectiveUserRoles, type PageAccessKey } from '../lib/rolePageAccess'

const AppShell = lazy(() => import('./AppShell').then(module => ({ default: module.AppShell })))
const AuditLogsPage = lazy(() => import('../pages/AuditLogsPage').then(module => ({ default: module.AuditLogsPage })))
const CreateRequestPage = lazy(() => import('../pages/CreateRequestPage').then(module => ({ default: module.CreateRequestPage })))
const DepartmentsPage = lazy(() => import('../pages/DepartmentsPage').then(module => ({ default: module.DepartmentsPage })))
const DashboardPage = lazy(() => import('../pages/DashboardPage').then(module => ({ default: module.DashboardPage })))
const IncomingRequestsPage = lazy(() => import('../pages/IncomingRequestsPage').then(module => ({ default: module.IncomingRequestsPage })))
const LoginPage = lazy(() => import('../pages/LoginPage').then(module => ({ default: module.LoginPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(module => ({ default: module.SettingsPage })))
const SocialMessagesPage = lazy(() => import('../pages/SocialMessagesPage').then(module => ({ default: module.SocialMessagesPage })))
const TasksPage = lazy(() => import('../pages/TasksPage').then(module => ({ default: module.TasksPage })))
const UsersPage = lazy(() => import('../pages/UsersPage').then(module => ({ default: module.UsersPage })))
const JobsPage = lazy(() => import('../pages/JobsPage').then(module => ({ default: module.JobsPage })))
const WallboardPage = lazy(() => import('../pages/WallboardPage').then(module => ({ default: module.WallboardPage })))
const EDevletActivityPlanPage = lazy(() => import('../pages/EDevletActivityPlanPage').then(module => ({ default: module.EDevletActivityPlanPage })))
const EDevletActivityPlansListPage = lazy(() => import('../pages/EDevletActivityPlansListPage').then(module => ({ default: module.EDevletActivityPlansListPage })))
const EDevletBasvurularPage = lazy(() => import('../pages/EDevletBasvurularPage').then(module => ({ default: module.EDevletBasvurularPage })))
const RoutineTaskPage = lazy(() => import('../pages/RoutineTaskPage').then(module => ({ default: module.RoutineTaskPage })))
const WhatsAppConversationsPage = lazy(() => import('../pages/WhatsAppConversationsPage').then(module => ({ default: module.WhatsAppConversationsPage })))

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

function PageAccessGate({ pageKey, user, children }: { pageKey: PageAccessKey; user?: { role?: string; additionalRoles?: string[] } | null; children: ReactNode }) {
  return canAnyRoleAccessPage(getEffectiveUserRoles(user), pageKey) ? children : <Navigate to="/dashboard" replace />
}

function ManagerOnlyGate({ role, children }: { role?: string; children: ReactNode }) {
  return role === 'Manager' ? children : <Navigate to="/dashboard" replace />
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
        <Route path="/display" element={<PageAccessGate pageKey="display" user={user}><WallboardPage /></PageAccessGate>} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PageAccessGate pageKey="dashboard" user={user}><DashboardPage /></PageAccessGate>} />
          <Route path="/edevlet/activity-plan" element={<PageAccessGate pageKey="edevletActivityPlan" user={user}><EDevletActivityPlanPage /></PageAccessGate>} />
          <Route path="/edevlet/activity-plans" element={<PageAccessGate pageKey="edevletActivityPlansList" user={user}><EDevletActivityPlansListPage /></PageAccessGate>} />
          <Route path="/edevlet/basvurular" element={<PageAccessGate pageKey="social" user={user}><EDevletBasvurularPage /></PageAccessGate>} />
          <Route path="/requests/new" element={<PageAccessGate pageKey="createRequest" user={user}><CreateRequestPage /></PageAccessGate>} />
          <Route path="/routine-tasks/new" element={<PageAccessGate pageKey="createRoutineTask" user={user}><RoutineTaskPage /></PageAccessGate>} />
          <Route path="/routine-tasks/:taskId/edit" element={<PageAccessGate pageKey="createRoutineTask" user={user}><RoutineTaskPage /></PageAccessGate>} />
          <Route path="/my-tasks" element={<PageAccessGate pageKey="myTasks" user={user}><TasksPage fixedScope="mine" /></PageAccessGate>} />
          <Route path="/my-requests" element={<PageAccessGate pageKey="myRequests" user={user}><JobsPage mode="myRequests" fixedScope="mine" /></PageAccessGate>} />
          <Route path="/outgoing-requests" element={<PageAccessGate pageKey="outgoingRequests" user={user}><JobsPage mode="departmentOutgoing" fixedScope="outgoing-department" /></PageAccessGate>} />
          <Route path="/department-tasks" element={<ManagerOnlyGate role={user?.role}><TasksPage mode="departmentTasks" fixedScope="department" /></ManagerOnlyGate>} />
          <Route path="/staff-tasks" element={<ManagerOnlyGate role={user?.role}><TasksPage mode="staffTasks" fixedScope="all" /></ManagerOnlyGate>} />
          <Route path="/tasks" element={<Navigate to="/incoming-requests?kind=all" replace />} />
          <Route path="/jobs" element={<Navigate to="/incoming-requests?kind=all" replace />} />
          <Route path="/request-details" element={<PageAccessGate pageKey="incomingRequests" user={user}><JobsPage /></PageAccessGate>} />
          <Route path="/incoming-requests" element={<PageAccessGate pageKey="incomingRequests" user={user}><IncomingRequestsPage /></PageAccessGate>} />
          <Route path="/social" element={<PageAccessGate pageKey="social" user={user}><SocialMessagesPage /></PageAccessGate>} />
          <Route path="/whatsapp" element={<PageAccessGate pageKey="social" user={user}><WhatsAppConversationsPage /></PageAccessGate>} />
          <Route path="/departments" element={<PageAccessGate pageKey="departments" user={user}><DepartmentsPage /></PageAccessGate>} />
          <Route path="/users" element={<PageAccessGate pageKey="users" user={user}><UsersPage /></PageAccessGate>} />
          <Route path="/audit" element={<PageAccessGate pageKey="audit" user={user}><AuditLogsPage /></PageAccessGate>} />
          <Route
            path="/settings"
            element={user?.role === 'SystemAdmin' && canAnyRoleAccessPage(getEffectiveUserRoles(user), 'settings') ? <SettingsPage /> : <Navigate to="/dashboard" replace />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
