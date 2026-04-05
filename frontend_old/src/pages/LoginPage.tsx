import { useState, useEffect, useEffectEvent } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getTenantLoginContext, startInteractiveAuthentication, verifyInteractiveAuthentication } from '../api/auth';
import type { TenantLoginContext, TenantLookup } from '../types';
import { getDeploymentModeLabel } from '../utils/localization';
import './LoginPage.css';

type LoginStep = 'probing' | 'credentials' | 'secondFactor';

interface NetworkState {
  isTrustedNetwork: boolean;
  automaticSignInMode: string | null;
  secondFactorRequiredOnSuccess: boolean;
}

interface ChallengeState {
  challengeId: string;
  deliveryDestination: string | null;
  expiresAtUtc: string | null;
  mockCodePreview: string | null;
}

const EMPTY_NETWORK_STATE: NetworkState = {
  isTrustedNetwork: false,
  automaticSignInMode: null,
  secondFactorRequiredOnSuccess: false,
};

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [tenants, setTenants] = useState<TenantLookup[]>([]);
  const [tenantContext, setTenantContext] = useState<TenantLoginContext | null>(null);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loginStep, setLoginStep] = useState<LoginStep>('credentials');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [networkState, setNetworkState] = useState<NetworkState>(EMPTY_NETWORK_STATE);
  const [challengeState, setChallengeState] = useState<ChallengeState | null>(null);
  const [isTenantContextLoading, setIsTenantContextLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const isTenantReady = !!selectedTenant;
  const selectedTenantDetails = tenants.find(item => item.tenantId === selectedTenant) ?? null;
  const hideTenantSelector = tenantContext?.hideTenantSelector ?? false;
  const tenantSelectionRequired = tenantContext?.requireTenantSelection ?? false;

  useEffect(() => {
    const abortController = new AbortController();

    const loadTenantContext = async () => {
      setIsTenantContextLoading(true);

      try {
        const data = await getTenantLoginContext();
        if (abortController.signal.aborted) {
          return;
        }

        setTenantContext(data);
        setTenants(data.tenants);
        setSelectedTenant(data.resolvedTenant?.tenantId ?? '');
        setLoginStep('credentials');
        setChallengeState(null);
        setVerificationCode('');
        setNetworkState(EMPTY_NETWORK_STATE);
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }

        console.error('Failed to fetch tenant login context:', err);
        setError(err instanceof Error ? err.message : t('login.tenantLoadError'));
      } finally {
        if (!abortController.signal.aborted) {
          setIsTenantContextLoading(false);
        }
      }
    };

    void loadTenantContext();

    return () => {
      abortController.abort();
    };
  }, [t]);

  useEffect(() => {
    if (!selectedTenant || isTenantContextLoading) {
      if (!isTenantContextLoading) {
        setLoginStep('credentials');
        setNetworkState(EMPTY_NETWORK_STATE);
      }
      return;
    }

    let isActive = true;

    const probeInteractiveFlow = async () => {
      setIsLoading(true);
      setError('');
      setNotice('');
      setVerificationCode('');
      setChallengeState(null);
      setLoginStep('probing');

      try {
        const response = await startInteractiveAuthentication(selectedTenant);
        if (!isActive) {
          return;
        }

        await handleInteractiveResult(response);
      } catch (err) {
        if (!isActive) {
          return;
        }

        console.error('Failed to probe interactive login flow:', err);
        setError(err instanceof Error ? err.message : t('common.error'));
        setLoginStep('credentials');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void probeInteractiveFlow();

    return () => {
      isActive = false;
    };
  }, [selectedTenant, t, isTenantContextLoading]);

  const getTenantDisplayName = () => {
    const tenant = tenants.find(item => item.tenantId === selectedTenant);
    return tenant?.displayName ?? tenant?.municipalityName ?? '';
  };

  const applyInteractiveResult = async (result: Awaited<ReturnType<typeof startInteractiveAuthentication>>) => {
    setNetworkState({
      isTrustedNetwork: result.isTrustedNetwork,
      automaticSignInMode: result.automaticSignInMode,
      secondFactorRequiredOnSuccess: result.secondFactorRequiredOnSuccess,
    });
    setNotice(result.message ?? '');
    setError('');

    if (result.status === 'ReadyToExchange') {
      if (!result.grant) {
        throw new Error(t('errors.invalidAuthResponse'));
      }

      await login(result.grant.username, result.grant.password, selectedTenant, getTenantDisplayName());
      return;
    }

    if (result.status === 'SecondFactorRequired' && result.challengeId) {
      setChallengeState({
        challengeId: result.challengeId,
        deliveryDestination: result.deliveryDestination,
        expiresAtUtc: result.expiresAtUtc,
        mockCodePreview: result.mockCodePreview,
      });
      setLoginStep('secondFactor');
      return;
    }

    if (result.status === 'Failed') {
      setNotice('');
      setError(result.message || t('errors.authFailed'));
    }

    setLoginStep('credentials');
  };

  const handleInteractiveResult = useEffectEvent(async (result: Awaited<ReturnType<typeof startInteractiveAuthentication>>) => {
    await applyInteractiveResult(result);
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!selectedTenant) {
      setError(t('login.tenantRequired'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await startInteractiveAuthentication(selectedTenant, username, password);
        await applyInteractiveResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySecondFactor = async (event: FormEvent) => {
    event.preventDefault();
    if (!challengeState) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await verifyInteractiveAuthentication(selectedTenant, challengeState.challengeId, verificationCode);
      if (result.status !== 'ReadyToExchange' || !result.grant) {
        setError(result.message || t('errors.authFailed'));
        return;
      }

      await login(result.grant.username, result.grant.password, selectedTenant, getTenantDisplayName());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const resetToCredentials = () => {
    setChallengeState(null);
    setVerificationCode('');
    setLoginStep('credentials');
    setNotice('');
    setError('');
  };

  const formatExpiry = (value: string | null) => {
    if (!value) {
      return null;
    }

    return new Date(value).toLocaleTimeString();
  };

  const handleTenantChange = (tenantId: string) => {
    setSelectedTenant(tenantId);
    setNotice('');
    setError('');
    setNetworkState(EMPTY_NETWORK_STATE);
    setChallengeState(null);
    setVerificationCode('');
    setLoginStep('credentials');
  };

  const resolvedContextMessage = selectedTenantDetails && hideTenantSelector
    ? tenantContext?.resolutionMode === 'CustomDomain'
      ? t('login.resolvedByDomain', { host: tenantContext.host ?? selectedTenantDetails.domain ?? '-' })
      : t('login.resolvedSingleTenant')
    : '';

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🏛️</div>
          <h1>{t('login.title')}</h1>
          <p>{t('login.subtitle')}</p>
        </div>

        <div className="login-form">
          {error && <div className="login-error">{error}</div>}
          {notice ? <div className="login-notice">{notice}</div> : null}

          {isTenantContextLoading ? <div className="login-probing">{t('login.loadingContext')}</div> : null}

          {!isTenantContextLoading && hideTenantSelector && selectedTenantDetails ? (
            <div className="tenant-affinity-card">
              <span className="tenant-affinity-badge">
                {tenantContext?.resolutionMode === 'CustomDomain' ? t('login.customDomainBadge') : t('login.singleTenantBadge')}
              </span>
              <strong>{selectedTenantDetails.displayName || selectedTenantDetails.municipalityName}</strong>
              <p>{resolvedContextMessage}</p>
            </div>
          ) : null}

          {!isTenantContextLoading && !hideTenantSelector ? (
            <div className="form-group">
              <label htmlFor="tenant">{t('login.tenant')}</label>
              <select
                id="tenant"
                value={selectedTenant}
                onChange={(e) => handleTenantChange(e.target.value)}
                required
              >
                <option value="">{t('login.tenantPlaceholder')}</option>
                {tenants.map(tenant => (
                  <option key={tenant.tenantId} value={tenant.tenantId}>
                    {tenant.municipalityName}
                  </option>
                ))}
              </select>
              {tenantSelectionRequired ? <small className="login-select-hint">{t('login.selectTenantHelp')}</small> : null}
            </div>
          ) : null}

          {!hideTenantSelector && selectedTenantDetails ? (
            <div className="tenant-summary">
              <div className="tenant-summary-row">
                <span>{t('login.selectedTenant')}</span>
                <strong>{selectedTenantDetails.displayName}</strong>
              </div>
              <div className="tenant-summary-row">
                <span>{t('login.deploymentMode')}</span>
                <strong>{getDeploymentModeLabel(t, selectedTenantDetails.deploymentMode)}</strong>
              </div>
              <div className="tenant-summary-row">
                <span>{t('login.domain')}</span>
                <strong>{selectedTenantDetails.domain || t('login.domainNotConfigured')}</strong>
              </div>
            </div>
          ) : null}

          {isTenantReady ? (
            <div className={`login-flow-banner ${networkState.isTrustedNetwork ? 'trusted' : 'external'}`}>
              <strong>{networkState.isTrustedNetwork ? t('login.trustedNetwork') : t('login.externalNetwork')}</strong>
              {networkState.automaticSignInMode ? (
                <span>
                  {t('login.automaticSignInMode')}: {t(`login.automaticSignInModes.${networkState.automaticSignInMode}`, { defaultValue: networkState.automaticSignInMode })}
                </span>
              ) : null}
            </div>
          ) : null}

          {loginStep === 'probing' && !isTenantContextLoading ? (
            <div className="login-probing">{t('login.checking')}</div>
          ) : null}

          {loginStep === 'credentials' && !isTenantContextLoading ? (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="username">{t('login.username')}</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('login.usernamePlaceholder')}
                  required
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">{t('login.password')}</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="login-button" disabled={isLoading || !isTenantReady}>
                {isLoading ? t('login.submitting') : t('login.submit')}
              </button>
            </form>
          ) : null}

          {loginStep === 'secondFactor' && challengeState ? (
            <form className="second-factor-card" onSubmit={handleVerifySecondFactor}>
              <h2>{t('login.secondFactorTitle')}</h2>
              <p>{t('login.secondFactorSubtitle')}</p>

              <div className="login-inline-meta">
                {challengeState.deliveryDestination ? <span>{t('login.deliveryDestination')}: {challengeState.deliveryDestination}</span> : null}
                {challengeState.expiresAtUtc ? <span>{t('login.expiresAt')}: {formatExpiry(challengeState.expiresAtUtc)}</span> : null}
              </div>

              {challengeState.mockCodePreview ? (
                <div className="mock-code-preview">
                  <strong>{t('login.mockPreviewTitle')}</strong>
                  <div className="mock-code-value">{challengeState.mockCodePreview}</div>
                </div>
              ) : null}

              <div className="form-group">
                <label htmlFor="second-factor-code">{t('login.verificationCode')}</label>
                <input
                  id="second-factor-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder={t('login.verificationCodePlaceholder')}
                  required
                />
              </div>

              <div className="login-button-row">
                <button className="login-button" type="submit" disabled={isLoading || !verificationCode.trim()}>
                  {isLoading ? t('login.verifying') : t('login.verify')}
                </button>
                <button className="login-secondary-button" type="button" onClick={resetToCredentials}>
                  {t('login.editCredentials')}
                </button>
              </div>
            </form>
          ) : null}
        </div>

        <div className="login-footer">
          <p className="login-hint">
            <strong>{t('login.hintTitle')}</strong><br />
            {t('login.hintLine1')}<br />
            {t('login.hintLine2')}
          </p>
        </div>
      </div>
    </div>
  );
}
