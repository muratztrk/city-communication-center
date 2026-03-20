import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { UsersPage } from './pages/UsersPage';
import { TasksPage } from './pages/TasksPage';
import { SocialMessagesPage } from './pages/SocialMessagesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import './App.css';

type Page = 'dashboard' | 'departments' | 'users' | 'tasks' | 'social' | 'audit' | 'settings';

function AppContent() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const canAccessAdminSettings = user?.role === 'SystemAdmin';
  const activePage = currentPage === 'settings' && !canAccessAdminSettings
    ? 'dashboard'
    : currentPage;

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Yükleniyor...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const navItems: { page: Page; label: string; icon: string; adminOnly?: boolean }[] = [
    { page: 'dashboard', label: 'Kontrol Paneli', icon: '📊' },
    { page: 'tasks', label: 'Görevler', icon: '📋' },
    { page: 'social', label: 'Sosyal Medya', icon: '📱' },
    { page: 'departments', label: 'Departmanlar', icon: '🏢' },
    { page: 'users', label: 'Kullanıcılar', icon: '👥' },
    { page: 'audit', label: 'Denetim', icon: '📜' },
    { page: 'settings', label: 'Ayarlar', icon: '⚙️', adminOnly: true },
  ];

  // Filter admin-only items based on user role
  const visibleNavItems = navItems.filter(item => !item.adminOnly || canAccessAdminSettings);

  const renderPage = (page: Page) => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'departments': return <DepartmentsPage />;
      case 'users': return <UsersPage />;
      case 'tasks': return <TasksPage />;
      case 'social': return <SocialMessagesPage />;
      case 'audit': return <AuditLogsPage />;
      case 'settings': return <SettingsPage />;
    }
  };

  const renderedPage = activePage;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <h2>🏛️ {user?.tenantName || 'BİM'}</h2>
          <span>İletişim Merkezi</span>
        </div>
        <nav>
          {visibleNavItems.map(item => (
            <button
              key={item.page}
              className={`nav-item ${renderedPage === item.page ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.page)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{user?.displayName}</span>
            <span className="user-role">{user?.role}</span>
          </div>
          <button className="logout-btn" onClick={logout}>
            🚪 Çıkış
          </button>
        </div>
      </aside>
      <main className="main-content">
        {renderPage(renderedPage)}
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
