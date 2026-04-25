import type { FormEvent } from 'react'
import { Paintbrush, Settings2, ShieldCheck, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { MunicipalitySeal } from '../components/branding/MunicipalitySeal'
import { Button } from '../components/ui/button'
import { StatusPill } from '../components/ui/status-pill'
import { useAuth } from '../context/AuthContext'
import { useTenantTheme } from '../context/ThemeContext'
import { DEFAULT_TENANT_APPEARANCE, resolveTenantAppearance } from '../lib/theme'
import {
  DEFAULT_ROLE_PAGE_ACCESS,
  PAGE_ACCESS_ITEMS,
  ROLE_CODES,
  loadRolePageAccessMatrix,
  saveRolePageAccessMatrix,
  type PageAccessKey,
  type RoleCode,
  type RolePageAccessMatrix,
} from '../lib/rolePageAccess'
import type {
  Department,
  RoutingConfig,
  SocialSettingsStatus,
  TenantAppearanceInput,
  TenantAuthenticationPolicy,
  TenantLdapSettings,
  TenantSettings,
  User,
} from '../types/platform'
import { getDeploymentModeLabel, getRoleLabel } from '../utils/localization'

type SettingsTab = 'tenant' | 'appearance' | 'roles' | 'social' | 'routing' | 'citizen'
type ChannelType = 'x' | 'facebook' | 'instagram' | 'whatsapp'
type ChannelForms = Record<ChannelType, Record<string, string>>
type TenantLdapFormState = TenantLdapSettings & { bindPassword: string; clearBindPassword: boolean }

interface ChannelConfig {
  id: ChannelType
  titleKey: string
  descriptionKey: string
  statusKey: keyof SocialSettingsStatus
  fields: { key: string; labelKey: string; secret?: boolean }[]
}

const CHANNELS: ChannelConfig[] = [
  {
    id: 'x',
    titleKey: 'settings.socialConfig.x',
    descriptionKey: 'settings.socialConfig.descriptions.x',
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
    statusKey: 'whatsApp',
    fields: [
      { key: 'businessAccountId', labelKey: 'settings.socialConfig.fields.whatsapp.businessAccountId' },
      { key: 'phoneNumberId', labelKey: 'settings.socialConfig.fields.whatsapp.phoneNumberId' },
      { key: 'accessToken', labelKey: 'settings.socialConfig.fields.whatsapp.accessToken', secret: true },
      { key: 'webhookVerifyToken', labelKey: 'settings.socialConfig.fields.whatsapp.webhookVerifyToken' },
    ],
  },
]

const EMPTY_TENANT_SETTINGS: TenantSettings = {
  tenantId: '',
  municipalityName: '',
  displayName: '',
  deploymentMode: 'DedicatedHosted',
  isActive: true,
  theme: null,
  domain: null,
  defaultSlaHours: 48,
}

const EMPTY_TENANT_LDAP_SETTINGS: TenantLdapFormState = {
  enabled: false,
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
}

const EMPTY_TENANT_AUTH_POLICY: TenantAuthenticationPolicy = {
  automaticSignInEnabled: false,
  automaticSignInMode: 'Disabled',
  trustedNetworkCidrs: [],
  trustedProxyCidrs: [],
  identityHeaderName: null,
  requireSecondFactorOutsideTrustedNetwork: false,
  secondFactorProvider: 'Disabled',
  codeLength: 6,
  codeTtlSeconds: 300,
  allowMockCodePreview: false,
  webhookUrl: null,
  canAttemptAutomaticSignIn: false,
  canIssueSecondFactor: false,
}

const EMPTY_RULE = {
  ruleName: '',
  keywords: '',
  targetDepartmentId: '',
  priority: 50,
}

const EMPTY_SOCIAL_FORMS: ChannelForms = {
  x: { apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '', bearerToken: '' },
  facebook: { appId: '', appSecret: '', pageAccessToken: '', pageId: '', webhookVerifyToken: '' },
  instagram: { accountId: '', accessToken: '', linkedPageId: '' },
  whatsapp: { businessAccountId: '', phoneNumberId: '', accessToken: '', webhookVerifyToken: '' },
}

function readTab(tab: string | null): SettingsTab {
  return tab === 'appearance' || tab === 'roles' || tab === 'social' || tab === 'routing' || tab === 'citizen' ? tab : 'tenant'
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
}

export function SettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { setAppearance } = useTenantTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = readTab(searchParams.get('tab'))
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>(EMPTY_TENANT_SETTINGS)
  const [tenantLdapSettings, setTenantLdapSettings] = useState<TenantLdapFormState>(EMPTY_TENANT_LDAP_SETTINGS)
  const [tenantAuthenticationPolicy, setTenantAuthenticationPolicy] = useState<TenantAuthenticationPolicy>(EMPTY_TENANT_AUTH_POLICY)
  const [socialStatus, setSocialStatus] = useState<SocialSettingsStatus | null>(null)
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [deptManagerEditing, setDeptManagerEditing] = useState<string | null>(null)
  const [appearanceForm, setAppearanceForm] = useState<TenantAppearanceInput>({
    themePreset: DEFAULT_TENANT_APPEARANCE.themePreset,
    primaryColor: DEFAULT_TENANT_APPEARANCE.primaryColor,
    secondaryColor: DEFAULT_TENANT_APPEARANCE.secondaryColor,
    accentColor: DEFAULT_TENANT_APPEARANCE.accentColor,
    neutralColor: DEFAULT_TENANT_APPEARANCE.neutralColor,
    surfaceColor: DEFAULT_TENANT_APPEARANCE.surfaceColor,
    backgroundColor: DEFAULT_TENANT_APPEARANCE.backgroundColor,
    headerGradientFrom: DEFAULT_TENANT_APPEARANCE.headerGradientFrom,
    headerGradientTo: DEFAULT_TENANT_APPEARANCE.headerGradientTo,
    sidebarBackgroundColor: DEFAULT_TENANT_APPEARANCE.sidebarBackgroundColor,
    sidebarForegroundColor: DEFAULT_TENANT_APPEARANCE.sidebarForegroundColor,
    logoUrl: DEFAULT_TENANT_APPEARANCE.logoUrl ?? null,
    loginBackgroundImageUrl: DEFAULT_TENANT_APPEARANCE.loginBackgroundImageUrl ?? null,
  })
  const [loadedAppearance, setLoadedAppearance] = useState<TenantAppearanceInput>(appearanceForm)
  const [socialForms, setSocialForms] = useState<ChannelForms>(EMPTY_SOCIAL_FORMS)
  const [activeChannel, setActiveChannel] = useState<ChannelType | null>(null)
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE)
  const [testContent, setTestContent] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [citizenForm, setCitizenForm] = useState({ channel: 'Other', citizenHandle: '', content: '', category: '' })
  const [citizenFormSaving, setCitizenFormSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ldapTestStatus, setLdapTestStatus] = useState<{ type: 'idle' | 'testing' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })
  const [ldapUserTest, setLdapUserTest] = useState({ username: '', password: '' })
  const [ldapUserTestStatus, setLdapUserTestStatus] = useState<{ type: 'idle' | 'testing' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })
  const [rolePageAccess, setRolePageAccess] = useState<RolePageAccessMatrix>(() => loadRolePageAccessMatrix())

  useEffect(() => {
    if (!user?.tenantId) {
      return
    }

    let isActive = true

    void Promise.all([
      api.getTenantSettings(user.tenantId),
      api.getTenantLdapSettings(user.tenantId),
      api.getTenantAuthenticationPolicy(user.tenantId),
      api.getTenantAppearance(user.tenantId),
      api.getSocialSettingsStatus(),
      api.getRoutingConfig(),
      api.getDepartments(),
      api.getUsers(),
    ])
      .then(([tenantResponse, ldapResponse, authPolicyResponse, appearanceResponse, socialResponse, routingResponse, departmentResponse, usersResponse]) => {
        if (!isActive) {
          return
        }

        const nextAppearance = {
          themePreset: appearanceResponse.themePreset,
          primaryColor: appearanceResponse.primaryColor,
          secondaryColor: appearanceResponse.secondaryColor,
          accentColor: appearanceResponse.accentColor,
          neutralColor: appearanceResponse.neutralColor,
          surfaceColor: appearanceResponse.surfaceColor,
          backgroundColor: appearanceResponse.backgroundColor,
          headerGradientFrom: appearanceResponse.headerGradientFrom,
          headerGradientTo: appearanceResponse.headerGradientTo,
          sidebarBackgroundColor: appearanceResponse.sidebarBackgroundColor,
          sidebarForegroundColor: appearanceResponse.sidebarForegroundColor,
          logoUrl: appearanceResponse.logoUrl ?? null,
          loginBackgroundImageUrl: appearanceResponse.loginBackgroundImageUrl ?? null,
        }

        setTenantSettings(tenantResponse)
        setTenantLdapSettings({
          ...ldapResponse,
          bindPassword: '',
          clearBindPassword: false,
        })
        setTenantAuthenticationPolicy(authPolicyResponse)
        setAppearanceForm(nextAppearance)
        setLoadedAppearance(nextAppearance)
        setSocialStatus(socialResponse)
        setRoutingConfig(routingResponse)
        setDepartments(departmentResponse)
        setUsers(usersResponse)
      })
      .catch(loadError => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : t('common.error'))
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [t, user?.tenantId])

  const previewAppearance = resolveTenantAppearance({ ...appearanceForm, isCustomized: true })
  const institutionName = tenantSettings.displayName || tenantSettings.municipalityName || user?.tenantName || 'Tire Belediyesi'

  const organizationStats = useMemo(() => [
    { label: t('settings.organizationName'), value: institutionName },
    { label: t('settings.domain'), value: tenantSettings.domain || t('settings.domainNotConfigured') },
    { label: t('settings.deploymentMode'), value: getDeploymentModeLabel(t, tenantSettings.deploymentMode) },
    { label: t('settings.sla'), value: `${tenantSettings.defaultSlaHours} ${t('settings.hours')}` },
  ], [institutionName, t, tenantSettings.defaultSlaHours, tenantSettings.deploymentMode, tenantSettings.domain])

  const setTab = (tab: SettingsTab) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const toggleRolePageAccess = (role: RoleCode, pageKey: PageAccessKey) => {
    if (pageKey === 'dashboard' || pageKey === 'settings') return
    setRolePageAccess(current => ({
      ...current,
      [role]: {
        ...current[role],
        [pageKey]: !current[role][pageKey],
      },
    }))
  }

  const saveRolePages = () => {
    saveRolePageAccessMatrix(rolePageAccess)
    setMessage({ type: 'success', text: t('settings.roles.saveSuccess') })
  }

  const resetRolePages = () => {
    setRolePageAccess(DEFAULT_ROLE_PAGE_ACCESS)
    saveRolePageAccessMatrix(DEFAULT_ROLE_PAGE_ACCESS)
    setMessage({ type: 'success', text: t('settings.roles.resetSuccess') })
  }

  const refreshRouting = async () => setRoutingConfig(await api.getRoutingConfig())
  const refreshSocial = async () => setSocialStatus(await api.getSocialSettingsStatus())

  const saveOrganization = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.tenantId) {
      return
    }

    setMessage(null)
    try {
      await api.updateTenantSettings(user.tenantId, {
        displayName: tenantSettings.displayName,
        deploymentMode: tenantSettings.deploymentMode,
        theme: tenantSettings.theme,
        domain: tenantSettings.domain,
        defaultSlaHours: tenantSettings.defaultSlaHours,
      })
      setMessage({ type: 'success', text: t('settings.organizationSaveSuccess') })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const saveAppearanceSettings = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.tenantId) {
      return
    }

    setMessage(null)
    try {
      await api.updateTenantAppearance(user.tenantId, appearanceForm)
      const refreshed = await api.getTenantAppearance(user.tenantId)
      const nextAppearance = {
        themePreset: refreshed.themePreset,
        primaryColor: refreshed.primaryColor,
        secondaryColor: refreshed.secondaryColor,
        accentColor: refreshed.accentColor,
        neutralColor: refreshed.neutralColor,
        surfaceColor: refreshed.surfaceColor,
        backgroundColor: refreshed.backgroundColor,
        headerGradientFrom: refreshed.headerGradientFrom,
        headerGradientTo: refreshed.headerGradientTo,
        sidebarBackgroundColor: refreshed.sidebarBackgroundColor,
        sidebarForegroundColor: refreshed.sidebarForegroundColor,
        logoUrl: refreshed.logoUrl ?? null,
        loginBackgroundImageUrl: refreshed.loginBackgroundImageUrl ?? null,
      }

      setAppearanceForm(nextAppearance)
      setLoadedAppearance(nextAppearance)
      setAppearance(refreshed)
      setMessage({ type: 'success', text: t('settings.appearanceSaveSuccess') })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const saveTenantLdap = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.tenantId) {
      return
    }

    setMessage(null)
    try {
      await api.updateTenantLdapSettings(user.tenantId, {
        enabled: tenantLdapSettings.enabled,
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
      })

      const refreshedSettings = await api.getTenantLdapSettings(user.tenantId)
      setTenantLdapSettings({
        ...refreshedSettings,
        bindPassword: '',
        clearBindPassword: false,
      })
      setMessage({ type: 'success', text: t('settings.ldapSaveSuccess') })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const testLdapConnectivity = async () => {
    if (!user?.tenantId) return
    setLdapTestStatus({ type: 'testing', message: t('settings.ldapTesting') })
    try {
      const result = await api.testLdapConnectivity(user.tenantId, {
        host: tenantLdapSettings.host,
        port: tenantLdapSettings.port,
        useSsl: tenantLdapSettings.useSsl,
        ignoreCertificateErrors: tenantLdapSettings.ignoreCertificateErrors,
        domain: tenantLdapSettings.domain,
        searchBase: tenantLdapSettings.searchBase,
        bindDn: tenantLdapSettings.bindDn,
        bindPassword: tenantLdapSettings.bindPassword || null,
      })
      setLdapTestStatus({
        type: result.success ? 'success' : 'error',
        message: result.success ? t('settings.ldapTestSuccess') : (result.message || t('settings.ldapTestFailed')),
      })
    } catch {
      setLdapTestStatus({ type: 'error', message: t('settings.ldapTestFailed') })
    }
  }

  const testLdapUserCredentials = async () => {
    if (!user?.tenantId || !ldapUserTest.username || !ldapUserTest.password) return
    setLdapUserTestStatus({ type: 'testing', message: t('settings.ldapTesting') })
    try {
      const result = await api.testLdapUserCredentials(user.tenantId, {
        username: ldapUserTest.username,
        password: ldapUserTest.password,
      })
      setLdapUserTestStatus({
        type: result.success ? 'success' : 'error',
        message: result.success
          ? t('settings.ldapTestUserSuccess', { displayName: result.displayName || ldapUserTest.username })
          : (result.message || t('settings.ldapTestUserFailed')),
      })
    } catch {
      setLdapUserTestStatus({ type: 'error', message: t('settings.ldapTestUserFailed') })
    }
  }

  const saveTenantAuthenticationPolicy = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.tenantId) {
      return
    }

    setMessage(null)
    try {
      await api.updateTenantAuthenticationPolicy(user.tenantId, {
        automaticSignInEnabled: tenantAuthenticationPolicy.automaticSignInEnabled,
        automaticSignInMode: tenantAuthenticationPolicy.automaticSignInMode,
        trustedNetworkCidrs: tenantAuthenticationPolicy.trustedNetworkCidrs,
        trustedProxyCidrs: tenantAuthenticationPolicy.trustedProxyCidrs,
        identityHeaderName: tenantAuthenticationPolicy.identityHeaderName,
        requireSecondFactorOutsideTrustedNetwork: tenantAuthenticationPolicy.requireSecondFactorOutsideTrustedNetwork,
        secondFactorProvider: tenantAuthenticationPolicy.secondFactorProvider,
        codeLength: tenantAuthenticationPolicy.codeLength,
        codeTtlSeconds: tenantAuthenticationPolicy.codeTtlSeconds,
        allowMockCodePreview: tenantAuthenticationPolicy.allowMockCodePreview,
        webhookUrl: tenantAuthenticationPolicy.webhookUrl,
      })

      setTenantAuthenticationPolicy(await api.getTenantAuthenticationPolicy(user.tenantId))
      setMessage({ type: 'success', text: t('settings.authSaveSuccess') })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const toggleRouting = async () => {
    if (!routingConfig) {
      return
    }

    setMessage(null)
    try {
      const nextValue = !routingConfig.autoRoutingEnabled
      await api.toggleAutoRouting(nextValue)
      setRoutingConfig(current => current ? { ...current, autoRoutingEnabled: nextValue } : current)
      setMessage({ type: 'success', text: nextValue ? t('settings.routing.toggleOn') : t('settings.routing.toggleOff') })
    } catch (toggleError) {
      setMessage({ type: 'error', text: toggleError instanceof Error ? toggleError.message : t('common.error') })
    }
  }

  const saveRule = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)

    try {
      if (editingRuleId) {
        await api.updateRoutingRule(editingRuleId, { ...ruleForm, isActive: true })
        setMessage({ type: 'success', text: t('settings.routing.updated') })
      } else {
        await api.createRoutingRule(ruleForm)
        setMessage({ type: 'success', text: t('settings.routing.saved') })
      }

      setRuleForm(EMPTY_RULE)
      setEditingRuleId(null)
      setShowRuleForm(false)
      await refreshRouting()
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const editRule = (rule: RoutingConfig['rules'][number]) => {
    setRuleForm({
      ruleName: rule.ruleName,
      keywords: rule.keywords,
      targetDepartmentId: rule.targetDepartmentId,
      priority: rule.priority,
    })
    setEditingRuleId(rule.ruleId)
    setShowRuleForm(true)
  }

  const removeRule = async (ruleId: string) => {
    if (!window.confirm(t('settings.routing.deleteConfirm'))) {
      return
    }

    setMessage(null)
    try {
      await api.deleteRoutingRule(ruleId)
      setMessage({ type: 'success', text: t('settings.routing.deleted') })
      await refreshRouting()
    } catch (deleteError) {
      setMessage({ type: 'error', text: deleteError instanceof Error ? deleteError.message : t('common.error') })
    }
  }

  const testRouting = async () => {
    if (!testContent.trim()) {
      return
    }

    setMessage(null)
    try {
      const result = await api.testRouting(testContent.trim())
      setTestResult(result.targetDepartmentName ? t('settings.routing.testSuccess', { department: result.targetDepartmentName }) : t('settings.routing.testNoMatch'))
    } catch (testError) {
      setMessage({ type: 'error', text: testError instanceof Error ? testError.message : t('common.error') })
    }
  }

  const submitCitizenForm = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    setCitizenFormSaving(true)
    try {
      await api.createSocialMessage({
        channel: citizenForm.channel,
        citizenHandle: citizenForm.citizenHandle.trim(),
        content: citizenForm.content.trim(),
        category: citizenForm.category.trim() || undefined,
      })
      setMessage({ type: 'success', text: t('settings.citizen.successMessage') })
      setCitizenForm({ channel: 'Other', citizenHandle: '', content: '', category: '' })
    } catch (submitError) {
      setMessage({ type: 'error', text: submitError instanceof Error ? submitError.message : t('common.error') })
    } finally {
      setCitizenFormSaving(false)
    }
  }

  const assignDepartmentManager = async (dept: Department, managerId: string | null) => {
    try {
      const updated = await api.updateDepartment(dept.departmentId, dept.name, dept.departmentType, managerId)
      setDepartments(current => current.map(d => d.departmentId === updated.departmentId ? updated : d))
      setDeptManagerEditing(null)
      setMessage({ type: 'success', text: t('settings.departments.managerSaved', 'Müdür güncellendi.') })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('common.error') })
    }
  }

  const updateSocialField = (channel: ChannelType, key: string, value: string) => {
    setSocialForms(current => ({
      ...current,
      [channel]: {
        ...current[channel],
        [key]: value,
      },
    }))
  }

  const saveChannel = async (channel: ChannelType, event: FormEvent) => {
    event.preventDefault()
    setMessage(null)

    try {
      await api.saveSocialSettings(channel, socialForms[channel])
      await refreshSocial()
      setActiveChannel(null)
      setMessage({ type: 'success', text: t('settings.socialConfig.saved') })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const testChannel = async (channel: ChannelType) => {
    setMessage(null)
    try {
      const result = await api.testSocialSettings(channel)
      setMessage({ type: result.connected ? 'success' : 'error', text: result.message })
    } catch (testError) {
      setMessage({ type: 'error', text: testError instanceof Error ? testError.message : t('common.error') })
    }
  }

  const deleteChannel = async (channel: ChannelType) => {
    setMessage(null)
    try {
      await api.deleteSocialSettings(channel)
      await refreshSocial()
      setMessage({ type: 'success', text: t('settings.socialConfig.deleted') })
    } catch (deleteError) {
      setMessage({ type: 'error', text: deleteError instanceof Error ? deleteError.message : t('common.error') })
    }
  }

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  if (error) {
    return <div className="error">{t('common.error')}: {error}</div>
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="page-header-row">
        <div className="space-y-2">
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-subtitle">{t('settings.subtitle')}</p>
        </div>
        <StatusPill tone="success">{institutionName}</StatusPill>
      </header>

      <div className="tab-bar">
        <button className={`tab-button ${activeTab === 'tenant' ? 'active' : ''}`} onClick={() => setTab('tenant')} type="button">
          {t('settings.tabs.organization')}
        </button>
        <button className={`tab-button ${activeTab === 'appearance' ? 'active' : ''}`} onClick={() => setTab('appearance')} type="button">
          {t('settings.tabs.appearance')}
        </button>
        <button className={`tab-button ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')} type="button">
          {t('settings.tabs.roles')}
        </button>
        <button className={`tab-button ${activeTab === 'social' ? 'active' : ''}`} onClick={() => setTab('social')} type="button">
          {t('settings.tabs.social')}
        </button>
        <button className={`tab-button ${activeTab === 'routing' ? 'active' : ''}`} onClick={() => setTab('routing')} type="button">
          {t('settings.tabs.routing')}
        </button>
        <button className={`tab-button ${activeTab === 'citizen' ? 'active' : ''}`} onClick={() => setTab('citizen')} type="button">
          {t('settings.tabs.citizen')}
        </button>
      </div>

      {message ? (
        <div className={message.type === 'success' ? 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700' : 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'}>
          {message.text}
        </div>
      ) : null}

      {activeTab === 'tenant' ? (
        <div className="page-stack desktop-page-shell">
          <div className="grid gap-4">
            <section className="section-card page-stack">
              <div className="page-header-row">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">{t('settings.organizationSectionTitle')}</h2>
                  <p className="helper-copy">{t('settings.organizationSectionDescription')}</p>
                </div>
                <StatusPill tone={tenantSettings.isActive ? 'success' : 'danger'}>
                  {tenantSettings.isActive ? t('common.enabled') : t('common.disabled')}
                </StatusPill>
              </div>
              <div className="info-grid">
                {organizationStats.map(item => (
                  <div className="info-item" key={item.label}>
                    <label>{item.label}</label>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
              <form className="page-stack" onSubmit={saveOrganization}>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    <span>{t('settings.organizationName')}</span>
                    <input className="field-input" value={tenantSettings.displayName} onChange={event => setTenantSettings(current => ({ ...current, displayName: event.target.value }))} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    <span>{t('settings.deploymentMode')}</span>
                    <select className="field-select" value={tenantSettings.deploymentMode} onChange={event => setTenantSettings(current => ({ ...current, deploymentMode: event.target.value }))}>
                      {['OnPrem', 'Hosted', 'DedicatedHosted'].map(mode => (
                        <option key={mode} value={mode}>{getDeploymentModeLabel(t, mode)}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    <span>{t('settings.domain')}</span>
                    <input className="field-input" placeholder={t('settings.domainPlaceholder')} value={tenantSettings.domain ?? ''} onChange={event => setTenantSettings(current => ({ ...current, domain: event.target.value || null }))} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    <span>{t('settings.themeKey')}</span>
                    <input className="field-input" placeholder={t('settings.themeKeyPlaceholder')} value={tenantSettings.theme ?? ''} onChange={event => setTenantSettings(current => ({ ...current, theme: event.target.value || null }))} />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-semibold text-slate-700 max-w-[220px]">
                  <span>{t('settings.sla')}</span>
                  <input className="field-input" min={1} type="number" value={tenantSettings.defaultSlaHours} onChange={event => setTenantSettings(current => ({ ...current, defaultSlaHours: Number(event.target.value) || 1 }))} />
                </label>
                <div className="inline-actions">
                  <Button type="submit">{t('common.save')}</Button>
                </div>
              </form>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <form className="section-card page-stack" onSubmit={saveTenantLdap}>
              <div className="page-header-row">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">{t('settings.ldapTitle')}</h2>
                  <p className="helper-copy">{t('settings.ldapDescription')}</p>
                </div>
                <UsersRound className="size-5 text-slate-400" />
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
                {t('settings.ldapOnboardingNote')}
              </div>
              <div className="info-grid">
                <div className="info-item"><label>{t('settings.ldapCanAuthenticate')}</label><strong>{tenantLdapSettings.canAuthenticate ? t('common.enabled') : t('common.disabled')}</strong></div>
                <div className="info-item"><label>{t('settings.ldapCanSearch')}</label><strong>{tenantLdapSettings.canSearch ? t('common.enabled') : t('common.disabled')}</strong></div>
                <div className="info-item"><label>{t('settings.ldapHasPassword')}</label><strong>{tenantLdapSettings.hasBindPassword ? t('common.enabled') : t('common.disabled')}</strong></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input className="field-checkbox" checked={tenantLdapSettings.enabled} type="checkbox" onChange={event => setTenantLdapSettings(current => ({ ...current, enabled: event.target.checked }))} />
                  {t('settings.ldapEnabled')}
                </label>

              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.ldapHost')}</span>
                  <input aria-label={t('settings.ldapHost')} className="field-input" value={tenantLdapSettings.host ?? ''} onChange={event => setTenantLdapSettings(current => ({ ...current, host: event.target.value || null }))} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.ldapPort')}</span>
                  <input aria-label={t('settings.ldapPort')} className="field-input" min={1} type="number" value={tenantLdapSettings.port} onChange={event => setTenantLdapSettings(current => ({ ...current, port: Number(event.target.value) || 389 }))} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.ldapDomain')}</span>
                  <input aria-label={t('settings.ldapDomain')} className="field-input" value={tenantLdapSettings.domain ?? ''} onChange={event => setTenantLdapSettings(current => ({ ...current, domain: event.target.value || null }))} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.ldapUserAttribute')}</span>
                  <input aria-label={t('settings.ldapUserAttribute')} className="field-input" value={tenantLdapSettings.userAttribute} onChange={event => setTenantLdapSettings(current => ({ ...current, userAttribute: event.target.value }))} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.ldapSearchBase')}</span>
                  <input aria-label={t('settings.ldapSearchBase')} className="field-input" value={tenantLdapSettings.searchBase ?? ''} onChange={event => setTenantLdapSettings(current => ({ ...current, searchBase: event.target.value || null }))} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.ldapBindDn')}</span>
                  <input aria-label={t('settings.ldapBindDn')} className="field-input" value={tenantLdapSettings.bindDn ?? ''} onChange={event => setTenantLdapSettings(current => ({ ...current, bindDn: event.target.value || null }))} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px] md:items-end">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.ldapBindPassword')}</span>
                  <input aria-label={t('settings.ldapBindPassword')} className="field-input" placeholder={t('settings.ldapBindPasswordPlaceholder')} type="password" value={tenantLdapSettings.bindPassword} onChange={event => setTenantLdapSettings(current => ({ ...current, bindPassword: event.target.value, clearBindPassword: false }))} />
                  <span className="helper-copy">{tenantLdapSettings.hasBindPassword ? t('settings.ldapPasswordStored') : t('settings.ldapPasswordMissing')}</span>
                </label>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input className="field-checkbox" checked={tenantLdapSettings.clearBindPassword} disabled={!tenantLdapSettings.hasBindPassword} type="checkbox" onChange={event => setTenantLdapSettings(current => ({ ...current, clearBindPassword: event.target.checked, bindPassword: event.target.checked ? '' : current.bindPassword }))} />
                  {t('settings.ldapClearPassword')}
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input className="field-checkbox" checked={tenantLdapSettings.useSsl} type="checkbox" onChange={event => setTenantLdapSettings(current => ({ ...current, useSsl: event.target.checked }))} />
                  {t('settings.ldapUseSsl')}
                </label>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input className="field-checkbox" checked={tenantLdapSettings.ignoreCertificateErrors} type="checkbox" onChange={event => setTenantLdapSettings(current => ({ ...current, ignoreCertificateErrors: event.target.checked }))} />
                  {t('settings.ldapIgnoreCertificateErrors')}
                </label>
              </div>
              <div className="inline-actions">
                <Button type="submit">{t('common.save')}</Button>
              </div>

              {tenantLdapSettings.host ? (
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{t('settings.ldapConnectionStatus')}</div>
                      {ldapTestStatus.type !== 'idle' ? (
                        <div className={`mt-1 text-sm font-medium ${ldapTestStatus.type === 'success' ? 'text-emerald-700' : ldapTestStatus.type === 'error' ? 'text-rose-700' : 'text-sky-700'}`}>
                          {ldapTestStatus.type === 'success' ? '✅ ' : ldapTestStatus.type === 'error' ? '❌ ' : '⏳ '}
                          {ldapTestStatus.message}
                        </div>
                      ) : null}
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={testLdapConnectivity} disabled={ldapTestStatus.type === 'testing'}>
                      {ldapTestStatus.type === 'testing' ? t('settings.ldapTesting') : t('settings.ldapTestConnectivity')}
                    </Button>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="text-sm font-semibold text-slate-700 mb-2">{t('settings.ldapTestUserCredentials')}</div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="grid gap-1.5 text-sm font-medium text-slate-600">
                        <span>{t('settings.ldapTestUsername')}</span>
                        <input className="field-input" value={ldapUserTest.username} onChange={e => setLdapUserTest(c => ({ ...c, username: e.target.value }))} />
                      </label>
                      <label className="grid gap-1.5 text-sm font-medium text-slate-600">
                        <span>{t('settings.ldapTestPassword')}</span>
                        <input className="field-input" type="password" value={ldapUserTest.password} onChange={e => setLdapUserTest(c => ({ ...c, password: e.target.value }))} />
                      </label>
                      <Button type="button" variant="secondary" size="sm" onClick={testLdapUserCredentials} disabled={ldapUserTestStatus.type === 'testing' || !ldapUserTest.username || !ldapUserTest.password}>
                        {ldapUserTestStatus.type === 'testing' ? t('settings.ldapTesting') : t('common.test')}
                      </Button>
                    </div>
                    {ldapUserTestStatus.type !== 'idle' ? (
                      <div className={`mt-2 text-sm font-medium ${ldapUserTestStatus.type === 'success' ? 'text-emerald-700' : ldapUserTestStatus.type === 'error' ? 'text-rose-700' : 'text-sky-700'}`}>
                        {ldapUserTestStatus.type === 'success' ? '✅ ' : ldapUserTestStatus.type === 'error' ? '❌ ' : '⏳ '}
                        {ldapUserTestStatus.message}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </form>

            <form className="section-card page-stack" onSubmit={saveTenantAuthenticationPolicy}>
              <div className="page-header-row">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">{t('settings.authTitle')}</h2>
                  <p className="helper-copy">{t('settings.authDescription')}</p>
                </div>
                <ShieldCheck className="size-5 text-slate-400" />
              </div>
              <div className="info-grid">
                <div className="info-item"><label>{t('settings.authAutomaticReady')}</label><strong>{tenantAuthenticationPolicy.canAttemptAutomaticSignIn ? t('common.enabled') : t('common.disabled')}</strong></div>
                <div className="info-item"><label>{t('settings.authSecondFactorReady')}</label><strong>{tenantAuthenticationPolicy.canIssueSecondFactor ? t('common.enabled') : t('common.disabled')}</strong></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input className="field-checkbox" checked={tenantAuthenticationPolicy.automaticSignInEnabled} type="checkbox" onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, automaticSignInEnabled: event.target.checked }))} />
                  {t('settings.authAutomaticSignInEnabled')}
                </label>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input className="field-checkbox" checked={tenantAuthenticationPolicy.requireSecondFactorOutsideTrustedNetwork} type="checkbox" onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, requireSecondFactorOutsideTrustedNetwork: event.target.checked }))} />
                  {t('settings.authRequireSecondFactor')}
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.authAutomaticSignInMode')}</span>
                  <select aria-label={t('settings.authAutomaticSignInMode')} className="field-select" value={tenantAuthenticationPolicy.automaticSignInMode} onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, automaticSignInMode: event.target.value }))}>
                    {['Disabled', 'TrustedHeader', 'Negotiate'].map(mode => (
                      <option key={mode} value={mode}>{t(`settings.authAutomaticSignInModes.${mode}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.authSecondFactorProvider')}</span>
                  <select aria-label={t('settings.authSecondFactorProvider')} className="field-select" value={tenantAuthenticationPolicy.secondFactorProvider} onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, secondFactorProvider: event.target.value }))}>
                    {['Disabled', 'Mock', 'Webhook'].map(provider => (
                      <option key={provider} value={provider}>{t(`settings.authSecondFactorProviders.${provider}`)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.authTrustedNetworks')}</span>
                  <textarea aria-label={t('settings.authTrustedNetworks')} className="field-textarea" placeholder={t('settings.authTrustedNetworksPlaceholder')} rows={4} value={tenantAuthenticationPolicy.trustedNetworkCidrs.join('\n')} onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, trustedNetworkCidrs: splitLines(event.target.value) }))} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.authTrustedProxies')}</span>
                  <textarea aria-label={t('settings.authTrustedProxies')} className="field-textarea" placeholder={t('settings.authTrustedProxiesPlaceholder')} rows={4} value={tenantAuthenticationPolicy.trustedProxyCidrs.join('\n')} onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, trustedProxyCidrs: splitLines(event.target.value) }))} />
                </label>
              </div>
              {tenantAuthenticationPolicy.automaticSignInMode === 'TrustedHeader' ? (
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.authIdentityHeaderName')}</span>
                  <input aria-label={t('settings.authIdentityHeaderName')} className="field-input" placeholder={t('settings.authIdentityHeaderPlaceholder')} value={tenantAuthenticationPolicy.identityHeaderName ?? ''} onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, identityHeaderName: event.target.value || null }))} />
                </label>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.authCodeLength')}</span>
                  <input className="field-input" max={8} min={4} type="number" value={tenantAuthenticationPolicy.codeLength} onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, codeLength: Number(event.target.value) || 6 }))} />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.authCodeTtl')}</span>
                  <input className="field-input" max={900} min={60} type="number" value={tenantAuthenticationPolicy.codeTtlSeconds} onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, codeTtlSeconds: Number(event.target.value) || 300 }))} />
                </label>
              </div>
              {tenantAuthenticationPolicy.secondFactorProvider === 'Mock' ? (
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input className="field-checkbox" checked={tenantAuthenticationPolicy.allowMockCodePreview} type="checkbox" onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, allowMockCodePreview: event.target.checked }))} />
                  {t('settings.authAllowMockPreview')}
                </label>
              ) : null}
              {tenantAuthenticationPolicy.secondFactorProvider === 'Webhook' ? (
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.authWebhookUrl')}</span>
                  <input aria-label={t('settings.authWebhookUrl')} className="field-input" placeholder={t('settings.authWebhookUrlPlaceholder')} value={tenantAuthenticationPolicy.webhookUrl ?? ''} onChange={event => setTenantAuthenticationPolicy(current => ({ ...current, webhookUrl: event.target.value || null }))} />
                </label>
              ) : null}
              <div className="inline-actions">
                <Button type="submit">{t('common.save')}</Button>
              </div>
            </form>
          </div>

          <section className="section-card page-stack">
            <div className="page-header-row">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">{t('settings.departments.sectionTitle', 'Müdürlükler')}</h2>
                <p className="helper-copy">{t('settings.departments.sectionDescription', 'Her müdürlüğün müdürünü buradan atayın.')}</p>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('settings.departments.name', 'Müdürlük Adı')}</th>
                  <th>{t('settings.departments.type', 'Tür')}</th>
                  <th>{t('settings.departments.manager', 'Müdür')}</th>
                  <th>{t('settings.departments.actions', 'İşlem')}</th>
                </tr>
              </thead>
              <tbody>
                {departments.map(dept => {
                  const currentManager = users.find(u => u.userId === dept.managerUserId)
                  const isEditing = deptManagerEditing === dept.departmentId
                  return (
                    <tr key={dept.departmentId}>
                      <td>{dept.name}</td>
                      <td>{dept.departmentType}</td>
                      <td>
                        {isEditing ? (
                          <select
                            className="field-select"
                            defaultValue={dept.managerUserId ?? ''}
                            onChange={async e => {
                              const val = e.target.value || null
                              await assignDepartmentManager(dept, val)
                            }}
                          >
                            <option value="">{t('settings.departments.noManager', '— Müdür Yok —')}</option>
                            {users.filter(u => u.isActive).map(u => (
                              <option key={u.userId} value={u.userId}>{u.displayName}</option>
                            ))}
                          </select>
                        ) : (
                          <span>{currentManager?.displayName ?? '—'}</span>
                        )}
                      </td>
                      <td className="actions-cell">
                        {isEditing ? (
                          <Button size="sm" variant="secondary" onClick={() => setDeptManagerEditing(null)}>
                            {t('common.cancel', 'İptal')}
                          </Button>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => setDeptManagerEditing(dept.departmentId)}>
                            {t('settings.departments.assignManager', 'Müdür Ata')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      {activeTab === 'appearance' ? (
        <div className="page-stack desktop-page-shell">
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="section-card page-stack">
              <div className="page-header-row">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">{t('settings.appearancePreviewTitle')}</h2>
                  <p className="helper-copy">{t('settings.appearancePreviewDescription')}</p>
                </div>
                <Paintbrush className="size-5 text-slate-400" />
              </div>
              <div
                className="rounded-[var(--radius-xl)] p-6 text-white shadow-[var(--shadow-edge)]"
                style={{
                  backgroundImage: previewAppearance.loginBackgroundImageUrl
                    ? `linear-gradient(135deg, ${previewAppearance.headerGradientFrom}, ${previewAppearance.headerGradientTo}), url("${previewAppearance.loginBackgroundImageUrl}")`
                    : `linear-gradient(135deg, ${previewAppearance.headerGradientFrom}, ${previewAppearance.headerGradientTo})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundBlendMode: previewAppearance.loginBackgroundImageUrl ? 'multiply' : undefined,
                }}
              >
                <MunicipalitySeal compact src={previewAppearance.logoUrl ?? null} />
                <h3 className="mt-4 text-3xl font-extrabold">{institutionName}</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/78">{t('settings.appearancePreviewBody')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  previewAppearance.primaryColor,
                  previewAppearance.secondaryColor,
                  previewAppearance.accentColor,
                  previewAppearance.neutralColor,
                  previewAppearance.surfaceColor,
                  previewAppearance.sidebarBackgroundColor,
                ].map(color => (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3" key={color}>
                    <div className="h-14 rounded-xl" style={{ backgroundColor: color }} />
                    <div className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{color}</div>
                  </div>
                ))}
              </div>
            </section>

            <form className="section-card page-stack" onSubmit={saveAppearanceSettings}>
              <div className="page-header-row">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">{t('settings.appearanceTitle')}</h2>
                  <p className="helper-copy">{t('settings.appearanceDescription')}</p>
                </div>
                <Settings2 className="size-5 text-slate-400" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ['themePreset', t('settings.themePreset')],
                    ['primaryColor', t('settings.primaryColor')],
                    ['secondaryColor', t('settings.secondaryColor')],
                    ['accentColor', t('settings.accentColor')],
                    ['neutralColor', t('settings.neutralColor')],
                    ['surfaceColor', t('settings.surfaceColor')],
                    ['backgroundColor', t('settings.backgroundColor')],
                    ['headerGradientFrom', t('settings.headerGradientFrom')],
                    ['headerGradientTo', t('settings.headerGradientTo')],
                    ['sidebarBackgroundColor', t('settings.sidebarBackgroundColor')],
                    ['sidebarForegroundColor', t('settings.sidebarForegroundColor')],
                    ['logoUrl', t('settings.logoUrl')],
                    ['loginBackgroundImageUrl', t('settings.loginBackgroundImageUrl')],
                  ] as const
                ).map(([field, label]) => (
                  <label className="grid gap-2 text-sm font-semibold text-slate-700" key={field}>
                    <span>{label}</span>
                    <input
                      className="field-input"
                      placeholder={field === 'logoUrl' || field === 'loginBackgroundImageUrl' ? t('settings.urlPlaceholder') : undefined}
                      value={appearanceForm[field] ?? ''}
                      onChange={event => {
                        const nextValue = event.target.value
                        setAppearanceForm(current => ({
                          ...current,
                          [field]:
                            field === 'logoUrl' || field === 'loginBackgroundImageUrl'
                              ? (nextValue || null)
                              : nextValue,
                        }))
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="inline-actions">
                <Button type="submit">{t('common.save')}</Button>
                <Button type="button" variant="secondary" onClick={() => setAppearanceForm(loadedAppearance)}>{t('settings.reset')}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {activeTab === 'roles' ? (
        <section className="section-card page-stack">
          <div className="page-header-row">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">{t('settings.roles.title')}</h2>
              <p className="helper-copy">{t('settings.roles.description')}</p>
            </div>
            <ShieldCheck className="size-5 text-slate-400" />
          </div>
          <div className="table-wrap">
            <table className="data-table role-matrix-table">
              <thead>
                <tr>
                  <th>{t('settings.roles.page')}</th>
                  {ROLE_CODES.map(role => (
                    <th key={role}>{getRoleLabel(t, role)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PAGE_ACCESS_ITEMS.map(page => (
                  <tr key={page.key}>
                    <td className="font-semibold">{t(page.labelKey)}</td>
                    {ROLE_CODES.map(role => {
                      const disabled = page.key === 'dashboard' || page.key === 'settings'
                      return (
                        <td key={`${role}-${page.key}`}>
                          <label className="role-matrix-toggle">
                            <input
                              checked={rolePageAccess[role][page.key]}
                              disabled={disabled}
                              type="checkbox"
                              onChange={() => toggleRolePageAccess(role, page.key)}
                            />
                            <span>{rolePageAccess[role][page.key] ? t('common.enabled') : t('common.disabled')}</span>
                          </label>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="helper-copy">{t('settings.roles.note')}</p>
          <div className="inline-actions">
            <Button type="button" onClick={saveRolePages}>{t('common.save')}</Button>
            <Button type="button" variant="secondary" onClick={resetRolePages}>{t('settings.roles.resetDefaults')}</Button>
          </div>
        </section>
      ) : null}

      {activeTab === 'social' && socialStatus ? (
        <div className="page-stack desktop-page-shell">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('settings.socialConfig.sectionTitle')}</h2>
            <p className="helper-copy">{t('settings.socialConfig.sectionDescription')}</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {CHANNELS.map(channel => {
              const status = socialStatus[channel.statusKey]
              return (
                <section className="section-card page-stack" key={channel.id}>
                  <div className="page-header-row">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-950">{t(channel.titleKey)}</h3>
                      <p className="helper-copy">{t(channel.descriptionKey)}</p>
                    </div>
                    <StatusPill tone={status.configured ? 'success' : 'neutral'}>
                      {status.configured ? t('settings.socialConfig.configured') : t('settings.socialConfig.notConfigured')}
                    </StatusPill>
                  </div>
                  <div className="inline-actions">
                    <Button size="sm" type="button" variant="secondary" onClick={() => setActiveChannel(current => current === channel.id ? null : channel.id)}>{t('settings.socialConfig.configure')}</Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => void testChannel(channel.id)}>{t('common.test')}</Button>
                    {status.configured ? <Button size="sm" type="button" variant="danger" onClick={() => void deleteChannel(channel.id)}>{t('common.delete')}</Button> : null}
                  </div>
                  {activeChannel === channel.id ? (
                    <form className="page-stack" onSubmit={event => void saveChannel(channel.id, event)}>
                      {channel.fields.map(field => (
                        <label className="grid gap-2 text-sm font-semibold text-slate-700" key={field.key}>
                          <span>{t(field.labelKey)}</span>
                          <input className="field-input" type={field.secret ? 'password' : 'text'} value={socialForms[channel.id][field.key] ?? ''} onChange={event => updateSocialField(channel.id, field.key, event.target.value)} />
                        </label>
                      ))}
                      <div className="inline-actions">
                        <Button type="submit">{t('common.save')}</Button>
                      </div>
                    </form>
                  ) : null}
                </section>
              )
            })}
          </div>
        </div>
      ) : null}

      {activeTab === 'routing' && routingConfig ? (
        <div className="page-stack desktop-page-shell">
          <section className="section-card page-stack">
            <div className="page-header-row">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">{t('settings.routing.title')}</h2>
                <p className="helper-copy">{t('settings.routing.description')}</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => void toggleRouting()}>
                {routingConfig.autoRoutingEnabled ? t('common.enabled') : t('common.disabled')}
              </Button>
            </div>
          </section>

          <section className="section-card page-stack">
            <div className="page-header-row">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">{t('settings.routing.rules')}</h2>
                <p className="helper-copy">{t('settings.routing.rulesDescription')}</p>
              </div>
              <Button type="button" onClick={() => {
                setRuleForm(EMPTY_RULE)
                setEditingRuleId(null)
                setShowRuleForm(current => !current)
              }}>{t('settings.routing.newRule')}</Button>
            </div>
            {showRuleForm ? (
              <form className="page-stack" onSubmit={event => void saveRule(event)}>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.routing.ruleName')}</span>
                  <input className="field-input" placeholder={t('settings.routing.ruleNamePlaceholder')} value={ruleForm.ruleName} onChange={event => setRuleForm(current => ({ ...current, ruleName: event.target.value }))} />
                </label>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    <span>{t('settings.routing.targetDepartment')}</span>
                    <select className="field-select" value={ruleForm.targetDepartmentId} onChange={event => setRuleForm(current => ({ ...current, targetDepartmentId: event.target.value }))}>
                      <option value="">{t('tasks.selectDepartment')}</option>
                      {departments.map(department => (
                        <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    <span>{t('settings.routing.priority')}</span>
                    <input className="field-input" max={100} min={1} type="number" value={ruleForm.priority} onChange={event => setRuleForm(current => ({ ...current, priority: Number(event.target.value) || 1 }))} />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.routing.keywords')}</span>
                  <input className="field-input" placeholder={t('settings.routing.keywordsPlaceholder')} value={ruleForm.keywords} onChange={event => setRuleForm(current => ({ ...current, keywords: event.target.value }))} />
                </label>
                <div className="inline-actions">
                  <Button type="submit">{editingRuleId ? t('common.save') : t('common.create')}</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowRuleForm(false)}>{t('common.cancel')}</Button>
                </div>
              </form>
            ) : null}
            {routingConfig.rules.length === 0 ? (
              <div className="empty-state">{t('settings.routing.empty')}</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
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
                        <td className="font-semibold">{rule.ruleName}</td>
                        <td>{rule.keywords}</td>
                        <td>{rule.targetDepartmentName}</td>
                        <td>{rule.priority}</td>
                        <td>
                          <div className="inline-actions">
                            <Button size="sm" type="button" variant="ghost" onClick={() => editRule(rule)}>{t('common.edit')}</Button>
                            <Button size="sm" type="button" variant="danger" onClick={() => void removeRule(rule.ruleId)}>{t('common.delete')}</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="section-card page-stack">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">{t('settings.routing.testTitle')}</h2>
              <p className="helper-copy">{t('settings.routing.testDescription')}</p>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('settings.routing.testTitle')}</span>
              <textarea className="field-textarea" placeholder={t('settings.routing.testPlaceholder')} value={testContent} onChange={event => setTestContent(event.target.value)} />
            </label>
            <div className="inline-actions">
              <Button type="button" onClick={() => void testRouting()}>{t('common.test')}</Button>
            </div>
            {testResult ? <StatusPill tone="info">{testResult}</StatusPill> : null}
          </section>
        </div>
      ) : null}
      {activeTab === 'citizen' ? (
        <form className="section-card page-stack" onSubmit={event => void submitCitizenForm(event)}>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('settings.citizen.sectionTitle')}</h2>
            <p className="helper-copy">{t('settings.citizen.sectionDescription')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('settings.citizen.channel')}</span>
              <select
                className="field-select"
                required
                value={citizenForm.channel}
                onChange={event => setCitizenForm(current => ({ ...current, channel: event.target.value }))}
              >
                {(['Facebook', 'Instagram', 'X', 'Email', 'WebForm', 'WhatsApp', 'Other'] as const).map(ch => (
                  <option key={ch} value={ch}>{t(`settings.citizen.channels.${ch}`)}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              <span>{t('settings.citizen.citizenHandle')}</span>
              <input
                className="field-input"
                placeholder={t('settings.citizen.citizenHandlePlaceholder')}
                required
                value={citizenForm.citizenHandle}
                onChange={event => setCitizenForm(current => ({ ...current, citizenHandle: event.target.value }))}
              />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>{t('settings.citizen.content')}</span>
            <textarea
              className="field-textarea"
              placeholder={t('settings.citizen.contentPlaceholder')}
              required
              rows={4}
              value={citizenForm.content}
              onChange={event => setCitizenForm(current => ({ ...current, content: event.target.value }))}
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            <span>{t('settings.citizen.category')}</span>
            <input
              className="field-input"
              placeholder={t('settings.citizen.categoryPlaceholder')}
              value={citizenForm.category}
              onChange={event => setCitizenForm(current => ({ ...current, category: event.target.value }))}
            />
          </label>

          <div className="inline-actions">
            <Button disabled={citizenFormSaving} type="submit">
              {t('settings.citizen.submit')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
