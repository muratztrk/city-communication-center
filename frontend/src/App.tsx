import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { DashboardPage } from './pages/DashboardPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { UsersPage } from './pages/UsersPage';
import { TasksPage } from './pages/TasksPage';
import { SocialMessagesPage } from './pages/SocialMessagesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPageTenantAuth';
import LoginPage from './pages/LoginPage';
import { getRoleLabel } from './utils/localization';
import './App.css';

function AppContent() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canAccessAdminSettings = user?.role === 'SystemAdmin';

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const navItems: { path: string; label: string; icon: string; adminOnly?: boolean }[] = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: '📊' },
    { path: '/tasks', label: t('nav.tasks'), icon: '📋' },
    { path: '/social', label: t('nav.social'), icon: '📱' },
    { path: '/departments', label: t('nav.departments'), icon: '🏢' },
    { path: '/users', label: t('nav.users'), icon: '👥' },
    { path: '/audit', label: t('nav.audit'), icon: '📜' },
    { path: '/settings', label: t('nav.settings'), icon: '⚙️', adminOnly: true },
  ];

  const visibleNavItems = navItems.filter(item => !item.adminOnly || canAccessAdminSettings);
  const currentPath = location.pathname === '/' ? '/dashboard' : location.pathname;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <h2>🏛️ {user?.tenantName || 'BİM'}</h2>
          <span>{t('sidebar.subtitle')}</span>
        </div>
        <nav>
          {visibleNavItems.map(item => (
            <button
              key={item.path}
              className={`nav-item ${currentPath.startsWith(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <LanguageSwitcher />
          <div className="user-info">
            <span className="user-name">{user?.displayName}</span>
            <span className="user-role">{getRoleLabel(t, user?.role ?? '')}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 {t('sidebar.logout')}
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/social" element={<SocialMessagesPage />} />
          <Route path="/audit" element={<AuditLogsPage />} />
          <Route
            path="/settings"
            element={canAccessAdminSettings ? <SettingsPage /> : <Navigate to="/dashboard" replace />}
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return <AppContent />;
}

export default App;
