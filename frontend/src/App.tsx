import { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getApiUrl } from './config/api';
import './App.css';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const DepartmentsPage = lazy(() =>
  import('./pages/DepartmentsPage').then((module) => ({ default: module.DepartmentsPage })),
);
const UsersPage = lazy(() =>
  import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })),
);
const TasksPage = lazy(() =>
  import('./pages/TasksPage').then((module) => ({ default: module.TasksPage })),
);
const SocialMessagesPage = lazy(() =>
  import('./pages/SocialMessagesPage').then((module) => ({ default: module.SocialMessagesPage })),
);
const AuditLogsPage = lazy(() =>
  import('./pages/AuditLogsPage').then((module) => ({ default: module.AuditLogsPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const LoginPage = lazy(() => import('./pages/LoginPage'));

type Page = 'dashboard' | 'departments' | 'users' | 'tasks' | 'social' | 'audit' | 'settings';

interface MenuVisibilityPayload {
  menuVisibility: Record<string, boolean>;
}

function LoadingState() {
  const { t } = useTranslation('common');
  return <div className="loading">{t('common.loading')}</div>;
}

function AppContent() {
  const { t } = useTranslation('common');
  const { isAuthenticated, isLoading, user, token, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [menuVisibility, setMenuVisibility] = useState<Record<string, boolean>>({});
  const normalizeRole = (value?: string | null) => value?.replace(/[^a-z]/gi, '').toLowerCase() ?? '';
  const getSidebarDisplayName = () => {
    const name = user?.displayName?.trim();
    if (!name) {
      return user?.displayName ?? '-';
    }

    const normalizedRole = normalizeRole(user?.role);
    const normalizedName = name.toLocaleLowerCase('tr-TR');

    if (
      normalizedRole === 'systemadmin' &&
      (normalizedName === 'sistem admin' || normalizedName === 'system admin')
    ) {
      return t('app.roles.systemAdmin');
    }

    return name;
  };

  useEffect(() => {
    if (!isAuthenticated || !token || !user?.tenantId) {
      setMenuVisibility({});
      return;
    }

    let isCancelled = false;

    const loadMenuVisibility = async () => {
      try {
        const response = await fetch(getApiUrl('/me/menu-visibility'), {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-Id': user.tenantId,
          },
        });

        if (!response.ok) {
          if (!isCancelled) {
            setMenuVisibility({});
          }
          return;
        }

        const payload = (await response.json()) as MenuVisibilityPayload;
        if (!isCancelled) {
          setMenuVisibility(payload.menuVisibility ?? {});
        }
      } catch {
        if (!isCancelled) {
          setMenuVisibility({});
        }
      }
    };

    void loadMenuVisibility();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, token, user?.tenantId]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingState />}>
        <LoginPage />
      </Suspense>
    );
  }

  const navItems: { page: Page; labelKey: string; icon: string; adminOnly?: boolean }[] = [
    { page: 'dashboard', labelKey: 'app.nav.dashboard', icon: '📊' },
    { page: 'tasks', labelKey: 'app.nav.tasks', icon: '📋' },
    { page: 'social', labelKey: 'app.nav.social', icon: '📱' },
    { page: 'departments', labelKey: 'app.nav.departments', icon: '🏢' },
    { page: 'users', labelKey: 'app.nav.users', icon: '👥' },
    { page: 'audit', labelKey: 'app.nav.audit', icon: '📜', adminOnly: true },
    { page: 'settings', labelKey: 'app.nav.settings', icon: '⚙️', adminOnly: true },
  ];
  const isSystemAdmin = normalizeRole(user?.role) === 'systemadmin';

  const isItemVisible = (item: { page: Page; adminOnly?: boolean }) => {
    if (item.adminOnly && !isSystemAdmin) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(menuVisibility, item.page)) {
      return menuVisibility[item.page];
    }

    return true;
  };

  const visibleNavItems = navItems.filter(isItemVisible);
  const fallbackPage = visibleNavItems[0]?.page ?? 'dashboard';
  const currentPageForView = visibleNavItems.some((item) => item.page === currentPage)
    ? currentPage
    : fallbackPage;

  const renderPage = () => {
    switch (currentPageForView) {
      case 'dashboard':
        return <DashboardPage />;
      case 'departments':
        return <DepartmentsPage />;
      case 'users':
        return <UsersPage />;
      case 'tasks':
        return <TasksPage />;
      case 'social':
        return <SocialMessagesPage />;
      case 'audit':
        return isSystemAdmin ? <AuditLogsPage /> : <DashboardPage />;
      case 'settings':
        return isSystemAdmin ? <SettingsPage /> : <DashboardPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <h2>🏛️ {user?.tenantName || t('app.defaultTenantName')}</h2>
          <span>{t('app.tenantSuffix')}</span>
        </div>
        <nav>
          {visibleNavItems.map((item) => (
            <button
              key={item.page}
              className={`nav-item ${currentPageForView === item.page ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.page)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{t(item.labelKey)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{getSidebarDisplayName()}</span>
            <span className="user-role">{user?.role}</span>
          </div>
          <button className="logout-btn" onClick={logout}>
            🚪 {t('common.logout')}
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Suspense fallback={<LoadingState />}>{renderPage()}</Suspense>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
