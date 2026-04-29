import { Building2, MessageSquareMore, Send, Workflow } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { MultiSelectDropdown } from '../components/ui/multi-select-dropdown'
import { useAuth } from '../context/AuthContext'
import type { Department, User } from '../types/platform'

type RequestKind = 'internal' | 'external' | 'citizen'
type RequestOwnershipMode = 'department' | 'users'

interface InternalFormState {
  title: string
  description: string
  ownershipMode: RequestOwnershipMode
  ownerUserIds: string[]
  priority: string
  dueDateUtc: string
  isProject: boolean
}

interface ExternalFormState extends InternalFormState {
  ownerDepartmentId: string
  startDateUtc: string
}

interface CitizenFormState {
  channel: string
  citizenHandle: string
  content: string
  category: string
}

const EMPTY_INTERNAL_FORM: InternalFormState = {
  title: '',
  description: '',
  ownershipMode: 'department',
  ownerUserIds: [],
  priority: 'Normal',
  dueDateUtc: '',
  isProject: false,
}

const EMPTY_EXTERNAL_FORM: ExternalFormState = {
  ...EMPTY_INTERNAL_FORM,
  ownerDepartmentId: '',
  startDateUtc: '',
}

const EMPTY_CITIZEN_FORM: CitizenFormState = {
  channel: 'Other',
  citizenHandle: '',
  content: '',
  category: '',
}

const CITIZEN_CHANNELS = ['Facebook', 'Instagram', 'X', 'Email', 'WebForm', 'WhatsApp', 'Other']

function toApiDateTime(value: string) {
  return value ? new Date(value).toISOString() : null
}

function openDatePicker(event: React.MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
  input.showPicker?.()
}

export function CreateRequestPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [selectedKind, setSelectedKind] = useState<RequestKind | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [internalForm, setInternalForm] = useState<InternalFormState>(EMPTY_INTERNAL_FORM)
  const [externalForm, setExternalForm] = useState<ExternalFormState>(EMPTY_EXTERNAL_FORM)
  const [citizenForm, setCitizenForm] = useState<CitizenFormState>(EMPTY_CITIZEN_FORM)
  const canCreateCitizenRequest = user?.role === 'Operator'

  const myDepartmentId = useMemo(() => {
    return user?.departmentId || users.find(item => item.userId === user?.userId)?.departmentId || ''
  }, [user?.departmentId, user?.userId, users])

  const ownerDepartmentOptions = useMemo(() => {
    if (user?.role === 'Staff' && myDepartmentId) {
      return departments.filter(department => department.departmentId === myDepartmentId)
    }

    return departments
  }, [departments, myDepartmentId, user?.role])

  const myDepartmentName = useMemo(() => {
    return departments.find(department => department.departmentId === myDepartmentId)?.name ?? ''
  }, [departments, myDepartmentId])

  const activeUsers = useMemo(() => users.filter(item => item.isActive), [users])
  const internalOwnerUserOptions = useMemo(() => {
    const departmentUsers = activeUsers.filter(item => item.departmentId === myDepartmentId)

    if (user?.role === 'Staff') {
      return departmentUsers.filter(item => item.userId === user.userId)
    }

    return departmentUsers
  }, [activeUsers, myDepartmentId, user?.role, user?.userId])
  const externalOwnerUserOptions = useMemo(() => {
    const departmentUsers = activeUsers.filter(item => item.departmentId === externalForm.ownerDepartmentId)

    if (user?.role === 'Staff') {
      return departmentUsers.filter(item => item.userId === user.userId)
    }

    return departmentUsers
  }, [activeUsers, externalForm.ownerDepartmentId, user?.role, user?.userId])

  const requestTypeOptions = useMemo(() => {
    const options: { value: RequestKind; label: string }[] = [
      { value: 'internal' as const, label: t('requests.create.internalPluralTitle', 'Birim İçi Talepler') },
      { value: 'external' as const, label: t('requests.create.externalPluralTitle', 'Birim Dışı Talepler') },
    ]

    if (canCreateCitizenRequest) {
      options.push({ value: 'citizen' as const, label: t('requests.create.citizenTitle', 'Vatandaş Talepleri') })
    }

    return options
  }, [canCreateCitizenRequest, t])

  const selectRequestKind = (kind: RequestKind) => {
    setSelectedKind(kind)
    setError(null)
  }

  const getRequestTypeLabel = (kind: RequestKind | null) => {
    return requestTypeOptions.find(option => option.value === kind)?.label ?? ''
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([api.getDepartments(), api.getUsers().catch(() => [] as User[])])
      .then(([departmentList, userList]) => {
        if (cancelled) return
        setDepartments(departmentList)
        setUsers(userList)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('common.error'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [t])

  useEffect(() => {
    if (!selectedKind || externalForm.ownerDepartmentId) return
    const firstDepartmentId = myDepartmentId || ownerDepartmentOptions[0]?.departmentId
    if (firstDepartmentId) {
      setExternalForm(current => ({ ...current, ownerDepartmentId: firstDepartmentId }))
    }
  }, [externalForm.ownerDepartmentId, myDepartmentId, ownerDepartmentOptions, selectedKind])

  useEffect(() => {
    if (selectedKind === 'citizen' && !canCreateCitizenRequest) {
      setSelectedKind(null)
    }
  }, [canCreateCitizenRequest, selectedKind])

  useEffect(() => {
    const allowedIds = new Set(internalOwnerUserOptions.map(item => item.userId))
    setInternalForm(current => {
      const ownerUserIds = current.ownerUserIds.filter(userId => allowedIds.has(userId))
      return ownerUserIds.length === current.ownerUserIds.length ? current : { ...current, ownerUserIds }
    })
  }, [internalOwnerUserOptions])

  useEffect(() => {
    const allowedIds = new Set(externalOwnerUserOptions.map(item => item.userId))
    setExternalForm(current => {
      const ownerUserIds = current.ownerUserIds.filter(userId => allowedIds.has(userId))
      return ownerUserIds.length === current.ownerUserIds.length ? current : { ...current, ownerUserIds }
    })
  }, [externalOwnerUserOptions])

  const renderRequestTypeField = () => (
    <div className="job-field">
      <label className="job-field-label" htmlFor="request-kind">{t('requests.create.typeLabel', 'Talep Tipi')}</label>
      <input id="request-kind" className="field-input bg-slate-50 font-semibold text-slate-700" value={getRequestTypeLabel(selectedKind)} readOnly />
    </div>
  )

  const renderOwnershipFields = (
    mode: RequestOwnershipMode,
    ownerUserIds: string[],
    ownerUserOptions: User[],
    onModeChange: (mode: RequestOwnershipMode) => void,
    onUsersChange: (userIds: string[]) => void,
  ) => (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="job-field">
        <span className="job-field-label">{t('requests.create.ownershipMode', 'Sahiplik')}</span>
        <select
          className="field-select"
          value={mode}
          onChange={event => onModeChange(event.target.value as RequestOwnershipMode)}
        >
          <option value="department">{t('requests.create.ownershipDepartment', 'Müdürlük')}</option>
          <option value="users">{t('requests.create.ownershipUsers', 'Kullanıcı')}</option>
        </select>
      </label>
      {mode === 'users' ? (
        <div className="job-field">
          <span className="job-field-label">{t('requests.create.ownerUsers', 'Sahip Kullanıcılar')}</span>
          <MultiSelectDropdown
            options={ownerUserOptions.map(item => ({ value: item.userId, label: item.displayName }))}
            value={ownerUserIds}
            onChange={onUsersChange}
            placeholder={t('requests.create.ownerUsersPlaceholder', 'Kullanıcı seçin')}
            emptyText={t('requests.create.ownerUsersEmpty', 'Bu müdürlükte seçilebilir aktif kullanıcı bulunmuyor.')}
          />
          <span className="helper-copy">
            {ownerUserOptions.length > 0
              ? t('requests.create.ownerUsersHelp', 'Bir veya daha fazla kullanıcı seçildiğinde her kullanıcı için görev oluşturulur.')
              : t('requests.create.ownerUsersEmpty', 'Bu müdürlükte seçilebilir aktif kullanıcı bulunmuyor.')}
          </span>
        </div>
      ) : (
        <div className="job-field">
          <span className="job-field-label">{t('requests.create.ownerUsers', 'Sahip Kullanıcılar')}</span>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            {t('requests.create.departmentOwnershipHelp', 'Talep müdürlükte kalır; otomatik görev oluşturulmaz.')}
          </div>
        </div>
      )}
    </div>
  )

  const handleCreateInternal = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!myDepartmentId) {
      setError(t('tasks.newRequest.noDepartment', 'Departman bilgisi bulunamadı.'))
      return
    }
    if (internalForm.ownershipMode === 'users' && internalForm.ownerUserIds.length === 0) {
      setError(t('requests.create.ownerUsersRequired', 'Kullanıcı sahipliği için en az bir kullanıcı seçin.'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.createJob({
        title: internalForm.title.trim(),
        description: internalForm.description.trim(),
        ownerDepartmentId: myDepartmentId,
        ownerUserIds: internalForm.ownershipMode === 'users' ? internalForm.ownerUserIds : [],
        priority: internalForm.priority,
        requestType: 'InternalUnit',
        isProject: internalForm.isProject,
        dueDateUtc: toApiDateTime(internalForm.dueDateUtc),
        sourceType: 'InternalRequest',
      })
      setInternalForm(EMPTY_INTERNAL_FORM)
      navigate('/tasks')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleCreateExternal = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!externalForm.ownerDepartmentId) return
    if (externalForm.ownershipMode === 'users' && externalForm.ownerUserIds.length === 0) {
      setError(t('requests.create.ownerUsersRequired', 'Kullanıcı sahipliği için en az bir kullanıcı seçin.'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.createJob({
        title: externalForm.title.trim(),
        description: externalForm.description.trim(),
        ownerDepartmentId: externalForm.ownerDepartmentId,
        ownerUserIds: externalForm.ownershipMode === 'users' ? externalForm.ownerUserIds : [],
        priority: externalForm.priority,
        requestType: 'ExternalUnit',
        isProject: externalForm.isProject,
        startDateUtc: toApiDateTime(externalForm.startDateUtc),
        dueDateUtc: toApiDateTime(externalForm.dueDateUtc),
        sourceType: 'Manual',
      })
      setExternalForm(EMPTY_EXTERNAL_FORM)
      navigate('/jobs')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCitizen = async (event: React.FormEvent) => {
    event.preventDefault()

    setSaving(true)
    setError(null)
    try {
      await api.createSocialMessage({
        channel: citizenForm.channel,
        citizenHandle: citizenForm.citizenHandle.trim(),
        content: citizenForm.content.trim(),
        category: citizenForm.category.trim() || undefined,
      })
      setCitizenForm(EMPTY_CITIZEN_FORM)
      navigate('/social')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('requests.create.kicker', 'Talep Akışı')}</div>
            <h1 className="page-title">{t('nav.createRequest', 'Talep Oluştur')}</h1>
            <p className="page-subtitle">{t('requests.create.subtitle', 'Talebin türünü seçin ve ilgili form üzerinden yeni kayıt başlatın.')}</p>
          </div>
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      {!selectedKind ? (
        <section className={`grid gap-4 ${requestTypeOptions.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          <button
            type="button"
            className="section-card min-h-[190px] cursor-pointer text-left transition-colors hover:border-[color:var(--color-primary)]/40 hover:shadow-md"
            onClick={() => selectRequestKind('internal')}
          >
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="flex size-12 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
                <Building2 className="size-6" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950">{t('requests.create.internalTitle', 'Birim İçi')}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{t('requests.create.internalDescription', 'Kendi biriminizden başlayan kurum içi talep oluşturun.')}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="section-card min-h-[190px] cursor-pointer text-left transition-colors hover:border-[color:var(--color-primary)]/40 hover:shadow-md"
            onClick={() => selectRequestKind('external')}
          >
            <div className="flex h-full flex-col justify-between gap-6">
              <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Workflow className="size-6" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950">{t('requests.create.externalTitle', 'Birim Dışı')}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{t('requests.create.externalDescription', 'Başka bir müdürlüğe gidecek talep oluşturun.')}</p>
              </div>
            </div>
          </button>

          {canCreateCitizenRequest ? (
            <button
              type="button"
              className="section-card min-h-[190px] cursor-pointer text-left transition-colors hover:border-[color:var(--color-primary)]/40 hover:shadow-md"
              onClick={() => selectRequestKind('citizen')}
            >
              <div className="flex h-full flex-col justify-between gap-6">
                <div className="flex size-12 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <MessageSquareMore className="size-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-950">{t('requests.create.citizenTitle', 'Vatandaş Talepleri')}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{t('requests.create.citizenDescription', 'Vatandaştan gelen talebi manuel kayıt olarak oluşturun.')}</p>
                </div>
              </div>
            </button>
          ) : null}
        </section>
      ) : null}

      {selectedKind === 'internal' ? (
        <form className="section-card grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]" onSubmit={handleCreateInternal}>
          <div className="xl:col-span-2">
            <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.internalFormTitle', 'Birim İçi Talep Oluştur')}</h2>
            <p className="helper-copy">{t('tasks.newRequest.sectionDescription', 'Dahili iş akışı başlatmak için talep oluşturun.')}</p>
          </div>
          <div className="grid content-start gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              {renderRequestTypeField()}
              <div className="job-field">
                <span className="job-field-label">{t('jobs.form.ownerDepartment', 'Sahip Müdürlük')}</span>
                <input className="field-input bg-slate-50 font-semibold text-slate-700" value={myDepartmentName || '-'} readOnly />
              </div>
            </div>
            {renderOwnershipFields(
              internalForm.ownershipMode,
              internalForm.ownerUserIds,
              internalOwnerUserOptions,
              mode => setInternalForm(current => ({ ...current, ownershipMode: mode, ownerUserIds: mode === 'department' ? [] : current.ownerUserIds })),
              ownerUserIds => setInternalForm(current => ({ ...current, ownerUserIds })),
            )}
            <div className="job-field">
              <span className="job-field-label">{t('tasks.newRequest.title', 'Talep Başlığı')}</span>
              <input className="field-input" required value={internalForm.title} onChange={e => setInternalForm(current => ({ ...current, title: e.target.value }))} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="job-field">
                <span className="job-field-label">{t('tasks.newRequest.priority', 'Öncelik')}</span>
                <select className="field-select" value={internalForm.priority} onChange={e => setInternalForm(current => ({ ...current, priority: e.target.value }))}>
                  <option value="High">{t('jobs.priorities.High', 'Yüksek')}</option>
                  <option value="Normal">{t('jobs.priorities.Normal', 'Normal')}</option>
                </select>
              </div>
              <div className="job-field">
                <span className="job-field-label">{t('tasks.newRequest.dueDate', 'Bitiş Tarihi')}</span>
                <input type="datetime-local" className="field-input" value={internalForm.dueDateUtc} onClick={openDatePicker} onChange={e => setInternalForm(current => ({ ...current, dueDateUtc: e.target.value }))} />
              </div>
              <div className="job-field">
                <span className="job-field-label">{t('jobs.form.isProject', 'Proje niteliğinde mi?')}</span>
                <select className="field-select" value={internalForm.isProject ? 'yes' : 'no'} onChange={e => setInternalForm(current => ({ ...current, isProject: e.target.value === 'yes' }))}>
                  <option value="no">{t('common.no', 'Hayır')}</option>
                  <option value="yes">{t('common.yes', 'Evet')}</option>
                </select>
              </div>
            </div>
          </div>
          <div className="grid content-start gap-3">
            <label className="job-field">
              <span className="job-field-label">{t('tasks.newRequest.description', 'Açıklama')}</span>
              <textarea className="field-textarea min-h-56 xl:min-h-[18.5rem]" required value={internalForm.description} onChange={e => setInternalForm(current => ({ ...current, description: e.target.value }))} />
            </label>
            <Button type="submit" disabled={saving || loading} className="gap-2">
              <Send className="size-4" />
              {saving ? t('common.saving', 'Kaydediliyor...') : t('tasks.newRequest.submit', 'Talep Oluştur')}
            </Button>
          </div>
        </form>
      ) : null}

      {selectedKind === 'external' ? (
        <form className="section-card grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]" onSubmit={handleCreateExternal}>
          <div className="xl:col-span-2">
            <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.externalFormTitle', 'Birim Dışı Talep Oluştur')}</h2>
            <p className="helper-copy">{t('requests.create.externalFormDescription', 'Birim dışı talep kaydını başlatmak için temel bilgileri girin.')}</p>
          </div>
          <div className="grid content-start gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              {renderRequestTypeField()}
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-owner-dept">{t('jobs.form.ownerDepartment')} <span className="text-red-500">*</span></label>
                <select id="request-owner-dept" className="field-select" value={externalForm.ownerDepartmentId} onChange={e => setExternalForm(current => ({ ...current, ownerDepartmentId: e.target.value, ownerUserIds: [] }))} required>
                  <option value="">-</option>
                  {ownerDepartmentOptions.map(department => (
                    <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {renderOwnershipFields(
              externalForm.ownershipMode,
              externalForm.ownerUserIds,
              externalOwnerUserOptions,
              mode => setExternalForm(current => ({ ...current, ownershipMode: mode, ownerUserIds: mode === 'department' ? [] : current.ownerUserIds })),
              ownerUserIds => setExternalForm(current => ({ ...current, ownerUserIds })),
            )}
            <div className="job-field">
              <label className="job-field-label" htmlFor="request-title">{t('jobs.form.title')} <span className="text-red-500">*</span></label>
              <input id="request-title" className="field-input" type="text" value={externalForm.title} onChange={e => setExternalForm(current => ({ ...current, title: e.target.value }))} required />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-priority">{t('jobs.form.priority')}</label>
                <select id="request-priority" className="field-select" value={externalForm.priority} onChange={e => setExternalForm(current => ({ ...current, priority: e.target.value }))}>
                  <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
                  <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                </select>
              </div>
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-is-project">{t('jobs.form.isProject', 'Proje niteliğinde mi?')}</label>
                <select id="request-is-project" className="field-select" value={externalForm.isProject ? 'yes' : 'no'} onChange={e => setExternalForm(current => ({ ...current, isProject: e.target.value === 'yes' }))}>
                  <option value="no">{t('common.no', 'Hayır')}</option>
                  <option value="yes">{t('common.yes', 'Evet')}</option>
                </select>
              </div>
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-start-date">{t('jobs.form.startDate')}</label>
                <input id="request-start-date" className="field-input" type="datetime-local" value={externalForm.startDateUtc} onClick={openDatePicker} onChange={e => setExternalForm(current => ({ ...current, startDateUtc: e.target.value }))} />
              </div>
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-due-date">{t('jobs.form.dueDate')}</label>
                <input id="request-due-date" className="field-input" type="datetime-local" value={externalForm.dueDateUtc} onClick={openDatePicker} onChange={e => setExternalForm(current => ({ ...current, dueDateUtc: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="grid content-start gap-3">
            <label className="job-field">
              <span className="job-field-label">{t('jobs.form.description')} <span className="text-red-500">*</span></span>
              <textarea className="field-textarea min-h-56 xl:min-h-[20.8rem]" value={externalForm.description} onChange={e => setExternalForm(current => ({ ...current, description: e.target.value }))} required />
            </label>
            <Button type="submit" disabled={saving || loading} className="gap-2">
              <Send className="size-4" />
              {saving ? t('common.saving', 'Kaydediliyor...') : t('tasks.newRequest.submit', 'Talep Oluştur')}
            </Button>
          </div>
        </form>
      ) : null}

      {selectedKind === 'citizen' ? (
        <form className="section-card grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]" onSubmit={handleCreateCitizen}>
          <div className="xl:col-span-2">
            <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.citizenFormTitle', 'Vatandaş Talebi Oluştur')}</h2>
            <p className="helper-copy">{t('settings.citizen.sectionDescription', 'Sosyal medya entegrasyonu dışından gelen talepler için manuel kayıt oluşturun.')}</p>
          </div>
          <div className="grid content-start gap-3">
            {renderRequestTypeField()}
            <label className="job-field">
              <span className="job-field-label">{t('settings.citizen.channel', 'Kanal')}</span>
              <select className="field-select" value={citizenForm.channel} onChange={event => setCitizenForm(current => ({ ...current, channel: event.target.value }))}>
                {CITIZEN_CHANNELS.map(channel => (
                  <option key={channel} value={channel}>{t(`settings.citizen.channels.${channel}`, channel)}</option>
                ))}
              </select>
            </label>
            <label className="job-field">
              <span className="job-field-label">{t('settings.citizen.citizenHandle', 'Vatandaş / Gönderen')}</span>
              <input
                className="field-input"
                required
                placeholder={t('settings.citizen.citizenHandlePlaceholder', 'ör. @kullaniciad veya tam ad')}
                value={citizenForm.citizenHandle}
                onChange={event => setCitizenForm(current => ({ ...current, citizenHandle: event.target.value }))}
              />
            </label>
            <label className="job-field">
              <span className="job-field-label">{t('settings.citizen.category', 'Kategori')}</span>
              <input
                className="field-input"
                placeholder={t('settings.citizen.categoryPlaceholder', 'ör. Altyapı, Çevre')}
                value={citizenForm.category}
                onChange={event => setCitizenForm(current => ({ ...current, category: event.target.value }))}
              />
            </label>
          </div>
          <div className="grid content-start gap-3">
            <label className="job-field">
              <span className="job-field-label">{t('settings.citizen.content', 'Talep İçeriği')}</span>
              <textarea
                className="field-textarea min-h-56 xl:min-h-[17rem]"
                required
                placeholder={t('settings.citizen.contentPlaceholder', 'Vatandaş talebinin içeriğini girin...')}
                value={citizenForm.content}
                onChange={event => setCitizenForm(current => ({ ...current, content: event.target.value }))}
              />
            </label>
            <Button type="submit" disabled={saving || loading} className="gap-2">
              <Send className="size-4" />
              {saving ? t('common.saving', 'Kaydediliyor...') : t('tasks.newRequest.submit', 'Talep Oluştur')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
