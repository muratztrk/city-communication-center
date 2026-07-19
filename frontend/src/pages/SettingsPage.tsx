import type { FormEvent } from 'react'
import { Paintbrush, Settings2, ShieldCheck, UsersRound, Clock, Save, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { invalidateSettings } from '../api/cacheInvalidation'
import { API_ORIGIN } from '../api/config'
import { IZMIR_DISTRICTS, getSavedDistrictId, saveDistrictId } from '../data/izmir-locations'
import { MunicipalitySeal } from '../components/branding/MunicipalitySeal'
import { Button } from '../components/ui/button'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { Toast } from '../components/ui/toast'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import type { ConfirmDialogState } from '../components/ui/confirm-dialog'
import { StatusPill } from '../components/ui/status-pill'
import { TablePagination } from '../components/ui/table-pagination'
import { useAuth } from '../context/AuthContext'
import { useTenantTheme } from '../context/ThemeContext'
import { DEFAULT_TENANT_APPEARANCE, resolveTenantAppearance } from '../lib/theme'
import {
  DEFAULT_ROLE_PAGE_ACCESS,
  PAGE_ACCESS_ITEMS,
  ROLE_CODES,
  loadRolePageAccessMatrix,
  parseRolePageAccessMatrix,
  saveRolePageAccessMatrix,
  serializeRolePageAccessMatrix,
  type PageAccessKey,
  type RoleCode,
  type RolePageAccessMatrix,
} from '../lib/rolePageAccess'
import type {
  Department,
  RoutingConfig,
  CitizenAutoReplyTemplates,
  SocialSettingsStatus,
  TenantAppearanceInput,
  TenantAuthenticationPolicy,
  TenantLdapSettings,
  TenantSettings,
  WhatsAppMessageTemplate,
  WorkingHoursSettings,
  SmsSettings,
  SmsSettingsUpdate,
  FileStorageSettingsUpdate,
  SyslogSettingsUpdate,
  SlaWeekendSettingsUpdate,
} from '../types/platform'
import { getDeploymentModeLabel, getRoleLabel } from '../utils/localization'

type SettingsTab = 'tenant' | 'appearance' | 'roles' | 'social' | 'routing' | 'templates'
type ChannelType = 'x' | 'facebook' | 'instagram' | 'whatsapp' | 'edevlet' | 'email'
type ChannelForms = Record<ChannelType, Record<string, string>>
type TenantLdapFormState = TenantLdapSettings & { bindPassword: string; clearBindPassword: boolean }

const DEFAULT_CITIZEN_AUTO_REPLY_TEMPLATES: CitizenAutoReplyTemplates = {
  processingReceived: "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu İşleme Alındı. {GönderilenBirim}",
  inProgress: "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu Yapılmakta. {GönderilenBirim}",
  completed: "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu Tamamlandı. {GönderilenBirim}",
  cancelled: "{VatandaşTalepNo} no'lu {VatandaşTalepBaşlığı} talebinizin durumu İptal Edildi. {GönderilenBirim}",
}

const CITIZEN_REQUEST_NO_TOKEN = '{VatandaşTalepNo}'
const CITIZEN_REQUEST_TITLE_TOKEN = '{VatandaşTalepBaşlığı}'
const CITIZEN_REQUEST_STATUS_TOKEN = '{VatandaşTalepDurumu}'
const TARGET_DEPARTMENT_TOKEN = '{GönderilenBirim}'
const DEFAULT_AUTO_REPLY_BODY_TEXT = 'talebinizin durumu'

type CitizenAutoReplyTemplateKey = keyof CitizenAutoReplyTemplates

function buildCitizenAutoReplyTemplate(bodyText: string, statusLabel: string, suffixText = '', normalize = false) {
  const normalizedBody = normalize ? (bodyText.trim() || DEFAULT_AUTO_REPLY_BODY_TEXT) : bodyText
  // {GönderilenBirim} sonrası otomatik ayraç yok: kullanıcı "'ne iletilmiştir." gibi bitişik metin
  // yazabilmeli; baştaki bilinçli boşluk da korunur, yalnız sondaki boşluk temizlenir (card #1598 2. reopen).
  const normalizedSuffix = normalize ? suffixText.trimEnd() : suffixText
  return `${CITIZEN_REQUEST_NO_TOKEN} no'lu ${CITIZEN_REQUEST_TITLE_TOKEN} ${normalizedBody} ${statusLabel}. ${TARGET_DEPARTMENT_TOKEN}${normalizedSuffix}`
}

function removeTemplateSeparatorSpaces(value: string) {
  const withoutLeadingSeparator = value.startsWith(' ') ? value.slice(1) : value
  return withoutLeadingSeparator.endsWith(' ')
    ? withoutLeadingSeparator.slice(0, -1)
    : withoutLeadingSeparator
}

function extractCitizenAutoReplyBodyText(template: string, statusLabel: string) {
  const titleIndex = template.indexOf(CITIZEN_REQUEST_TITLE_TOKEN)
  const afterTitle = titleIndex >= 0
    ? template.slice(titleIndex + CITIZEN_REQUEST_TITLE_TOKEN.length)
    : template
  const fixedStatusIndex = afterTitle.indexOf(statusLabel)
  const tokenStatusIndex = afterTitle.indexOf(CITIZEN_REQUEST_STATUS_TOKEN)
  const statusIndex = fixedStatusIndex >= 0 ? fixedStatusIndex : tokenStatusIndex
  const editableBody = statusIndex >= 0 ? afterTitle.slice(0, statusIndex) : afterTitle
  return removeTemplateSeparatorSpaces(editableBody
    .replace(CITIZEN_REQUEST_STATUS_TOKEN, '')
    .replace(TARGET_DEPARTMENT_TOKEN, ''))
}

function extractCitizenAutoReplySuffixText(template: string) {
  // Token sonrası metin olduğu gibi gösterilir; eski kayıtlardaki zorunlu ayraç boşluğu da
  // görünür/düzenlenebilir olur — gizli otomatik boşluk kalmaz (card #1598 2. reopen).
  const tokenIndex = template.indexOf(TARGET_DEPARTMENT_TOKEN)
  return tokenIndex >= 0
    ? template.slice(tokenIndex + TARGET_DEPARTMENT_TOKEN.length)
    : ''
}

interface CitizenAutoReplyTemplateFieldProps {
  label: string
  statusLabel: string
  templateStatusLabel?: string
  tone?: 'success' | 'warning' | 'danger'
  value: string
  onChange: (value: string) => void
}

function CitizenAutoReplyTemplateField({ label, statusLabel, templateStatusLabel = statusLabel, tone = 'success', value, onChange }: CitizenAutoReplyTemplateFieldProps) {
  const statusToneClass = tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-700'
    : tone === 'warning'
      ? 'border-orange-200 bg-orange-50 text-orange-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700">
      <span className="text-slate-800">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
        <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 font-bold text-slate-500">{CITIZEN_REQUEST_NO_TOKEN}</span>
        <span>no'lu</span>
        <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 font-bold text-slate-500">{CITIZEN_REQUEST_TITLE_TOKEN}</span>
      </div>
      <textarea
        className="field-textarea min-h-[4.5rem]"
        value={extractCitizenAutoReplyBodyText(value, templateStatusLabel)}
        onChange={event => onChange(buildCitizenAutoReplyTemplate(
          event.target.value,
          templateStatusLabel,
          extractCitizenAutoReplySuffixText(value),
        ))}
      />
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
        <span className={`rounded-md border px-2 py-1 font-bold ${statusToneClass}`}>{statusLabel}</span>
        <span>.</span>
        <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 font-bold text-sky-700">{TARGET_DEPARTMENT_TOKEN}</span>
      </div>
      <textarea
        className="field-textarea min-h-[4.5rem]"
        value={extractCitizenAutoReplySuffixText(value)}
        onChange={event => onChange(buildCitizenAutoReplyTemplate(
          extractCitizenAutoReplyBodyText(value, templateStatusLabel),
          templateStatusLabel,
          event.target.value,
        ))}
        placeholder="Gönderilen birim bilgisinden sonra gelecek metin"
      />
    </div>
  )
}

interface ChannelConfig {
  id: ChannelType
  titleKey: string
  descriptionKey: string
  statusKey: keyof Omit<SocialSettingsStatus, 'whatsAppPublic'>
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
      { key: 'appSecret', labelKey: 'settings.socialConfig.fields.whatsapp.appSecret', secret: true },
      { key: 'webhookVerifyToken', labelKey: 'settings.socialConfig.fields.whatsapp.webhookVerifyToken' },
    ],
  },
  {
    id: 'edevlet',
    titleKey: 'settings.socialConfig.edevlet',
    descriptionKey: 'settings.socialConfig.descriptions.edevlet',
    statusKey: 'eDevlet',
    fields: [
      { key: 'clientId', labelKey: 'settings.socialConfig.fields.edevlet.clientId' },
      { key: 'clientSecret', labelKey: 'settings.socialConfig.fields.edevlet.clientSecret', secret: true },
      { key: 'redirectUri', labelKey: 'settings.socialConfig.fields.edevlet.redirectUri' },
      { key: 'authorizationEndpoint', labelKey: 'settings.socialConfig.fields.edevlet.authorizationEndpoint' },
      { key: 'tokenEndpoint', labelKey: 'settings.socialConfig.fields.edevlet.tokenEndpoint' },
      { key: 'scope', labelKey: 'settings.socialConfig.fields.edevlet.scope' },
      { key: 'belediyeKodu', labelKey: 'settings.socialConfig.fields.edevlet.belediyeKodu' },
      { key: 'soapKullaniciAdi', labelKey: 'settings.socialConfig.fields.edevlet.soapKullaniciAdi' },
      { key: 'soapSifre', labelKey: 'settings.socialConfig.fields.edevlet.soapSifre', secret: true },
      { key: 'ilceAdi', labelKey: 'settings.socialConfig.fields.edevlet.ilceAdi' },
      { key: 'bilgilendirmeMetni', labelKey: 'settings.socialConfig.fields.edevlet.bilgilendirmeMetni' },
    ],
  },
  {
    id: 'email',
    titleKey: 'settings.socialConfig.email',
    descriptionKey: 'settings.socialConfig.descriptions.email',
    statusKey: 'email',
    fields: [
      { key: 'imapHost', labelKey: 'settings.socialConfig.fields.email.imapHost' },
      { key: 'imapPort', labelKey: 'settings.socialConfig.fields.email.imapPort' },
      { key: 'imapUser', labelKey: 'settings.socialConfig.fields.email.imapUser' },
      { key: 'imapPassword', labelKey: 'settings.socialConfig.fields.email.imapPassword', secret: true },
      { key: 'folder', labelKey: 'settings.socialConfig.fields.email.folder' },
      { key: 'smtpHost', labelKey: 'settings.socialConfig.fields.email.smtpHost' },
      { key: 'smtpPort', labelKey: 'settings.socialConfig.fields.email.smtpPort' },
      { key: 'smtpUser', labelKey: 'settings.socialConfig.fields.email.smtpUser' },
      { key: 'smtpPassword', labelKey: 'settings.socialConfig.fields.email.smtpPassword', secret: true },
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
  rolePageAccessJson: null,
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

const EMPTY_SOCIAL_FORMS: ChannelForms = {
  x: { apiKey: '', apiSecret: '', accessToken: '', accessTokenSecret: '', bearerToken: '' },
  facebook: { appId: '', appSecret: '', pageAccessToken: '', pageId: '', webhookVerifyToken: '' },
  instagram: { accountId: '', accessToken: '', linkedPageId: '' },
  whatsapp: { businessAccountId: '', phoneNumberId: '', accessToken: '', appSecret: '', webhookVerifyToken: '' },
  edevlet: { clientId: '', clientSecret: '', redirectUri: '', authorizationEndpoint: '', tokenEndpoint: '', scope: '', belediyeKodu: '', soapKullaniciAdi: '', soapSifre: '', ilceAdi: '', bilgilendirmeMetni: '' },
  email: { imapHost: '', imapPort: '', imapUser: '', imapPassword: '', folder: '', smtpHost: '', smtpPort: '', smtpUser: '', smtpPassword: '' },
}

const TEMPLATE_CHANNEL_OPTIONS = ['Genel', 'WhatsApp', 'Facebook', 'Instagram', 'X', 'Phone', 'Other']
const WHATSAPP_META_TEMPLATE_CHANNEL = 'WhatsApp Meta'
const TEMPLATE_REPLY_DELAY_OPTIONS = [10, 30, 60, 120, 300]
const TEMPLATE_WEEKDAY_OPTIONS = [
  { id: 'monday', label: 'Pazartesi', group: 'weekday' as const },
  { id: 'tuesday', label: 'Salı', group: 'weekday' as const },
  { id: 'wednesday', label: 'Çarşamba', group: 'weekday' as const },
  { id: 'thursday', label: 'Perşembe', group: 'weekday' as const },
  { id: 'friday', label: 'Cuma', group: 'weekday' as const },
  { id: 'saturday', label: 'Cumartesi', group: 'weekend' as const },
  { id: 'sunday', label: 'Pazar', group: 'weekend' as const },
]
const ALL_TEMPLATE_WEEKDAYS = TEMPLATE_WEEKDAY_OPTIONS.map(day => day.id)
const TEMPLATE_WEEKEND_DAY_IDS = TEMPLATE_WEEKDAY_OPTIONS.filter(day => day.group === 'weekend').map(day => day.id)

function toTemplateDatePickerValue(value: string | null | undefined): string {
  if (!value?.trim()) return ''
  return value.includes('T') ? value : `${value}T00:00`
}

function fromTemplateDatePickerValue(value: string): string {
  if (!value.trim()) return ''
  return value.split('T')[0] ?? ''
}

const EMPTY_TEMPLATE_FORM: Omit<WhatsAppMessageTemplate, 'templateId'> = {
  name: '', content: '', isActive: true, channel: 'Genel',
  isGeneral: false, autoReply: false, replyDelaySecs: 30,
  hasKeyword: false, queryType: '(LIKE) İçerikte Geçsin', keywords: [],
  timedReplyEnabled: false, timedReplyStartDate: '', timedReplyEndDate: '',
  timedReplyStartTime: '17:30', timedReplyEndTime: '08:30',
  timedReplyWeekendAllHours: false,
  activeDays: [...ALL_TEMPLATE_WEEKDAYS],
}

function readTab(tab: string | null): SettingsTab {
  return tab === 'appearance' || tab === 'roles' || tab === 'social' || tab === 'routing' || tab === 'templates' ? tab : 'tenant'
}

const SETTINGS_TAB_LABEL_KEYS: Record<SettingsTab, string> = {
  tenant: 'settings.tabs.organization',
  appearance: 'settings.tabs.appearance',
  roles: 'settings.tabs.roles',
  social: 'settings.tabs.social',
  routing: 'settings.tabs.routing',
  templates: 'settings.tabs.templates',
}

function isMetaWhatsAppTemplate(template: Pick<WhatsAppMessageTemplate, 'channel'>) {
  return template.channel === WHATSAPP_META_TEMPLATE_CHANNEL
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean)
}

export function SettingsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { setAppearance } = useTenantTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = readTab(searchParams.get('tab'))
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>(EMPTY_TENANT_SETTINGS)
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(getSavedDistrictId)
  const [tenantLdapSettings, setTenantLdapSettings] = useState<TenantLdapFormState>(EMPTY_TENANT_LDAP_SETTINGS)
  const [tenantAuthenticationPolicy, setTenantAuthenticationPolicy] = useState<TenantAuthenticationPolicy>(EMPTY_TENANT_AUTH_POLICY)
  const [socialStatus, setSocialStatus] = useState<SocialSettingsStatus | null>(null)
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig | null>(null)
  const [citizenAutoReplyTemplates, setCitizenAutoReplyTemplates] = useState<CitizenAutoReplyTemplates>(DEFAULT_CITIZEN_AUTO_REPLY_TEMPLATES)
  const [citizenAutoReplySaving, setCitizenAutoReplySaving] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setToast({ type, text })
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ldapTestStatus, setLdapTestStatus] = useState<{ type: 'idle' | 'testing' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })
  const [ldapUserTest, setLdapUserTest] = useState({ username: '', password: '' })
  const [ldapUserTestStatus, setLdapUserTestStatus] = useState<{ type: 'idle' | 'testing' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })
  const [rolePageAccess, setRolePageAccess] = useState<RolePageAccessMatrix>(() => loadRolePageAccessMatrix())
  const [rolesPageSize, setRolesPageSize] = useState(25)
  const [rolesPage, setRolesPage] = useState(1)
  const rolesTotalPages = Math.max(1, Math.ceil(PAGE_ACCESS_ITEMS.length / rolesPageSize) || 1)
  const rolesSafePage = Math.min(rolesPage, rolesTotalPages)
  const pagedPageAccessItems = useMemo(() => {
    const start = (rolesSafePage - 1) * rolesPageSize
    return PAGE_ACCESS_ITEMS.slice(start, start + rolesPageSize)
  }, [rolesSafePage, rolesPageSize])
  const [workingHoursForm, setWorkingHoursForm] = useState<WorkingHoursSettings | null>(null)
  const [smsSettings, setSmsSettings] = useState<SmsSettings | null>(null)
  const [smsForm, setSmsForm] = useState<SmsSettingsUpdate>({
    isEnabled: false, provider: 'NetGSM', apiUrl: null,
    username: null, password: null, clearPassword: false, originator: null,
  })
  const [syslogForm, setSyslogForm] = useState<SyslogSettingsUpdate>({
    isEnabled: false, host: null, port: 514, format: 'Syslog', transport: 'UDP',
  })
  const [fileStorageForm, setFileStorageForm] = useState<FileStorageSettingsUpdate>({
    nasHost: null,
    nasShareName: null,
    nasProtocol: 'SMB/CIFS',
    nasUsername: null,
    nasPassword: null,
    clearNasPassword: false,
    ftpHost: null,
    ftpPort: 21,
    ftpPath: null,
    ftpProtocol: 'FTP',
    ftpUsername: null,
    ftpPassword: null,
    clearFtpPassword: false,
  })
  const [slaWeekendForm, setSlaWeekendForm] = useState<SlaWeekendSettingsUpdate>({
    excludeWeekends: false, exemptDepartmentIds: [],
  })
  const [templates, setTemplates] = useState<WhatsAppMessageTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templateForm, setTemplateForm] = useState<Omit<WhatsAppMessageTemplate, 'templateId'>>(EMPTY_TEMPLATE_FORM)
  const [isNewTemplate, setIsNewTemplate] = useState(false)
  const [templateEditorMode, setTemplateEditorMode] = useState<'classic' | 'meta'>('classic')
  const [keywordInput, setKeywordInput] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [syncingMetaTemplates, setSyncingMetaTemplates] = useState(false)

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
      api.getCitizenAutoReplyTemplates(user.tenantId),
      api.getDepartments(),
      api.getWorkingHours(user.tenantId),
      api.getSmsSettings(user.tenantId),
      api.getFileStorageSettings(user.tenantId),
      api.getSyslogSettings(user.tenantId),
      api.getSlaWeekendSettings(user.tenantId),
      api.getWhatsAppTemplates(),
    ])
      .then(([tenantResponse, ldapResponse, authPolicyResponse, appearanceResponse, socialResponse, routingResponse, autoReplyResponse, departmentResponse, workingHoursResponse, smsResponse, fileStorageResponse, syslogResponse, slaWeekendResponse, templatesResponse]) => {
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
        const nextRolePageAccess = parseRolePageAccessMatrix(tenantResponse.rolePageAccessJson) ?? loadRolePageAccessMatrix()
        setRolePageAccess(nextRolePageAccess)
        saveRolePageAccessMatrix(nextRolePageAccess)
        setTenantLdapSettings({
          ...ldapResponse,
          bindPassword: '',
          clearBindPassword: false,
        })
        setTenantAuthenticationPolicy(authPolicyResponse)
        setAppearanceForm(nextAppearance)
        setLoadedAppearance(nextAppearance)
        setSocialStatus(socialResponse)
        if (socialResponse.whatsAppPublic) {
          setSocialForms(current => ({
            ...current,
            whatsapp: {
              ...current.whatsapp,
              businessAccountId: socialResponse.whatsAppPublic?.businessAccountId ?? '',
              phoneNumberId: socialResponse.whatsAppPublic?.phoneNumberId ?? '',
              webhookVerifyToken: socialResponse.whatsAppPublic?.webhookVerifyToken ?? '',
              accessToken: '',
              appSecret: '',
            },
          }))
        }
        setRoutingConfig(routingResponse)
        setCitizenAutoReplyTemplates({ ...DEFAULT_CITIZEN_AUTO_REPLY_TEMPLATES, ...autoReplyResponse })
        setDepartments(departmentResponse)
        setWorkingHoursForm(workingHoursResponse)
        setSmsSettings(smsResponse)
        setSmsForm({
          isEnabled: smsResponse.isEnabled,
          provider: smsResponse.provider,
          apiUrl: smsResponse.apiUrl,
          username: smsResponse.username,
          password: null,
          clearPassword: false,
          originator: smsResponse.originator,
        })
        setFileStorageForm({
          nasHost: fileStorageResponse.nasHost,
          nasShareName: fileStorageResponse.nasShareName,
          nasProtocol: fileStorageResponse.nasProtocol,
          nasUsername: fileStorageResponse.nasUsername,
          nasPassword: null,
          clearNasPassword: false,
          ftpHost: fileStorageResponse.ftpHost,
          ftpPort: fileStorageResponse.ftpPort,
          ftpPath: fileStorageResponse.ftpPath,
          ftpProtocol: fileStorageResponse.ftpProtocol,
          ftpUsername: fileStorageResponse.ftpUsername,
          ftpPassword: null,
          clearFtpPassword: false,
        })
        setSyslogForm({
          isEnabled: syslogResponse.isEnabled,
          host: syslogResponse.host,
          port: syslogResponse.port,
          format: syslogResponse.format,
          transport: syslogResponse.transport,
        })
        setSlaWeekendForm({
          excludeWeekends: slaWeekendResponse.excludeWeekends,
          exemptDepartmentIds: slaWeekendResponse.exemptDepartmentIds,
        })
        setTemplates(templatesResponse)
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
  const whatsAppWebhookUrl = user?.tenantId
    ? `${API_ORIGIN}/api/v1/social/webhooks/whatsapp/${user.tenantId}`
    : ''

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

  const saveRolePages = async () => {
    if (!user?.tenantId) {
      return
    }

    setMessage(null)
    try {
      const matrixJson = serializeRolePageAccessMatrix(rolePageAccess)
      const normalizedMatrix = parseRolePageAccessMatrix(matrixJson) ?? rolePageAccess
      await api.updateRolePageAccess(user.tenantId, matrixJson)
      invalidateSettings(queryClient)
      saveRolePageAccessMatrix(normalizedMatrix)
      setRolePageAccess(normalizedMatrix)
      setTenantSettings(current => ({ ...current, rolePageAccessJson: matrixJson }))
      setMessage({ type: 'success', text: t('settings.roles.saveSuccess') })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const resetRolePages = async () => {
    if (!user?.tenantId) {
      return
    }

    setMessage(null)
    try {
      const matrixJson = serializeRolePageAccessMatrix(DEFAULT_ROLE_PAGE_ACCESS)
      await api.updateRolePageAccess(user.tenantId, matrixJson)
      invalidateSettings(queryClient)
      setRolePageAccess(DEFAULT_ROLE_PAGE_ACCESS)
      saveRolePageAccessMatrix(DEFAULT_ROLE_PAGE_ACCESS)
      setTenantSettings(current => ({ ...current, rolePageAccessJson: matrixJson }))
      setMessage({ type: 'success', text: t('settings.roles.resetSuccess') })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const refreshSocial = async () => {
    const status = await api.getSocialSettingsStatus()
    setSocialStatus(status)
    if (status.whatsAppPublic) {
      setSocialForms(current => ({
        ...current,
        whatsapp: {
          ...current.whatsapp,
          businessAccountId: status.whatsAppPublic?.businessAccountId ?? '',
          phoneNumberId: status.whatsAppPublic?.phoneNumberId ?? '',
          webhookVerifyToken: status.whatsAppPublic?.webhookVerifyToken ?? '',
          // Gizli alanlar API'den dönmez; boş bırakılırsa kayıtta mevcut değer korunur.
          accessToken: '',
          appSecret: '',
        },
      }))
    }
  }

  const saveMunicipalityDistrict = (event: FormEvent) => {
    event.preventDefault()
    saveDistrictId(selectedDistrictId)
    showToast('success', t('settings.municipalityLocation.saveSuccess', 'Konum ayarı kaydedildi.'))
  }

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
      invalidateSettings(queryClient)
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
      invalidateSettings(queryClient)
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
      invalidateSettings(queryClient)

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

  const saveWorkingHours = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.tenantId || !workingHoursForm) {
      return
    }

    setMessage(null)
    try {
      await api.updateWorkingHours(user.tenantId, workingHoursForm)
      invalidateSettings(queryClient)
      showToast('success', t('settings.workingHours.saved'))
    } catch (saveError) {
      showToast('error', saveError instanceof Error ? saveError.message : t('common.error'))
    }
  }

  const saveSmsSettings = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.tenantId) {
      return
    }

    setMessage(null)
    try {
      await api.updateSmsSettings(user.tenantId, smsForm)
      invalidateSettings(queryClient)
      const refreshed = await api.getSmsSettings(user.tenantId)
      setSmsSettings(refreshed)
      setSmsForm(current => ({ ...current, password: null, clearPassword: false }))
      setMessage({ type: 'success', text: t('settings.sms.saved') })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const saveSyslogSettings = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.tenantId) return

    setMessage(null)
    try {
      await api.updateSyslogSettings(user.tenantId, syslogForm)
      invalidateSettings(queryClient)
      const refreshed = await api.getSyslogSettings(user.tenantId)
      setSyslogForm({ isEnabled: refreshed.isEnabled, host: refreshed.host, port: refreshed.port, format: refreshed.format, transport: refreshed.transport })
      setMessage({ type: 'success', text: t('settings.syslog.saved') })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const saveFileStorageSettings = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.tenantId) return

    setMessage(null)
    try {
      await api.updateFileStorageSettings(user.tenantId, fileStorageForm)
      invalidateSettings(queryClient)
      setFileStorageForm(current => ({
        ...current,
        nasPassword: null,
        clearNasPassword: false,
        ftpPassword: null,
        clearFtpPassword: false,
      }))
      setMessage({ type: 'success', text: t('settings.fileStorage.saved') })
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : t('common.error') })
    }
  }

  const saveSlaWeekendSettings = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.tenantId) return

    setMessage(null)
    try {
      await api.updateSlaWeekendSettings(user.tenantId, slaWeekendForm)
      invalidateSettings(queryClient)
      const refreshed = await api.getSlaWeekendSettings(user.tenantId)
      setSlaWeekendForm({ excludeWeekends: refreshed.excludeWeekends, exemptDepartmentIds: refreshed.exemptDepartmentIds })
      setMessage({ type: 'success', text: t('settings.slaWeekend.saved') })
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
      invalidateSettings(queryClient)

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
      invalidateSettings(queryClient)
      setRoutingConfig(current => current ? { ...current, autoRoutingEnabled: nextValue } : current)
      setMessage({ type: 'success', text: nextValue ? t('settings.routing.toggleOn') : t('settings.routing.toggleOff') })
    } catch (toggleError) {
      setMessage({ type: 'error', text: toggleError instanceof Error ? toggleError.message : t('common.error') })
    }
  }

  const saveCitizenAutoReplies = async () => {
    if (!user?.tenantId) return
    setCitizenAutoReplySaving(true)
    try {
      const normalizedTemplates: CitizenAutoReplyTemplates = {
        processingReceived: buildCitizenAutoReplyTemplate(
          extractCitizenAutoReplyBodyText(citizenAutoReplyTemplates.processingReceived, t('social.requestStatus.processingReceived', 'İşleme Alındı')),
          t('social.requestStatus.processingReceived', 'İşleme Alındı'),
          extractCitizenAutoReplySuffixText(citizenAutoReplyTemplates.processingReceived),
          true,
        ),
        inProgress: buildCitizenAutoReplyTemplate(
          extractCitizenAutoReplyBodyText(citizenAutoReplyTemplates.inProgress, t('social.requestStatus.inProgress', 'Yapılmakta')),
          t('social.requestStatus.inProgress', 'Yapılmakta'),
          extractCitizenAutoReplySuffixText(citizenAutoReplyTemplates.inProgress),
          true,
        ),
        completed: buildCitizenAutoReplyTemplate(
          extractCitizenAutoReplyBodyText(citizenAutoReplyTemplates.completed, t('social.requestStatus.completed', 'Tamamlandı')),
          t('social.requestStatus.completed', 'Tamamlandı'),
          extractCitizenAutoReplySuffixText(citizenAutoReplyTemplates.completed),
          true,
        ),
        cancelled: buildCitizenAutoReplyTemplate(
          extractCitizenAutoReplyBodyText(citizenAutoReplyTemplates.cancelled, t('social.requestStatus.cancelledMessage', 'İptal Edildi')),
          t('social.requestStatus.cancelledMessage', 'İptal Edildi'),
          extractCitizenAutoReplySuffixText(citizenAutoReplyTemplates.cancelled),
          true,
        ),
      }
      await api.updateCitizenAutoReplyTemplates(user.tenantId, normalizedTemplates)
      setCitizenAutoReplyTemplates(normalizedTemplates)
      showToast('success', t('settings.routing.autoRepliesSaved', 'Vatandaşa giden cevaplar kaydedildi.'))
    } catch (saveError) {
      showToast('error', saveError instanceof Error ? saveError.message : t('common.error'))
    } finally {
      setCitizenAutoReplySaving(false)
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
      invalidateSettings(queryClient)
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
      invalidateSettings(queryClient)
      await refreshSocial()
      setMessage({ type: 'success', text: t('settings.socialConfig.deleted') })
    } catch (deleteError) {
      setMessage({ type: 'error', text: deleteError instanceof Error ? deleteError.message : t('common.error') })
    }
  }

  const selectTemplate = (tpl: WhatsAppMessageTemplate) => {
    setSelectedTemplateId(tpl.templateId)
    const { templateId: _id, ...rest } = tpl
    void _id
    setTemplateForm({
      ...EMPTY_TEMPLATE_FORM,
      ...rest,
      timedReplyStartDate: rest.timedReplyStartDate || '',
      timedReplyEndDate: rest.timedReplyEndDate || '',
      timedReplyStartTime: rest.timedReplyStartTime || '17:30',
      timedReplyEndTime: rest.timedReplyEndTime || '08:30',
      timedReplyWeekendAllHours: rest.timedReplyWeekendAllHours ?? false,
      activeDays: rest.activeDays?.length ? rest.activeDays : [...ALL_TEMPLATE_WEEKDAYS],
    })
    setKeywordInput('')
    setIsNewTemplate(false)
    setTemplateEditorMode(isMetaWhatsAppTemplate(tpl) ? 'meta' : 'classic')
  }

  const startNewTemplate = () => {
    setSelectedTemplateId(null)
    setTemplateForm(EMPTY_TEMPLATE_FORM)
    setKeywordInput('')
    setIsNewTemplate(true)
    setTemplateEditorMode('classic')
  }

  const syncMetaTemplates = async () => {
    if (syncingMetaTemplates) return
    setSyncingMetaTemplates(true)
    try {
      const result = await api.syncWhatsAppTemplatesFromMeta()
      const updated = await api.getWhatsAppTemplates()
      setTemplates(updated)
      setMessage({
        type: 'success',
        text: `Meta senkronu tamamlandı: ${result.imported} yeni, ${result.updated} güncellendi, ${result.deactivated} pasifleştirildi.`,
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Meta şablonları senkronize edilemedi.',
      })
    } finally {
      setSyncingMetaTemplates(false)
    }
  }

  const addKeyword = () => {
    const kw = keywordInput.trim()
    if (!kw || templateForm.keywords.includes(kw)) return
    setTemplateForm(cur => ({ ...cur, keywords: [...cur.keywords, kw] }))
    setKeywordInput('')
  }

  const removeKeyword = (kw: string) => {
    setTemplateForm(cur => ({ ...cur, keywords: cur.keywords.filter(k => k !== kw) }))
  }

  const toggleTemplateDay = (dayId: string) => {
    setTemplateForm(current => {
      const isSelected = current.activeDays.includes(dayId)
      const nextActiveDays = isSelected
        ? current.activeDays.filter(day => day !== dayId)
        : [...current.activeDays, dayId]
      const weekendTurnedOff = isSelected && TEMPLATE_WEEKEND_DAY_IDS.includes(dayId)
      return {
        ...current,
        activeDays: nextActiveDays,
        timedReplyWeekendAllHours: weekendTurnedOff ? false : current.timedReplyWeekendAllHours,
      }
    })
  }

  const toggleWeekendAllHours = () => {
    setTemplateForm(current => ({
      ...current,
      timedReplyWeekendAllHours: !current.timedReplyWeekendAllHours,
    }))
  }

  const persistTemplate = async (successMessage = 'Şablon kaydedildi.') => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) return false
    const editingMeta = templateEditorMode === 'meta'
    const data = editingMeta
      ? {
          ...templateForm,
          name: templateForm.name.trim(),
          content: templateForm.content.trim(),
          channel: WHATSAPP_META_TEMPLATE_CHANNEL,
          autoReply: false,
          hasKeyword: false,
          keywords: [],
          timedReplyEnabled: false,
          activeDays: templateForm.activeDays.length > 0 ? templateForm.activeDays : [...ALL_TEMPLATE_WEEKDAYS],
        }
      : {
          ...templateForm,
          name: templateForm.name.trim(),
          content: templateForm.content.trim(),
          activeDays: templateForm.activeDays.length > 0 ? templateForm.activeDays : [...ALL_TEMPLATE_WEEKDAYS],
        }
    if (isNewTemplate) {
      await api.createWhatsAppTemplate(data)
    } else if (selectedTemplateId) {
      await api.updateWhatsAppTemplate(selectedTemplateId, data)
    } else {
      return false
    }
    invalidateSettings(queryClient)
    const updated = await api.getWhatsAppTemplates()
    setTemplates(updated)
    setMessage({ type: 'success', text: successMessage })
    if (isNewTemplate) {
      setIsNewTemplate(false)
      setSelectedTemplateId(updated.find(t => t.name === data.name)?.templateId ?? null)
    }
    return true
  }

  const saveTemplate = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    try {
      await persistTemplate()
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : 'Şablon kaydedilemedi.' })
    }
  }

  const saveTemplateSchedule = async () => {
    setMessage(null)
    try {
      await persistTemplate('Zamanlı yanıt saati kaydedildi.')
    } catch (saveError) {
      setMessage({ type: 'error', text: saveError instanceof Error ? saveError.message : 'Zamanlı yanıt saati kaydedilemedi.' })
    }
  }

  const deleteTemplate = (id: string) => {
    setConfirmDialog({
      message: 'Bu şablonu silmek istediğinizden emin misiniz?',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await api.deleteWhatsAppTemplate(id)
          invalidateSettings(queryClient)
          const updated = await api.getWhatsAppTemplates()
          setTemplates(updated)
          if (selectedTemplateId === id) {
            setSelectedTemplateId(null)
            setTemplateForm(EMPTY_TEMPLATE_FORM)
            setIsNewTemplate(false)
            setTemplateEditorMode('classic')
          }
          setMessage({ type: 'success', text: 'Şablon silindi.' })
        } catch (deleteError) {
          setMessage({ type: 'error', text: deleteError instanceof Error ? deleteError.message : 'Şablon silinemedi.' })
        }
      },
    })
  }

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  if (error) {
    return <div className="error">{t('common.error')}: {error}</div>
  }

  return (
    <div className="page-stack desktop-page-shell shrink-0">
      <section className="section-card p-0">
        <div
          className="grid gap-3 border-b border-white/10 px-4 py-3.5 text-white sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] rounded-t-[var(--radius-xl)] lg:rounded-t-[0.85rem]"
          style={{ background: 'linear-gradient(135deg, var(--color-header-from), var(--color-header-to))' }}
        >
          <div className="space-y-1">
            <div className="page-kicker !text-white/70">{t(SETTINGS_TAB_LABEL_KEYS[activeTab])}</div>
            <h1 className="page-title !text-white">{t('settings.title')}</h1>
            <p className="max-w-3xl text-sm leading-6 text-white/82">{t('settings.subtitle')}</p>
          </div>
          <StatusPill tone="success" className="bg-white/12 text-white ring-white/15 self-start">{institutionName}</StatusPill>
        </div>
        <div className="sticky top-0 z-[12]">
          <div className="tab-bar settings-tab-bar">
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
            <button className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')} type="button">
              {t('settings.tabs.templates')}
            </button>
          </div>
        </div>
      </section>

      {message ? (
        <div className={message.type === 'success' ? 'rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700' : 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700'}>
          {message.text}
        </div>
      ) : null}

      {activeTab === 'tenant' ? (
        <div className="page-stack">
          <div className="grid gap-4 xl:grid-cols-2 xl:items-stretch">
            <section className="section-card page-stack p-5 sm:p-6 lg:p-7">
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
                    <SingleSelectDropdown
                      options={['OnPrem', 'Hosted', 'DedicatedHosted'].map(mode => ({
                        value: mode,
                        label: getDeploymentModeLabel(t, mode),
                      }))}
                      value={tenantSettings.deploymentMode}
                      onChange={deploymentMode => setTenantSettings(current => ({ ...current, deploymentMode }))}
                      placeholder={t('settings.deploymentMode')}
                    />
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

            <div className="flex h-full flex-col gap-4">
              <form className="section-card page-stack p-5 sm:p-6 lg:p-7" onSubmit={saveMunicipalityDistrict}>
                <div className="page-header-row">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-950">{t('settings.municipalityLocation.sectionTitle', 'Kurum Konumu')}</h2>
                    <p className="helper-copy">{t('settings.municipalityLocation.sectionDescription', 'Talep oluşturma ekranında gösterilecek mahalle listesini belirlemek için ilçe seçin.')}</p>
                  </div>
                </div>
                <label className="grid gap-2 text-sm font-semibold text-slate-700 max-w-xs">
                  <span>{t('settings.municipalityLocation.districtLabel', 'İlçe (İzmir)')}</span>
                  <SingleSelectDropdown
                    options={IZMIR_DISTRICTS.map(district => ({
                      value: district.id,
                      label: district.name,
                    }))}
                    value={selectedDistrictId}
                    onChange={setSelectedDistrictId}
                    placeholder={t('settings.municipalityLocation.districtLabel', 'İlçe (İzmir)')}
                    searchable
                    searchPlaceholder={t('common.search', 'Ara...')}
                  />
                </label>
                <div className="inline-actions">
                  <Button type="submit">{t('common.save')}</Button>
                </div>
              </form>

              <form className="section-card page-stack flex-1 p-5 sm:p-6 lg:p-7" onSubmit={event => void saveSlaWeekendSettings(event)}>
                <div className="page-header-row">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-950">{t('settings.slaWeekend.sectionTitle')}</h2>
                    <p className="helper-copy">{t('settings.slaWeekend.sectionDescription')}</p>
                  </div>
                </div>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input
                    className="field-checkbox"
                    type="checkbox"
                    checked={slaWeekendForm.excludeWeekends}
                    onChange={event => setSlaWeekendForm(current => ({ ...current, excludeWeekends: event.target.checked }))}
                  />
                  {t('settings.slaWeekend.excludeWeekends')}
                </label>
                {slaWeekendForm.excludeWeekends && departments.length > 0 && (
                  <div className="field-row">
                    <label className="field-label">{t('settings.slaWeekend.exemptDepartments')}</label>
                    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                      {departments.map(dept => (
                        <label key={dept.departmentId} className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            className="field-checkbox"
                            type="checkbox"
                            checked={slaWeekendForm.exemptDepartmentIds.includes(dept.departmentId)}
                            onChange={event => {
                              setSlaWeekendForm(current => ({
                                ...current,
                                exemptDepartmentIds: event.target.checked
                                  ? [...current.exemptDepartmentIds, dept.departmentId]
                                  : current.exemptDepartmentIds.filter(id => id !== dept.departmentId),
                              }))
                            }}
                          />
                          {dept.name}
                        </label>
                      ))}
                    </div>
                    <p className="helper-copy">{t('settings.slaWeekend.exemptDepartmentsHelp')}</p>
                  </div>
                )}
                <div className="inline-actions">
                  <Button type="submit">{t('settings.slaWeekend.save')}</Button>
                </div>
              </form>
            </div>
          </div>

          <form className="section-card page-stack" onSubmit={event => void saveWorkingHours(event)}>
            <div className="page-header-row">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">{t('settings.workingHours.sectionTitle')}</h2>
                <p className="helper-copy">{t('settings.workingHours.sectionDescription')}</p>
              </div>
            </div>
            {workingHoursForm && (
              <>
                <div className="page-stack">
                  <h3 className="text-base font-bold text-slate-800">{t('settings.workingHours.defaultScheduleTitle')}</h3>
                  <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                    <input
                      className="field-checkbox"
                      type="checkbox"
                      checked={workingHoursForm.default.isAlwaysOpen}
                      onChange={event =>
                        setWorkingHoursForm(current => current ? { ...current, default: { ...current.default, isAlwaysOpen: event.target.checked } } : current)
                      }
                    />
                    {t('settings.workingHours.alwaysOpen')}
                  </label>
                  {workingHoursForm.default.isAlwaysOpen ? (
                    <p className="helper-copy">{t('settings.workingHours.alwaysOpenHelp')}</p>
                  ) : (
                    <div className="grid gap-2">
                      {workingHoursForm.default.schedule.map(daySchedule => (
                        <div key={daySchedule.day} className="grid grid-cols-[120px_1fr_1fr] gap-3 items-center">
                          <span className="text-sm font-semibold text-slate-700">{t(`settings.workingHours.days.${daySchedule.day}`)}</span>
                          {daySchedule.from !== null || daySchedule.to !== null ? (
                            <>
                              <label className="grid gap-1 text-xs font-semibold text-slate-500">
                                <span>{t('settings.workingHours.from')}</span>
                                <input
                                  className="field-input"
                                  type="time"
                                  value={daySchedule.from ?? ''}
                                  onChange={event => setWorkingHoursForm(current => current ? {
                                    ...current,
                                    default: {
                                      ...current.default,
                                      schedule: current.default.schedule.map(s => s.day === daySchedule.day ? { ...s, from: event.target.value || null } : s),
                                    },
                                  } : current)}
                                />
                              </label>
                              <label className="grid gap-1 text-xs font-semibold text-slate-500">
                                <span>{t('settings.workingHours.to')}</span>
                                <input
                                  className="field-input"
                                  type="time"
                                  value={daySchedule.to ?? ''}
                                  onChange={event => setWorkingHoursForm(current => current ? {
                                    ...current,
                                    default: {
                                      ...current.default,
                                      schedule: current.default.schedule.map(s => s.day === daySchedule.day ? { ...s, to: event.target.value || null } : s),
                                    },
                                  } : current)}
                                />
                              </label>
                            </>
                          ) : (
                            <span className="col-span-2 text-sm text-slate-400">{t('settings.workingHours.closed')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="page-stack">
                  <div className="page-header-row">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">{t('settings.workingHours.overrideTitle')}</h3>
                      <p className="helper-copy">{t('settings.workingHours.overrideHelp')}</p>
                    </div>
                  </div>
                  {workingHoursForm.departmentOverrides.map(override => (
                    <div key={override.departmentId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 page-stack">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">{override.departmentName ?? override.departmentId}</span>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-600 hover:underline"
                          onClick={() => setWorkingHoursForm(current => current ? { ...current, departmentOverrides: current.departmentOverrides.filter(o => o.departmentId !== override.departmentId) } : current)}
                        >
                          {t('settings.workingHours.removeOverride')}
                        </button>
                      </div>
                      <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-700">
                        <input
                          className="field-checkbox"
                          type="checkbox"
                          checked={override.isAlwaysOpen}
                          onChange={event => setWorkingHoursForm(current => current ? {
                            ...current,
                            departmentOverrides: current.departmentOverrides.map(o => o.departmentId === override.departmentId ? { ...o, isAlwaysOpen: event.target.checked } : o),
                          } : current)}
                        />
                        {t('settings.workingHours.alwaysOpen')}
                      </label>
                      {!override.isAlwaysOpen && (
                        <div className="grid gap-2">
                          {override.schedule.map(daySchedule => (
                            <div key={daySchedule.day} className="grid grid-cols-[120px_1fr_1fr] gap-3 items-center">
                              <span className="text-sm font-semibold text-slate-700">{t(`settings.workingHours.days.${daySchedule.day}`)}</span>
                              {daySchedule.from !== null || daySchedule.to !== null ? (
                                <>
                                  <label className="grid gap-1 text-xs font-semibold text-slate-500">
                                    <span>{t('settings.workingHours.from')}</span>
                                    <input
                                      className="field-input"
                                      type="time"
                                      value={daySchedule.from ?? ''}
                                      onChange={event => setWorkingHoursForm(current => current ? {
                                        ...current,
                                        departmentOverrides: current.departmentOverrides.map(o => o.departmentId === override.departmentId ? {
                                          ...o,
                                          schedule: o.schedule.map(s => s.day === daySchedule.day ? { ...s, from: event.target.value || null } : s),
                                        } : o),
                                      } : current)}
                                    />
                                  </label>
                                  <label className="grid gap-1 text-xs font-semibold text-slate-500">
                                    <span>{t('settings.workingHours.to')}</span>
                                    <input
                                      className="field-input"
                                      type="time"
                                      value={daySchedule.to ?? ''}
                                      onChange={event => setWorkingHoursForm(current => current ? {
                                        ...current,
                                        departmentOverrides: current.departmentOverrides.map(o => o.departmentId === override.departmentId ? {
                                          ...o,
                                          schedule: o.schedule.map(s => s.day === daySchedule.day ? { ...s, to: event.target.value || null } : s),
                                        } : o),
                                      } : current)}
                                    />
                                  </label>
                                </>
                              ) : (
                                <span className="col-span-2 text-sm text-slate-400">{t('settings.workingHours.closed')}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div>
                    <SingleSelectDropdown
                      options={departments
                        .filter(d => !workingHoursForm.departmentOverrides.some(o => o.departmentId === d.departmentId))
                        .map(d => ({ value: d.departmentId, label: d.name }))}
                      value=""
                      onChange={deptId => {
                        if (!deptId) return
                        const dept = departments.find(d => d.departmentId === deptId)
                        if (!dept) return
                        setWorkingHoursForm(current => current ? {
                          ...current,
                          departmentOverrides: [
                            ...current.departmentOverrides,
                            {
                              departmentId: deptId,
                              departmentName: dept.name,
                              isAlwaysOpen: false,
                              schedule: [
                                { day: 1, from: '08:00', to: '17:00' },
                                { day: 2, from: '08:00', to: '17:00' },
                                { day: 3, from: '08:00', to: '17:00' },
                                { day: 4, from: '08:00', to: '17:00' },
                                { day: 5, from: '08:00', to: '17:00' },
                                { day: 6, from: null, to: null },
                                { day: 0, from: null, to: null },
                              ],
                            },
                          ],
                        } : current)
                      }}
                      placeholder={t('settings.workingHours.addOverride')}
                      searchable
                      searchPlaceholder={t('common.search', 'Ara...')}
                    />
                  </div>
                </div>
              </>
            )}
            <div className="inline-actions">
              <Button type="submit">{t('settings.workingHours.save')}</Button>
            </div>
          </form>

          <form className="section-card page-stack" onSubmit={event => void saveSmsSettings(event)}>
            <div className="page-header-row">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">{t('settings.sms.sectionTitle')}</h2>
                <p className="helper-copy">{t('settings.sms.sectionDescription')}</p>
              </div>
            </div>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <input
                className="field-checkbox"
                type="checkbox"
                checked={smsForm.isEnabled}
                onChange={event => setSmsForm(current => ({ ...current, isEnabled: event.target.checked }))}
              />
              {t('settings.sms.isEnabled')}
            </label>
            {smsForm.isEnabled && (
              <>
                <div className="field-row">
                  <label className="field-label">{t('settings.sms.provider')}</label>
                  <SingleSelectDropdown
                    options={[
                      { value: 'NetGSM', label: t('settings.sms.providers.NetGSM') },
                      { value: 'Iletimerkezi', label: t('settings.sms.providers.Iletimerkezi') },
                      { value: 'Verimor', label: t('settings.sms.providers.Verimor') },
                      { value: 'Custom', label: t('settings.sms.providers.Custom') },
                    ]}
                    value={smsForm.provider}
                    onChange={provider => setSmsForm(current => ({ ...current, provider: provider as SmsSettingsUpdate['provider'] }))}
                    placeholder={t('settings.sms.provider')}
                  />
                </div>
                {smsForm.provider === 'Custom' && (
                  <div className="field-row">
                    <label className="field-label">{t('settings.sms.apiUrl')}</label>
                    <input
                      className="field-input"
                      type="url"
                      placeholder={t('settings.sms.apiUrlPlaceholder')}
                      value={smsForm.apiUrl ?? ''}
                      onChange={event => setSmsForm(current => ({ ...current, apiUrl: event.target.value || null }))}
                    />
                  </div>
                )}
                <div className="field-row">
                  <label className="field-label">{t('settings.sms.username')}</label>
                  <input
                    className="field-input"
                    type="text"
                    value={smsForm.username ?? ''}
                    onChange={event => setSmsForm(current => ({ ...current, username: event.target.value || null }))}
                  />
                </div>
                <div className="field-row">
                  <label className="field-label">{t('settings.sms.password')}</label>
                  <input
                    className="field-input"
                    type="password"
                    placeholder={t('settings.sms.passwordPlaceholder')}
                    value={smsForm.password ?? ''}
                    onChange={event => setSmsForm(current => ({ ...current, password: event.target.value || null }))}
                  />
                  {smsSettings?.hasPassword && (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                      <input
                        className="field-checkbox"
                        type="checkbox"
                        checked={smsForm.clearPassword}
                        onChange={event => setSmsForm(current => ({ ...current, clearPassword: event.target.checked }))}
                      />
                      {t('settings.sms.clearPassword')}
                    </label>
                  )}
                </div>
                <div className="field-row">
                  <label className="field-label">{t('settings.sms.originator')}</label>
                  <input
                    className="field-input"
                    type="text"
                    maxLength={11}
                    placeholder={t('settings.sms.originatorPlaceholder')}
                    value={smsForm.originator ?? ''}
                    onChange={event => setSmsForm(current => ({ ...current, originator: event.target.value || null }))}
                  />
                  <p className="helper-copy">{t('settings.sms.originatorHelp')}</p>
                </div>
              </>
            )}
            <div className="inline-actions">
              <Button type="submit">{t('settings.sms.save')}</Button>
            </div>
          </form>

          <form className="section-card page-stack" onSubmit={event => void saveFileStorageSettings(event)}>
            <div className="page-header-row">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">{t('settings.fileStorage.sectionTitle')}</h2>
                <p className="helper-copy">{t('settings.fileStorage.sectionDescription')}</p>
              </div>
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-4 text-base font-extrabold text-slate-900">{t('settings.fileStorage.nasTitle')}</h3>
                <div className="grid gap-4">
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.host')}</span>
                    <input className="field-input" placeholder="192.168.1.100" value={fileStorageForm.nasHost ?? ''} onChange={event => setFileStorageForm(current => ({ ...current, nasHost: event.target.value || null }))} />
                  </label>
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.shareName')}</span>
                    <input className="field-input" value={fileStorageForm.nasShareName ?? ''} onChange={event => setFileStorageForm(current => ({ ...current, nasShareName: event.target.value || null }))} />
                  </label>
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.protocol')}</span>
                    <SingleSelectDropdown
                      options={[
                        { value: 'SMB/CIFS', label: 'SMB/CIFS' },
                        { value: 'NFS', label: 'NFS' },
                      ]}
                      value={fileStorageForm.nasProtocol}
                      onChange={nasProtocol => setFileStorageForm(current => ({ ...current, nasProtocol: nasProtocol as FileStorageSettingsUpdate['nasProtocol'] }))}
                      placeholder={t('settings.fileStorage.protocol')}
                    />
                  </label>
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.username')}</span>
                    <input className="field-input" value={fileStorageForm.nasUsername ?? ''} onChange={event => setFileStorageForm(current => ({ ...current, nasUsername: event.target.value || null }))} />
                  </label>
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.password')}</span>
                    <input className="field-input" type="password" placeholder={t('settings.fileStorage.passwordPlaceholder')} value={fileStorageForm.nasPassword ?? ''} onChange={event => setFileStorageForm(current => ({ ...current, nasPassword: event.target.value || null, clearNasPassword: false }))} />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input className="field-checkbox" type="checkbox" checked={fileStorageForm.clearNasPassword} onChange={event => setFileStorageForm(current => ({ ...current, clearNasPassword: event.target.checked, nasPassword: null }))} />
                    {t('settings.fileStorage.clearPassword')}
                  </label>
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-4 text-base font-extrabold text-slate-900">{t('settings.fileStorage.ftpTitle')}</h3>
                <div className="grid gap-4">
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.host')}</span>
                    <input className="field-input" placeholder="ftp.example.com" value={fileStorageForm.ftpHost ?? ''} onChange={event => setFileStorageForm(current => ({ ...current, ftpHost: event.target.value || null }))} />
                  </label>
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.port')}</span>
                    <input className="field-input" type="number" min={1} max={65535} value={fileStorageForm.ftpPort} onChange={event => setFileStorageForm(current => ({ ...current, ftpPort: Number(event.target.value) || 21 }))} />
                  </label>
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.path')}</span>
                    <input className="field-input" placeholder="/attachments" value={fileStorageForm.ftpPath ?? ''} onChange={event => setFileStorageForm(current => ({ ...current, ftpPath: event.target.value || null }))} />
                  </label>
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.protocol')}</span>
                    <SingleSelectDropdown
                      options={[
                        { value: 'FTP', label: 'FTP' },
                        { value: 'FTPS', label: 'FTPS' },
                        { value: 'SFTP', label: 'SFTP' },
                      ]}
                      value={fileStorageForm.ftpProtocol}
                      onChange={ftpProtocol => setFileStorageForm(current => ({ ...current, ftpProtocol: ftpProtocol as FileStorageSettingsUpdate['ftpProtocol'] }))}
                      placeholder={t('settings.fileStorage.protocol')}
                    />
                  </label>
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.username')}</span>
                    <input className="field-input" value={fileStorageForm.ftpUsername ?? ''} onChange={event => setFileStorageForm(current => ({ ...current, ftpUsername: event.target.value || null }))} />
                  </label>
                  <label className="field-row">
                    <span className="field-label">{t('settings.fileStorage.password')}</span>
                    <input className="field-input" type="password" placeholder={t('settings.fileStorage.passwordPlaceholder')} value={fileStorageForm.ftpPassword ?? ''} onChange={event => setFileStorageForm(current => ({ ...current, ftpPassword: event.target.value || null, clearFtpPassword: false }))} />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input className="field-checkbox" type="checkbox" checked={fileStorageForm.clearFtpPassword} onChange={event => setFileStorageForm(current => ({ ...current, clearFtpPassword: event.target.checked, ftpPassword: null }))} />
                    {t('settings.fileStorage.clearPassword')}
                  </label>
                </div>
              </section>
            </div>
            <div className="inline-actions">
              <Button type="submit">{t('common.save')}</Button>
            </div>
          </form>

          <form className="section-card page-stack" onSubmit={event => void saveSyslogSettings(event)}>
            <div className="page-header-row">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">{t('settings.syslog.sectionTitle')}</h2>
                <p className="helper-copy">{t('settings.syslog.sectionDescription')}</p>
              </div>
            </div>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
              <input
                className="field-checkbox"
                type="checkbox"
                checked={syslogForm.isEnabled}
                onChange={event => setSyslogForm(current => ({ ...current, isEnabled: event.target.checked }))}
              />
              {t('settings.syslog.isEnabled')}
            </label>
            {syslogForm.isEnabled && (
              <>
                <div className="field-row">
                  <label className="field-label">{t('settings.syslog.host')}</label>
                  <input
                    className="field-input"
                    type="text"
                    placeholder={t('settings.syslog.hostPlaceholder')}
                    value={syslogForm.host ?? ''}
                    onChange={event => setSyslogForm(current => ({ ...current, host: event.target.value || null }))}
                  />
                </div>
                <div className="field-row">
                  <label className="field-label">{t('settings.syslog.port')}</label>
                  <input
                    className="field-input"
                    type="number"
                    min={1}
                    max={65535}
                    value={syslogForm.port}
                    onChange={event => setSyslogForm(current => ({ ...current, port: parseInt(event.target.value, 10) || 514 }))}
                  />
                </div>
                <div className="field-row">
                  <label className="field-label">{t('settings.syslog.format')}</label>
                  <SingleSelectDropdown
                    options={[
                      { value: 'Syslog', label: t('settings.syslog.formats.Syslog') },
                      { value: 'CEF', label: t('settings.syslog.formats.CEF') },
                    ]}
                    value={syslogForm.format}
                    onChange={format => setSyslogForm(current => ({ ...current, format: format as SyslogSettingsUpdate['format'] }))}
                    placeholder={t('settings.syslog.format')}
                  />
                </div>
                <div className="field-row">
                  <label className="field-label">{t('settings.syslog.transport')}</label>
                  <SingleSelectDropdown
                    options={[
                      { value: 'UDP', label: t('settings.syslog.transports.UDP') },
                      { value: 'TCP', label: t('settings.syslog.transports.TCP') },
                    ]}
                    value={syslogForm.transport}
                    onChange={transport => setSyslogForm(current => ({ ...current, transport: transport as SyslogSettingsUpdate['transport'] }))}
                    placeholder={t('settings.syslog.transport')}
                  />
                </div>
              </>
            )}
            <div className="inline-actions">
              <Button type="submit">{t('settings.syslog.save')}</Button>
            </div>
          </form>

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
                  <SingleSelectDropdown
                    options={['Disabled', 'TrustedHeader', 'Negotiate'].map(mode => ({
                      value: mode,
                      label: t(`settings.authAutomaticSignInModes.${mode}`),
                    }))}
                    value={tenantAuthenticationPolicy.automaticSignInMode}
                    onChange={automaticSignInMode => setTenantAuthenticationPolicy(current => ({ ...current, automaticSignInMode }))}
                    placeholder={t('settings.authAutomaticSignInMode')}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>{t('settings.authSecondFactorProvider')}</span>
                  <SingleSelectDropdown
                    options={['Disabled', 'Mock', 'Webhook'].map(provider => ({
                      value: provider,
                      label: t(`settings.authSecondFactorProviders.${provider}`),
                    }))}
                    value={tenantAuthenticationPolicy.secondFactorProvider}
                    onChange={secondFactorProvider => setTenantAuthenticationPolicy(current => ({ ...current, secondFactorProvider }))}
                    placeholder={t('settings.authSecondFactorProvider')}
                  />
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

        </div>
      ) : null}

      {activeTab === 'appearance' ? (
        <div className="page-stack">
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
                    <th key={role}>{role === 'Manager' ? t('settings.roles.managerLabel', 'Birim Yöneticisi/Sorumluları') : getRoleLabel(t, role)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedPageAccessItems.map(page => (
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
          <TablePagination
            totalCount={PAGE_ACCESS_ITEMS.length}
            pageSize={rolesPageSize}
            currentPage={rolesSafePage}
            onPageSizeChange={size => { setRolesPageSize(size); setRolesPage(1) }}
            onPageChange={setRolesPage}
          />
          <p className="helper-copy">{t('settings.roles.note')}</p>
          <div className="inline-actions">
            <Button type="button" onClick={saveRolePages}>{t('common.save')}</Button>
            <Button type="button" variant="secondary" onClick={resetRolePages}>{t('settings.roles.resetDefaults')}</Button>
          </div>
        </section>
      ) : null}

      {activeTab === 'social' && socialStatus ? (
        <div className="page-stack">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('settings.socialConfig.sectionTitle')}</h2>
            <p className="helper-copy">{t('settings.socialConfig.sectionDescription')}</p>
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-2">
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
                          <input
                            className="field-input"
                            type={field.secret ? 'password' : 'text'}
                            value={socialForms[channel.id][field.key] ?? ''}
                            placeholder={field.secret && status.configured ? t('settings.socialConfig.secretPlaceholder', 'Değiştirmek için yeni değer girin') : undefined}
                            onChange={event => updateSocialField(channel.id, field.key, event.target.value)}
                          />
                        </label>
                      ))}
                      {channel.id === 'whatsapp' && whatsAppWebhookUrl ? (
                        <label className="grid gap-2 text-sm font-semibold text-slate-700">
                          <span>{t('settings.socialConfig.whatsappWebhookUrl')}</span>
                          <input className="field-input font-mono text-xs" type="text" readOnly value={whatsAppWebhookUrl} />
                          <span className="helper-copy">{t('settings.socialConfig.whatsappWebhookHelp')}</span>
                        </label>
                      ) : null}
                      <div className="inline-actions">
                        <Button type="submit">{t('common.save')}</Button>
                      </div>
                    </form>
                  ) : null}
                </section>
              )
            })}
            <section className="section-card page-stack">
              <div className="page-header-row">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-950">Web Formu</h3>
                  <p className="helper-copy">Vatandaş web formu kanalı için başvuru kaynak etiketi.</p>
                </div>
                <StatusPill tone="neutral">
                  {t('settings.socialConfig.notConfigured')}
                </StatusPill>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activeTab === 'routing' && routingConfig ? (
        <div className="page-stack">
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
                <h2 className="text-xl font-extrabold text-slate-950">{t('settings.routing.autoRepliesTitle', 'Vatandaşa Giden Cevaplar')}</h2>
                <p className="helper-copy">{t('settings.routing.autoRepliesDescription', 'Vatandaş talebi durumlarına göre otomatik gönderilecek taslak cevapları düzenleyin.')}</p>
              </div>
              <Button type="button" onClick={() => void saveCitizenAutoReplies()} disabled={citizenAutoReplySaving}>
                {citizenAutoReplySaving ? t('common.saving', 'Kaydediliyor...') : t('common.save', 'Kaydet')}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {([
                { key: 'processingReceived', label: t('social.requestStatus.processingReceived', 'İşleme Alındı'), tone: 'warning' },
                { key: 'inProgress', label: t('social.requestStatus.inProgress', 'Yapılmakta'), tone: 'warning' },
                { key: 'completed', label: t('social.requestStatus.completed', 'Tamamlandı'), tone: 'success' },
                { key: 'cancelled', label: t('social.requestStatus.cancelledMessage', 'İptal Edildi'), templateLabel: t('social.requestStatus.cancelledMessage', 'İptal Edildi'), tone: 'danger' },
              ] as Array<{ key: CitizenAutoReplyTemplateKey; label: string; templateLabel?: string; tone: 'success' | 'warning' | 'danger' }>).map(({ key, label, templateLabel, tone }) => (
                <CitizenAutoReplyTemplateField
                  key={key}
                  label={label}
                  statusLabel={label}
                  templateStatusLabel={templateLabel}
                  tone={tone}
                  value={citizenAutoReplyTemplates[key]}
                  onChange={value => setCitizenAutoReplyTemplates(current => ({ ...current, [key]: value }))}
                />
              ))}
            </div>
            <p className="text-xs font-medium text-slate-500">
              {t('settings.routing.autoRepliesTokens', 'Sabit alanlar düzenlenemez: {VatandaşTalepNo}, {VatandaşTalepBaşlığı}, durum adı ve {GönderilenBirim}.')}
            </p>
          </section>

        </div>
      ) : null}
      {activeTab === 'templates' ? (
        <div className="flex gap-4 min-h-[520px]">
          <div className="flex w-64 shrink-0 flex-col gap-2">
            <div className="grid gap-2">
              <button
                type="button"
                onClick={startNewTemplate}
                className="flex items-center justify-center gap-2 rounded-xl bg-[color:var(--color-primary)] px-4 py-2.5 text-center text-sm font-bold text-white shadow-sm hover:opacity-90"
              >
                + Yeni Şablon Oluştur
              </button>
              <button
                type="button"
                onClick={() => void syncMetaTemplates()}
                disabled={syncingMetaTemplates}
                className="flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-center text-sm font-bold text-orange-700 shadow-sm hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${syncingMetaTemplates ? 'animate-spin' : ''}`} />
                {syncingMetaTemplates ? 'Senkronize ediliyor…' : "Meta'dan Senkronize Et"}
              </button>
            </div>
            <div className="flex flex-col gap-0.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
              {templates.map(tpl => (
                <button
                  key={tpl.templateId}
                  type="button"
                  onClick={() => selectTemplate(tpl)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${selectedTemplateId === tpl.templateId ? 'bg-[color:var(--color-primary)]/10 font-bold text-[color:var(--color-primary)]' : 'font-medium text-slate-700 hover:bg-slate-50'}`}
                >
                  <span className="min-w-0 truncate">{tpl.name}</span>
                  {isMetaWhatsAppTemplate(tpl) ? (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-700">
                      Meta
                    </span>
                  ) : null}
                </button>
              ))}
              {templates.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400">Henüz şablon yok</div>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {isNewTemplate || selectedTemplateId ? (
              <form onSubmit={saveTemplate} className="section-card page-stack">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {templateEditorMode === 'meta'
                      ? 'Whatsapp Meta Onaylı Şablon Mesaj'
                      : (isNewTemplate ? 'Yeni Şablon' : 'Şablonu Düzenle')}
                  </h2>
                  {selectedTemplateId && !isNewTemplate ? (
                    <button
                      type="button"
                      onClick={() => deleteTemplate(selectedTemplateId)}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-rose-700"
                    >
                      Sil
                    </button>
                  ) : null}
                </div>
                {templateEditorMode === 'meta' ? (
                  <p className="-mt-2 text-sm text-slate-500">
                    WhatsApp Business&apos;taki 24 saat sınırı, WhatsApp Business Platform (API) kullanan kurumlar için geçerlidir.
                  </p>
                ) : null}

                {templateEditorMode === 'classic' ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)]">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700">Aktif</span>
                      <button
                        type="button"
                        onClick={() => setTemplateForm(cur => ({ ...cur, isActive: !cur.isActive }))}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${templateForm.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        role="switch" aria-checked={templateForm.isActive}
                      >
                        <span className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${templateForm.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700">Zamanlı Yanıt</span>
                      <button
                        type="button"
                        onClick={() => setTemplateForm(cur => ({ ...cur, timedReplyEnabled: !cur.timedReplyEnabled }))}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${templateForm.timedReplyEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        role="switch" aria-checked={templateForm.timedReplyEnabled}
                      >
                        <span className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${templateForm.timedReplyEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    <span>Şablon Türü</span>
                    <SingleSelectDropdown
                      options={TEMPLATE_CHANNEL_OPTIONS.map(ch => ({ value: ch, label: ch }))}
                      value={templateForm.channel}
                      onChange={channel => setTemplateForm(cur => ({ ...cur, channel }))}
                      placeholder="Şablon Türü"
                    />
                  </label>
                </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">Aktif</span>
                    <button
                      type="button"
                      onClick={() => setTemplateForm(cur => ({ ...cur, isActive: !cur.isActive }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${templateForm.isActive ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      role="switch" aria-checked={templateForm.isActive}
                    >
                      <span className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${templateForm.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-xs font-semibold text-slate-500">
                      {templates.filter(isMetaWhatsAppTemplate).length} Meta şablon
                    </span>
                  </div>
                )}

                {templateEditorMode === 'classic' && templateForm.timedReplyEnabled ? (
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 page-stack">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                        <span>Başlama Saati</span>
                        <div className="relative">
                          <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                          <input
                            className="field-input pl-10"
                            type="time"
                            value={templateForm.timedReplyStartTime}
                            onChange={event => setTemplateForm(current => ({ ...current, timedReplyStartTime: event.target.value }))}
                          />
                        </div>
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                        <span>Bitiş Saati</span>
                        <div className="relative">
                          <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                          <input
                            className="field-input pl-10"
                            type="time"
                            value={templateForm.timedReplyEndTime}
                            onChange={event => setTemplateForm(current => ({ ...current, timedReplyEndTime: event.target.value }))}
                          />
                        </div>
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                        <span>
                          Cumartesi ve Pazar{' '}
                          <span className="text-xs font-normal text-slate-500">(hafta sonu tatili)</span>
                        </span>
                        <div className="field-input flex min-h-[2.5rem] items-center gap-2 px-3">
                          <input
                            className="field-checkbox"
                            type="checkbox"
                            checked={templateForm.timedReplyWeekendAllHours}
                            onChange={toggleWeekendAllHours}
                          />
                          <span className="font-semibold text-black">Tüm Saatler</span>
                        </div>
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                        <span>Başlama Tarihi</span>
                        <DateTimePicker
                          value={toTemplateDatePickerValue(templateForm.timedReplyStartDate)}
                          onChange={value => setTemplateForm(current => ({
                            ...current,
                            timedReplyStartDate: fromTemplateDatePickerValue(value),
                          }))}
                          placeholder="Başlama tarihi"
                          forceUp
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                        <span>Bitiş Tarihi</span>
                        <DateTimePicker
                          value={toTemplateDatePickerValue(templateForm.timedReplyEndDate)}
                          onChange={value => setTemplateForm(current => ({
                            ...current,
                            timedReplyEndDate: fromTemplateDatePickerValue(value),
                          }))}
                          placeholder="Bitiş tarihi"
                          forceUp
                        />
                      </label>
                    </div>

                    <div className="page-stack">
                      <span className="text-sm font-semibold text-slate-700">Aktif Günler</span>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {TEMPLATE_WEEKDAY_OPTIONS.map(day => (
                          <label key={day.id} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                            <input
                              className="field-checkbox"
                              type="checkbox"
                              checked={templateForm.activeDays.includes(day.id)}
                              onChange={() => toggleTemplateDay(day.id)}
                            />
                            {day.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => { void saveTemplateSchedule() }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
                    >
                      <Save className="size-4" />
                      Saati Ayarla
                    </button>
                  </section>
                ) : null}

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>Şablon Adı</span>
                  <input
                    className="field-input text-base"
                    required
                    placeholder="Şablon adını girin"
                    value={templateForm.name}
                    onChange={e => setTemplateForm(cur => ({ ...cur, name: e.target.value }))}
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>Gönderilecek Mesaj</span>
                  <textarea
                    className="field-textarea text-base"
                    required
                    rows={5}
                    placeholder="Gönderilecek mesaj içeriğini buraya yazın..."
                    value={templateForm.content}
                    onChange={e => setTemplateForm(cur => ({ ...cur, content: e.target.value }))}
                  />
                </label>

                {templateEditorMode === 'classic' ? (
                  <>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">Genel cevap</span>
                  <button
                    type="button"
                    onClick={() => setTemplateForm(cur => ({ ...cur, isGeneral: !cur.isGeneral }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${templateForm.isGeneral ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    role="switch" aria-checked={templateForm.isGeneral}
                  >
                    <span className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${templateForm.isGeneral ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 items-end">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">Otomatik Cevap</span>
                    <button
                      type="button"
                      onClick={() => setTemplateForm(cur => ({ ...cur, autoReply: !cur.autoReply }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${templateForm.autoReply ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      role="switch" aria-checked={templateForm.autoReply}
                    >
                      <span className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${templateForm.autoReply ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {templateForm.autoReply ? (
                    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                      <span>Cevap Süresi</span>
                      <SingleSelectDropdown
                        options={TEMPLATE_REPLY_DELAY_OPTIONS.map(s => ({ value: String(s), label: `${s} saniye` }))}
                        value={String(templateForm.replyDelaySecs)}
                        onChange={value => setTemplateForm(cur => ({ ...cur, replyDelaySecs: Number(value) }))}
                        placeholder="Cevap Süresi"
                      />
                    </label>
                  ) : null}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">Anahtar Kelime</span>
                    <button
                      type="button"
                      onClick={() => setTemplateForm(cur => ({ ...cur, hasKeyword: !cur.hasKeyword }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${templateForm.hasKeyword ? 'bg-emerald-500' : 'bg-slate-200'}`}
                      role="switch" aria-checked={templateForm.hasKeyword}
                    >
                      <span className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform ${templateForm.hasKeyword ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {templateForm.hasKeyword ? (
                    <div className="mt-3 grid gap-2">
                      <span className="text-sm font-semibold text-slate-700">Kelimeler</span>
                      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 min-h-[42px]">
                        {templateForm.keywords.map(kw => (
                          <span key={kw} className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                            {kw}
                            <button type="button" onClick={() => removeKeyword(kw)} className="ml-0.5 text-slate-400 hover:text-rose-500">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className="field-input flex-1"
                          placeholder="Kelime ekle ve Enter'a bas"
                          value={keywordInput}
                          onChange={e => setKeywordInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                        />
                        <button type="button" onClick={addKeyword} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                          Ekle
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                  </>
                ) : null}

                <div className="inline-actions">
                  <button
                    type="button"
                    onClick={() => { setSelectedTemplateId(null); setIsNewTemplate(false); setTemplateEditorMode('classic') }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    İptal
                  </button>
                  <Button type="submit">Kaydet</Button>
                </div>
              </form>
            ) : (
              <div className="section-card flex h-full items-center justify-center text-slate-400">
                <div className="text-center">
                  <p className="text-sm font-semibold">Düzenlemek için soldaki listeden bir şablon seçin</p>
                  <p className="text-xs">veya yeni şablon oluşturun</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
      {toast && (
        <Toast
          message={toast.text}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
