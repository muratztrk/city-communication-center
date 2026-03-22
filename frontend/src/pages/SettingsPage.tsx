import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Department, RoutingConfig, SocialSettingsStatus, TenantLdapSettings, TenantSettings } from '../types';
import { getDeploymentModeLabel } from '../utils/localization';

type SettingsTab = 'tenant' | 'social' | 'routing';
type ChannelType = 'x' | 'facebook' | 'instagram' | 'whatsapp';
type ChannelForms = Record<ChannelType, Record<string, string>>;
type TenantLdapFormState = TenantLdapSettings & { bindPassword: string; clearBindPassword: boolean };

interface ChannelConfig {
  id: ChannelType;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  statusKey: keyof SocialSettingsStatus;
  fields: { key: string; labelKey: string; secret?: boolean }[];
}

const CHANNELS: ChannelConfig[] = [
  {
    id: 'x',
    titleKey: 'settings.socialConfig.x',
    descriptionKey: 'settings.socialConfig.descriptions.x',
    icon: '𝕏',
    statusKey: 'x',
    fields: [
      { key: 'apiKey', labelKey: 'settings.socialConfig.fields.x.apiKey' },
      { key: 'apiSecret', labelKey: 'settings.socialConfig.fields.x.apiSecret', secret: true },
      { key: 'accessToken', labelKey: 'settings.socialConfig.fields.x.accessToken' },
      { key: 'accessTokenSecret', labelKey: 'settings.socialConfig.fields.x.accessTokenSecret', secret: true },
      { key: 'bearerToken', labelKey: 'settings.socialConfig.fields.x.bearerToken', secret: true },
    ],
  },
  {
    id: 'facebook',
    titleKey: 'settings.socialConfig.facebook',
    descriptionKey: 'settings.socialConfig.descriptions.facebook',
    icon: '📘',
    statusKey: 'facebook',
    fields: [
      { key: 'appId', labelKey: 'settings.socialConfig.fields.facebook.appId' },
      { key: 'appSecret', labelKey: 'settings.socialConfig.fields.facebook.appSecret', secret: true },
      { key: 'pageAccessToken', labelKey: 'settings.socialConfig.fields.facebook.pageAccessToken', secret: true },
      { key: 'pageId', labelKey: 'settings.socialConfig.fields.facebook.pageId' },
      { key: 'webhookVerifyToken', labelKey: 'settings.socialConfig.fields.facebook.webhookVerifyToken' },
    ],
  },
  {
    id: 'instagram',
    titleKey: 'settings.socialConfig.instagram',
    descriptionKey: 'settings.socialConfig.descriptions.instagram',
    icon: '📷',
    statusKey: 'instagram',
    fields: [
      { key: 'accountId', labelKey: 'settings.socialConfig.fields.instagram.accountId' },
      { key: 'accessToken', labelKey: 'settings.socialConfig.fields.instagram.accessToken', secret: true },
      { key: 'linkedPageId', labelKey: 'settings.socialConfig.fields.instagram.linkedPageId' },
    ],
  },
  {
    id: 'whatsapp',
    titleKey: 'settings.socialConfig.whatsapp',
    descriptionKey: 'settings.socialConfig.descriptions.whatsapp',
    icon: '💬',
    statusKey: 'whatsApp',
    fields: [
      { key: 'businessAccountId', labelKey: 'settings.socialConfig.fields.whatsapp.businessAccountId' },
      { key: 'phoneNumberId', labelKey: 'settings.socialConfig.fields.whatsapp.phoneNumberId' },
      { key: 'accessToken', labelKey: 'settings.socialConfig.fields.whatsapp.accessToken', secret: true },
      { key: 'webhookVerifyToken', labelKey: 'settings.socialConfig.fields.whatsapp.webhookVerifyToken' },
    ],
  },
];

const EMPTY_TENANT_SETTINGS: TenantSettings = {
  tenantId: '',
  municipalityName: '',
  displayName: '',
  deploymentMode: 'DedicatedHosted',
  isActive: true,
  theme: null,
  domain: null,
  defaultSlaHours: 48,
};

const EMPTY_TENANT_LDAP_SETTINGS: TenantLdapFormState = {
  enabled: false,
  autoProvisionUsers: false,
  host: null,
  port: 389,
  useSsl: false,
  ignoreCertificateErrors: false,
  domain: null,
  searchBase: null,
  bindDn: null,
  hasBindPassword: false,
  userAttribute: 'mail',
  canAuthenticate: false,
  canSearch: false,
  bindPassword: '',
  clearBindPassword: false,
};

const EMPTY_RULE = {
  ruleName: '',
  keywords: '',
  targetDepartmentId: '',
  priority: 50,
};

const EMPTY_SOCIAL_FORMS: ChannelForms = {
  x: { apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '', bearerToken: '' },
  facebook: { appId: '', appSecret: '', pageAccessToken: '', pageId: '', webhookVerifyToken: '' },
  instagram: { accountId: '', accessToken: '', linkedPageId: '' },
  whatsapp: { businessAccountId: '', phoneNumberId: '', accessToken: '', webhookVerifyToken: '' },
};

function readTab(tab: string | null): SettingsTab {
  return tab === 'social' || tab === 'routing' ? tab : 'tenant';
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = readTab(searchParams.get('tab'));
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>(EMPTY_TENANT_SETTINGS);
  const [tenantLdapSettings, setTenantLdapSettings] = useState<TenantLdapFormState>(EMPTY_TENANT_LDAP_SETTINGS);
  const [socialStatus, setSocialStatus] = useState<SocialSettingsStatus | null>(null);
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [socialForms, setSocialForms] = useState<ChannelForms>(EMPTY_SOCIAL_FORMS);
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE);
  const [testContent, setTestContent] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.tenantId) {
      return;
    }

    let isActive = true;

    void Promise.all([
      api.getTenantSettings(user.tenantId),
      api.getTenantLdapSettings(user.tenantId),
      api.getSocialSettingsStatus(),
      api.getRoutingConfig(),
      api.getDepartments(),
    ])
      .then(([tenantResponse, ldapResponse, socialResponse, routingResponse, departmentResponse]) => {
        if (!isActive) {
          return;
        }

        setTenantSettings(tenantResponse);
        setTenantLdapSettings({
          ...ldapResponse,
          bindPassword: '',
          clearBindPassword: false,
        });
        setSocialStatus(socialResponse);
        setRoutingConfig(routingResponse);
        setDepartments(departmentResponse);
      })
      .catch(fetchError => {
        if (isActive) {
          setError((fetchError as Error).message);
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [user?.tenantId]);

  const setTab = (tab: SettingsTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const deploymentAdvice = useMemo(() => {
    switch (tenantSettings.deploymentMode) {
      case 'OnPrem':
        return t('settings.tenant.deploymentAdvice.onPrem');
      case 'Hosted':
        return t('settings.tenant.deploymentAdvice.hosted');
      default:
        return t('settings.tenant.deploymentAdvice.dedicatedHosted');
    }
  }, [t, tenantSettings.deploymentMode]);

  const refreshRouting = async () => setRoutingConfig(await api.getRoutingConfig());
  const refreshSocial = async () => setSocialStatus(await api.getSocialSettingsStatus());

  const saveTenant = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.tenantId) {
      return;
    }

    setMessage(null);
    try {
      await api.updateTenantSettings(user.tenantId, {
        displayName: tenantSettings.displayName,
        deploymentMode: tenantSettings.deploymentMode,
        theme: tenantSettings.theme,
        domain: tenantSettings.domain,
        defaultSlaHours: tenantSettings.defaultSlaHours,
      });
      setMessage({ type: 'success', text: t('settings.tenant.saveSuccess') });
    } catch (saveError) {
      setMessage({ type: 'error', text: (saveError as Error).message || t('settings.tenant.saveFailed') });
    }
  };

  const saveTenantLdap = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.tenantId) {
      return;
    }

    setMessage(null);
    try {
      await api.updateTenantLdapSettings(user.tenantId, {
        enabled: tenantLdapSettings.enabled,
        autoProvisionUsers: tenantLdapSettings.autoProvisionUsers,
        host: tenantLdapSettings.host,
        port: tenantLdapSettings.port,
        useSsl: tenantLdapSettings.useSsl,
        ignoreCertificateErrors: tenantLdapSettings.ignoreCertificateErrors,
        domain: tenantLdapSettings.domain,
        searchBase: tenantLdapSettings.searchBase,
        bindDn: tenantLdapSettings.bindDn,
        userAttribute: tenantLdapSettings.userAttribute,
        bindPassword: tenantLdapSettings.bindPassword || null,
        clearBindPassword: tenantLdapSettings.clearBindPassword,
      });

      const refreshedSettings = await api.getTenantLdapSettings(user.tenantId);
      setTenantLdapSettings({
        ...refreshedSettings,
        bindPassword: '',
        clearBindPassword: false,
      });
      setMessage({ type: 'success', text: t('settings.tenant.ldap.saveSuccess') });
    } catch (saveError) {
      setMessage({ type: 'error', text: (saveError as Error).message || t('settings.tenant.ldap.saveFailed') });
    }
  };

  const toggleRouting = async () => {
    if (!routingConfig) {
      return;
    }

    setMessage(null);
    try {
      const nextValue = !routingConfig.autoRoutingEnabled;
      await api.toggleAutoRouting(nextValue);
      setRoutingConfig(current => current ? { ...current, autoRoutingEnabled: nextValue } : current);
      setMessage({ type: 'success', text: nextValue ? t('settings.routing.toggleOn') : t('settings.routing.toggleOff') });
    } catch (toggleError) {
      setMessage({ type: 'error', text: (toggleError as Error).message || t('settings.routing.toggleFailed') });
    }
  };

  const saveRule = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);

    try {
      if (editingRuleId) {
        await api.updateRoutingRule(editingRuleId, { ...ruleForm, isActive: true });
        setMessage({ type: 'success', text: t('settings.routing.updated') });
      } else {
        await api.createRoutingRule(ruleForm);
        setMessage({ type: 'success', text: t('settings.routing.saved') });
      }

      setRuleForm(EMPTY_RULE);
      setEditingRuleId(null);
      setShowRuleForm(false);
      await refreshRouting();
    } catch (saveError) {
      setMessage({ type: 'error', text: (saveError as Error).message || t('settings.routing.saveFailed') });
    }
  };

  const editRule = (rule: RoutingConfig['rules'][number]) => {
    setRuleForm({
      ruleName: rule.ruleName,
      keywords: rule.keywords,
      targetDepartmentId: rule.targetDepartmentId,
      priority: rule.priority,
    });
    setEditingRuleId(rule.ruleId);
    setShowRuleForm(true);
  };

  const removeRule = async (ruleId: string) => {
    if (!window.confirm(t('settings.routing.deleteConfirm'))) {
      return;
    }

    setMessage(null);
    try {
      await api.deleteRoutingRule(ruleId);
      setMessage({ type: 'success', text: t('settings.routing.deleted') });
      await refreshRouting();
    } catch (deleteError) {
      setMessage({ type: 'error', text: (deleteError as Error).message || t('settings.routing.deleteFailed') });
    }
  };

  const testRouting = async () => {
    if (!testContent.trim()) {
      return;
    }

    setMessage(null);
    try {
      const result = await api.testRouting(testContent.trim());
      setTestResult(result.targetDepartmentName ? t('settings.routing.testSuccess', { department: result.targetDepartmentName }) : t('settings.routing.testNoMatch'));
    } catch (testError) {
      setMessage({ type: 'error', text: (testError as Error).message || t('settings.routing.testFailed') });
    }
  };

  const updateSocialField = (channel: ChannelType, key: string, value: string) => {
    setSocialForms(current => ({
      ...current,
      [channel]: {
        ...current[channel],
        [key]: value,
      },
    }));
  };

  const saveChannel = async (channel: ChannelType, event: FormEvent) => {
    event.preventDefault();
    setMessage(null);

    try {
      await api.saveSocialSettings(channel, socialForms[channel]);
      await refreshSocial();
      setActiveChannel(null);
      setMessage({ type: 'success', text: t('settings.socialConfig.saved') });
    } catch (saveError) {
      setMessage({ type: 'error', text: (saveError as Error).message || t('settings.socialConfig.saveFailed') });
    }
  };

  const testChannel = async (channel: ChannelType) => {
    setMessage(null);
    try {
      const result = await api.testSocialSettings(channel);
      setMessage({ type: result.connected ? 'success' : 'error', text: result.message });
    } catch (testError) {
      setMessage({ type: 'error', text: (testError as Error).message || t('settings.socialConfig.testFailed') });
    }
  };

  const deleteChannel = async (channel: ChannelType) => {
    setMessage(null);
    try {
      await api.deleteSocialSettings(channel);
      await refreshSocial();
      setMessage({ type: 'success', text: t('settings.socialConfig.deleted') });
    } catch (deleteError) {
      setMessage({ type: 'error', text: (deleteError as Error).message || t('errors.socialSettingsDeleteFailed') });
    }
  };

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>;
  }

  if (error) {
    return <div className="error">{t('common.error')}: {error}</div>;
  }

  return (
    <div className="page settings-page">
      <div className="page-header">
        <div>
          <h1>⚙️ {t('settings.title')}</h1>
          <p className="text-muted">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab-button ${activeTab === 'tenant' ? 'active' : ''}`} onClick={() => setTab('tenant')} type="button">🏛️ {t('settings.tabs.tenant')}</button>
        <button className={`tab-button ${activeTab === 'social' ? 'active' : ''}`} onClick={() => setTab('social')} type="button">📱 {t('settings.tabs.social')}</button>
        <button className={`tab-button ${activeTab === 'routing' ? 'active' : ''}`} onClick={() => setTab('routing')} type="button">🔀 {t('settings.tabs.routing')}</button>
      </div>

      {message ? <div className={message.type === 'success' ? 'badge success' : 'badge danger'}>{message.text}</div> : null}

      {activeTab === 'tenant' ? (
        <div className="stack">
          <section className="surface-card">
            <h2>{t('settings.tenant.overviewTitle')}</h2>
            <p>{t('settings.tenant.overviewDescription')}</p>
            <div className="info-grid" style={{ marginTop: '1rem' }}>
              <div className="info-item"><label>{t('settings.tenant.tenantId')}</label><strong>{tenantSettings.tenantId}</strong></div>
              <div className="info-item"><label>{t('settings.tenant.municipalityName')}</label><strong>{tenantSettings.municipalityName}</strong></div>
              <div className="info-item"><label>{t('settings.tenant.deploymentMode')}</label><strong>{getDeploymentModeLabel(t, tenantSettings.deploymentMode)}</strong></div>
              <div className="info-item"><label>{t('users.status')}</label><strong>{tenantSettings.isActive ? t('common.enabled') : t('common.disabled')}</strong></div>
            </div>
            <div className="muted-callout">
              <h4>{t('settings.tenant.deploymentAdvice.title')}</h4>
              <p>{deploymentAdvice}</p>
            </div>
          </section>

          <form className="surface-card" onSubmit={saveTenant}>
            <h2>{t('settings.tenant.formTitle')}</h2>
            <p>{t('settings.tenant.formDescription')}</p>
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label>{t('settings.tenant.displayName')}</label>
                <input value={tenantSettings.displayName} onChange={event => setTenantSettings(current => ({ ...current, displayName: event.target.value }))} />
              </div>
              <div className="form-group">
                <label>{t('settings.tenant.deploymentMode')}</label>
                <select value={tenantSettings.deploymentMode} onChange={event => setTenantSettings(current => ({ ...current, deploymentMode: event.target.value }))}>
                  {['OnPrem', 'Hosted', 'DedicatedHosted'].map(mode => (
                    <option key={mode} value={mode}>{getDeploymentModeLabel(t, mode)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>{t('settings.tenant.domain')}</label>
                <input placeholder={t('settings.tenant.domainPlaceholder')} value={tenantSettings.domain ?? ''} onChange={event => setTenantSettings(current => ({ ...current, domain: event.target.value || null }))} />
              </div>
              <div className="form-group">
                <label>{t('settings.tenant.theme')}</label>
                <input placeholder={t('settings.tenant.themePlaceholder')} value={tenantSettings.theme ?? ''} onChange={event => setTenantSettings(current => ({ ...current, theme: event.target.value || null }))} />
              </div>
            </div>
            <div className="form-group">
              <label>{t('settings.tenant.defaultSlaHours')}</label>
              <input min={1} type="number" value={tenantSettings.defaultSlaHours} onChange={event => setTenantSettings(current => ({ ...current, defaultSlaHours: Number(event.target.value) || 1 }))} />
            </div>
            <button className="btn primary" type="submit">{t('common.save')}</button>
          </form>

          <form className="surface-card" onSubmit={saveTenantLdap}>
            <h2>{t('settings.tenant.ldap.title')}</h2>
            <p>{t('settings.tenant.ldap.description')}</p>

            <div className="info-grid" style={{ marginTop: '1rem' }}>
              <div className="info-item"><label>{t('settings.tenant.ldap.canAuthenticate')}</label><strong>{tenantLdapSettings.canAuthenticate ? t('common.enabled') : t('common.disabled')}</strong></div>
              <div className="info-item"><label>{t('settings.tenant.ldap.canSearch')}</label><strong>{tenantLdapSettings.canSearch ? t('common.enabled') : t('common.disabled')}</strong></div>
              <div className="info-item"><label>{t('settings.tenant.ldap.hasBindPassword')}</label><strong>{tenantLdapSettings.hasBindPassword ? t('common.enabled') : t('common.disabled')}</strong></div>
            </div>

            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group checkbox-group">
                <label>
                  <input checked={tenantLdapSettings.enabled} onChange={event => setTenantLdapSettings(current => ({ ...current, enabled: event.target.checked }))} type="checkbox" />
                  {t('settings.tenant.ldap.enabled')}
                </label>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input checked={tenantLdapSettings.autoProvisionUsers} disabled={!tenantLdapSettings.enabled} onChange={event => setTenantLdapSettings(current => ({ ...current, autoProvisionUsers: event.target.checked }))} type="checkbox" />
                  {t('settings.tenant.ldap.autoProvisionUsers')}
                </label>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('settings.tenant.ldap.host')}</label>
                <input aria-label={t('settings.tenant.ldap.host')} value={tenantLdapSettings.host ?? ''} onChange={event => setTenantLdapSettings(current => ({ ...current, host: event.target.value || null }))} />
              </div>
              <div className="form-group">
                <label>{t('settings.tenant.ldap.port')}</label>
                <input aria-label={t('settings.tenant.ldap.port')} min={1} type="number" value={tenantLdapSettings.port} onChange={event => setTenantLdapSettings(current => ({ ...current, port: Number(event.target.value) || 389 }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('settings.tenant.ldap.domain')}</label>
                <input aria-label={t('settings.tenant.ldap.domain')} value={tenantLdapSettings.domain ?? ''} onChange={event => setTenantLdapSettings(current => ({ ...current, domain: event.target.value || null }))} />
              </div>
              <div className="form-group">
                <label>{t('settings.tenant.ldap.userAttribute')}</label>
                <input aria-label={t('settings.tenant.ldap.userAttribute')} value={tenantLdapSettings.userAttribute} onChange={event => setTenantLdapSettings(current => ({ ...current, userAttribute: event.target.value }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('settings.tenant.ldap.searchBase')}</label>
                <input aria-label={t('settings.tenant.ldap.searchBase')} value={tenantLdapSettings.searchBase ?? ''} onChange={event => setTenantLdapSettings(current => ({ ...current, searchBase: event.target.value || null }))} />
              </div>
              <div className="form-group">
                <label>{t('settings.tenant.ldap.bindDn')}</label>
                <input aria-label={t('settings.tenant.ldap.bindDn')} value={tenantLdapSettings.bindDn ?? ''} onChange={event => setTenantLdapSettings(current => ({ ...current, bindDn: event.target.value || null }))} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('settings.tenant.ldap.bindPassword')}</label>
                <input aria-label={t('settings.tenant.ldap.bindPassword')} placeholder={t('settings.tenant.ldap.bindPasswordPlaceholder')} type="password" value={tenantLdapSettings.bindPassword} onChange={event => setTenantLdapSettings(current => ({ ...current, bindPassword: event.target.value, clearBindPassword: false }))} />
                <p className="helper-text">
                  {tenantLdapSettings.hasBindPassword ? t('settings.tenant.ldap.bindPasswordSaved') : t('settings.tenant.ldap.bindPasswordMissing')}
                </p>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    checked={tenantLdapSettings.clearBindPassword}
                    disabled={!tenantLdapSettings.hasBindPassword}
                    onChange={event => setTenantLdapSettings(current => ({
                      ...current,
                      clearBindPassword: event.target.checked,
                      bindPassword: event.target.checked ? '' : current.bindPassword,
                    }))}
                    type="checkbox"
                  />
                  {t('settings.tenant.ldap.clearBindPassword')}
                </label>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group checkbox-group">
                <label>
                  <input checked={tenantLdapSettings.useSsl} onChange={event => setTenantLdapSettings(current => ({ ...current, useSsl: event.target.checked }))} type="checkbox" />
                  {t('settings.tenant.ldap.useSsl')}
                </label>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input checked={tenantLdapSettings.ignoreCertificateErrors} onChange={event => setTenantLdapSettings(current => ({ ...current, ignoreCertificateErrors: event.target.checked }))} type="checkbox" />
                  {t('settings.tenant.ldap.ignoreCertificateErrors')}
                </label>
              </div>
            </div>

            <div className="muted-callout">
              <h4>{t('settings.tenant.ldap.hintTitle')}</h4>
              <p>{t('settings.tenant.ldap.hint')}</p>
            </div>

            <button className="btn primary" type="submit">{t('common.save')}</button>
          </form>
        </div>
      ) : null}

      {activeTab === 'social' && socialStatus ? (
        <div className="stack">
          <section className="surface-card">
            <h2>{t('settings.socialConfig.tenantAwareTitle')}</h2>
            <p>{t('settings.socialConfig.tenantAwareDescription')}</p>
          </section>
          <div className="list-grid">
            {CHANNELS.map(channel => {
              const status = socialStatus[channel.statusKey];
              return (
                <section className={`channel-card ${status.configured ? 'configured' : ''}`} key={channel.id}>
                  <div className="channel-card-header">
                    <h3>{channel.icon} {t(channel.titleKey)}</h3>
                    <span className={`badge ${status.configured ? 'success' : 'neutral'}`}>
                      {status.configured ? t('settings.socialConfig.configured') : t('settings.socialConfig.notConfigured')}
                    </span>
                  </div>
                  <p>{t(channel.descriptionKey)}</p>
                  <div className="button-row">
                    <button className="btn secondary" onClick={() => setActiveChannel(current => current === channel.id ? null : channel.id)} type="button">{t('settings.socialConfig.configure')}</button>
                    <button className="btn ghost" onClick={() => void testChannel(channel.id)} type="button">{t('common.test')}</button>
                    {status.configured ? <button className="btn danger" onClick={() => void deleteChannel(channel.id)} type="button">{t('common.delete')}</button> : null}
                  </div>
                  {activeChannel === channel.id ? (
                    <form className="stack" onSubmit={event => void saveChannel(channel.id, event)}>
                      {channel.fields.map(field => (
                        <div className="form-group" key={field.key}>
                          <label>{t(field.labelKey)}</label>
                          <input type={field.secret ? 'password' : 'text'} value={socialForms[channel.id][field.key] ?? ''} onChange={event => updateSocialField(channel.id, field.key, event.target.value)} />
                        </div>
                      ))}
                      <button className="btn primary" type="submit">{t('common.save')}</button>
                    </form>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTab === 'routing' && routingConfig ? (
        <div className="stack">
          <section className="surface-card">
            <div className="section-header">
              <div>
                <h2>{t('settings.routing.title')}</h2>
                <p>{t('settings.routing.description')}</p>
              </div>
              <button className="btn secondary" onClick={() => void toggleRouting()} type="button">{routingConfig.autoRoutingEnabled ? t('common.enabled') : t('common.disabled')}</button>
            </div>
          </section>

          <section className="surface-card">
            <div className="section-header">
              <h2>{t('settings.routing.rules')}</h2>
              <button
                className="btn primary"
                onClick={() => {
                  setRuleForm(EMPTY_RULE);
                  setEditingRuleId(null);
                  setShowRuleForm(current => !current);
                }}
                type="button"
              >
                {t('settings.routing.newRule')}
              </button>
            </div>

            {showRuleForm ? (
              <form className="stack" onSubmit={event => void saveRule(event)}>
                <div className="form-group">
                  <label>{t('settings.routing.ruleName')}</label>
                  <input placeholder={t('settings.routing.ruleNamePlaceholder')} value={ruleForm.ruleName} onChange={event => setRuleForm(current => ({ ...current, ruleName: event.target.value }))} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('settings.routing.targetDepartment')}</label>
                    <select value={ruleForm.targetDepartmentId} onChange={event => setRuleForm(current => ({ ...current, targetDepartmentId: event.target.value }))}>
                      <option value="">{t('tasks.selectDepartment')}</option>
                      {departments.map(department => (
                        <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>{t('settings.routing.priority')}</label>
                    <input type="number" max={100} min={1} value={ruleForm.priority} onChange={event => setRuleForm(current => ({ ...current, priority: Number(event.target.value) || 1 }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('settings.routing.keywords')}</label>
                  <input placeholder={t('settings.routing.keywordsPlaceholder')} value={ruleForm.keywords} onChange={event => setRuleForm(current => ({ ...current, keywords: event.target.value }))} />
                </div>
                <div className="button-row">
                  <button className="btn primary" type="submit">{editingRuleId ? t('common.save') : t('common.create')}</button>
                  <button className="btn ghost" onClick={() => setShowRuleForm(false)} type="button">{t('common.cancel')}</button>
                </div>
              </form>
            ) : null}

            {routingConfig.rules.length === 0 ? <p>{t('settings.routing.empty')}</p> : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>{t('settings.routing.ruleName')}</th>
                      <th>{t('settings.routing.keywords')}</th>
                      <th>{t('settings.routing.targetDepartment')}</th>
                      <th>{t('settings.routing.priority')}</th>
                      <th>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routingConfig.rules.map(rule => (
                      <tr key={rule.ruleId}>
                        <td>{rule.ruleName}</td>
                        <td>{rule.keywords}</td>
                        <td>{rule.targetDepartmentName}</td>
                        <td>{rule.priority}</td>
                        <td>
                          <div className="button-row compact">
                            <button className="btn ghost" onClick={() => editRule(rule)} type="button">{t('common.edit')}</button>
                            <button className="btn danger" onClick={() => void removeRule(rule.ruleId)} type="button">{t('common.delete')}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="surface-card">
            <h2>{t('settings.routing.testTitle')}</h2>
            <div className="form-group">
              <textarea placeholder={t('settings.routing.testPlaceholder')} value={testContent} onChange={event => setTestContent(event.target.value)} />
            </div>
            <div className="button-row">
              <button className="btn primary" onClick={() => void testRouting()} type="button">{t('common.test')}</button>
            </div>
            {testResult ? <div className="badge neutral">{testResult}</div> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
