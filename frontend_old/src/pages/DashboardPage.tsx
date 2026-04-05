import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Dashboard } from '../types';

export function DashboardPage() {
  const { t } = useTranslation();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDashboard()
      .then(setDashboard)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">{t('common.loading')}</div>;
  if (error) return <div className="error">{t('common.error')}: {error}</div>;
  if (!dashboard) return null;

  return (
    <div className="page">
      <h1>📊 {t('dashboard.title')}</h1>
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-value">{dashboard.openTaskCount}</div>
          <div className="stat-label">{t('dashboard.openTasks')}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{dashboard.pendingApprovalCount}</div>
          <div className="stat-label">{t('dashboard.pendingApproval')}</div>
        </div>
        <div className="stat-card info">
          <div className="stat-value">{dashboard.activeSocialMessageCount}</div>
          <div className="stat-label">{t('dashboard.socialMessages')}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{dashboard.failedNotificationCount}</div>
          <div className="stat-label">{t('dashboard.failedNotifications')}</div>
        </div>
      </div>
    </div>
  );
}
