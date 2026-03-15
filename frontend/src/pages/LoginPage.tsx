import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

interface Tenant {
  tenantId: string;
  municipalityName: string;
  displayName: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch available tenants
    fetch('http://localhost:5100/api/v1/auth/tenants')
      .then(res => res.json())
      .then(data => {
        setTenants(data);
        if (data.length > 0) {
          setSelectedTenant(data[0].tenantId);
        }
      })
      .catch(err => {
        console.error('Failed to fetch tenants:', err);
        setError('Belediye listesi yüklenemedi');
      });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password, selectedTenant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🏛️</div>
          <h1>Belediye İletişim Merkezi</h1>
          <p>City Communication Center</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="tenant">Belediye</label>
            <select
              id="tenant"
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              required
            >
              {tenants.map(t => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.municipalityName}
                </option>
              ))}
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
      </div>
    </div>
  );
}
