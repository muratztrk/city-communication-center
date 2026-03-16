import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../config/api';
import './LoginPage.css';

interface Tenant {
  tenantId: string;
  municipalityName: string;
  displayName: string;
}

interface BootstrapTenantRequest {
  municipalityName: string;
  displayName: string;
  adminDisplayName: string;
  adminEmail: string;
}

interface BootstrapTenantResponse {
  tenantId: string;
  municipalityName: string;
  displayName: string;
  adminDisplayName: string;
  adminEmail: string;
  temporaryPassword: string;
  authMode: 'Development' | 'ActiveDirectory';
}

export default function LoginPage() {
  const { login } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupForm, setSetupForm] = useState<BootstrapTenantRequest>({
    municipalityName: '',
    displayName: '',
    adminDisplayName: 'Sistem Yöneticisi',
    adminEmail: '',
  });

  const toErrorMessage = async (response: Response, fallback: string) => {
    try {
      const payload = await response.json();
      if (typeof payload?.error === 'string' && payload.error.trim()) {
        return payload.error;
      }

      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    } catch {
      // ignore JSON parse failures and return fallback text
    }

    return fallback;
  };

  useEffect(() => {
    const loadTenants = async () => {
      setIsLoadingTenants(true);
      setError('');

      try {
        const response = await fetch(getApiUrl('/auth/tenants'));
        if (!response.ok) {
          throw new Error(await toErrorMessage(response, 'Belediye listesi yüklenemedi'));
        }

        const data = (await response.json()) as Tenant[];
        setTenants(data);

        if (data.length > 0) {
          setSelectedTenant(data[0].tenantId);
          setIsSetupMode(false);
        } else {
          setSelectedTenant('');
          setIsSetupMode(true);
        }
      } catch (err) {
        console.error('Failed to fetch tenants:', err);
        setError(err instanceof Error ? err.message : 'Belediye listesi yüklenemedi');
      } finally {
        setIsLoadingTenants(false);
      }
    };

    void loadTenants();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!selectedTenant) {
      setError('Lütfen belediye seçin.');
      return;
    }

    setIsLoading(true);

    try {
      await login(username, password, selectedTenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl('/auth/bootstrap'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(setupForm),
      });

      if (!response.ok) {
        throw new Error(await toErrorMessage(response, 'İlk kurulum tamamlanamadı'));
      }

      const data = (await response.json()) as BootstrapTenantResponse;
      setTenants([
        {
          tenantId: data.tenantId,
          municipalityName: data.municipalityName,
          displayName: data.displayName,
        },
      ]);
      setSelectedTenant(data.tenantId);
      setUsername(data.adminEmail);
      setPassword(data.temporaryPassword || '');
      setIsSetupMode(false);
      setInfoMessage(
        data.authMode === 'ActiveDirectory'
          ? `Kurulum tamamlandı. Active Directory hesabınızla giriş yapın: ${data.adminEmail}`
          : `Kurulum tamamlandı. Giriş bilgileri: ${data.adminEmail} / ${data.temporaryPassword}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İlk kurulum tamamlanamadı');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupChange = (key: keyof BootstrapTenantRequest, value: string) => {
    setSetupForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🏛️</div>
          <h1>Belediye İletişim Merkezi</h1>
          <p>{isSetupMode ? 'İlk Kurulum' : 'City Communication Center'}</p>
        </div>

        {isSetupMode ? (
          <form onSubmit={handleSetupSubmit} className="login-form">
            {error && <div className="login-error">{error}</div>}
            {infoMessage && <div className="login-info">{infoMessage}</div>}

            <p className="login-mode-note">
              Sistemde belediye kaydı bulunamadı. Kurulum için aşağıdaki bilgileri doldurun.
            </p>

            <div className="form-group">
              <label htmlFor="municipalityName">Belediye Adı</label>
              <input
                id="municipalityName"
                type="text"
                value={setupForm.municipalityName}
                onChange={(e) => handleSetupChange('municipalityName', e.target.value)}
                placeholder="Örn: Tire Belediyesi"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="displayName">Kısa Görünen Ad (Opsiyonel)</label>
              <input
                id="displayName"
                type="text"
                value={setupForm.displayName}
                onChange={(e) => handleSetupChange('displayName', e.target.value)}
                placeholder="Örn: Tire"
              />
            </div>

            <div className="form-group">
              <label htmlFor="adminDisplayName">Sistem Yöneticisi Adı</label>
              <input
                id="adminDisplayName"
                type="text"
                value={setupForm.adminDisplayName}
                onChange={(e) => handleSetupChange('adminDisplayName', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="adminEmail">Sistem Yöneticisi E-posta</label>
              <input
                id="adminEmail"
                type="email"
                value={setupForm.adminEmail}
                onChange={(e) => handleSetupChange('adminEmail', e.target.value)}
                placeholder="admin@belediye.gov.tr"
                required
              />
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'Kurulum yapılıyor...' : 'Kurulumu Tamamla'}
            </button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="login-form">
              {error && <div className="login-error">{error}</div>}
              {infoMessage && <div className="login-info">{infoMessage}</div>}

              <div className="form-group">
                <label htmlFor="tenant">Belediye</label>
                <select
                  id="tenant"
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  required
                  disabled={isLoadingTenants || tenants.length === 0}
                >
                  {isLoadingTenants ? (
                    <option value="">Yükleniyor...</option>
                  ) : tenants.length === 0 ? (
                    <option value="">Belediye kaydı bulunamadı</option>
                  ) : (
                    tenants.map((t) => (
                      <option key={t.tenantId} value={t.tenantId}>
                        {t.municipalityName}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="username">Kullanıcı Adı / E-posta</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="E-posta veya kullanıcı adı"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Şifre</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="login-button" disabled={isLoading}>
                {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>

            <div className="login-footer">
              <p className="login-hint">
                <strong>Test Kullanıcıları:</strong><br />
                ahmet.yilmaz@izmir.bel.tr / password123<br />
                mehmet.demir@izmir.bel.tr / password123<br />
                ayse.kaya@izmir.bel.tr / password123
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
