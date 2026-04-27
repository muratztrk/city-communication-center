import { ArrowLeft, Building2, MessageSquareMore, Send, Workflow } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { useAuth } from '../context/AuthContext'
import type { Department, User } from '../types/platform'

type RequestKind = 'internal' | 'external' | 'citizen'

interface InternalFormState {
  title: string
  description: string
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

  const requestTypeOptions = useMemo(() => [
    { value: 'internal' as const, label: t('requests.create.internalPluralTitle', 'Birim İçi Talepler') },
    { value: 'external' as const, label: t('requests.create.externalPluralTitle', 'Birim Dışı Talepler') },
    { value: 'citizen' as const, label: t('requests.create.citizenTitle', 'Vatandaş Talepleri') },
  ], [t])

  const selectRequestKind = (kind: RequestKind) => {
    setSelectedKind(kind)
    setError(null)
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

  const resetSelection = () => {
    setSelectedKind(null)
    setError(null)
  }

  const renderRequestTypeField = () => (
    <div className="job-field">
      <label className="job-field-label" htmlFor="request-kind">{t('requests.create.typeLabel', 'Talep Tipi')}</label>
      <select
        id="request-kind"
        className="field-select"
        value={selectedKind ?? ''}
        onChange={event => selectRequestKind(event.target.value as RequestKind)}
        required
      >
        {requestTypeOptions.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  )

  const handleCreateInternal = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!myDepartmentId) {
      setError(t('tasks.newRequest.noDepartment', 'Departman bilgisi bulunamadı.'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.createJob({
        title: internalForm.title.trim(),
        description: internalForm.description.trim(),
        ownerDepartmentId: myDepartmentId,
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

    setSaving(true)
    setError(null)
    try {
      await api.createJob({
        title: externalForm.title.trim(),
        description: externalForm.description.trim(),
        ownerDepartmentId: externalForm.ownerDepartmentId,
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
          {selectedKind ? (
            <Button type="button" variant="secondary" onClick={resetSelection} className="gap-2">
              <ArrowLeft className="size-4" />
              {t('requests.create.changeType', 'Tür Değiştir')}
            </Button>
          ) : null}
        </div>
      </header>

      {error ? <div className="error">{error}</div> : null}

      {!selectedKind ? (
        <section className="grid gap-4 lg:grid-cols-3">
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
        </section>
      ) : null}

      {selectedKind === 'internal' ? (
        <form className="section-card page-stack" onSubmit={handleCreateInternal}>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.internalFormTitle', 'Birim İçi Talep Oluştur')}</h2>
            <p className="helper-copy">{t('tasks.newRequest.sectionDescription', 'Dahili iş akışı başlatmak için talep oluşturun.')}</p>
          </div>
          {renderRequestTypeField()}
          <div className="job-field">
            <span className="job-field-label">{t('jobs.form.ownerDepartment', 'Sahip Müdürlük')}</span>
            <input className="field-input" value={myDepartmentName || '-'} readOnly />
          </div>
          <div className="job-field">
            <span className="job-field-label">{t('tasks.newRequest.title', 'Talep Başlığı')}</span>
            <input className="field-input" required value={internalForm.title} onChange={e => setInternalForm(current => ({ ...current, title: e.target.value }))} />
          </div>
          <div className="job-field">
            <span className="job-field-label">{t('tasks.newRequest.description', 'Açıklama')}</span>
            <textarea className="field-textarea" required rows={4} value={internalForm.description} onChange={e => setInternalForm(current => ({ ...current, description: e.target.value }))} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="job-field">
              <span className="job-field-label">{t('tasks.newRequest.priority', 'Öncelik')}</span>
              <select className="field-select" value={internalForm.priority} onChange={e => setInternalForm(current => ({ ...current, priority: e.target.value }))}>
                <option value="High">{t('jobs.priorities.High', 'Yüksek')}</option>
                <option value="Normal">{t('jobs.priorities.Normal', 'Normal')}</option>
              </select>
            </div>
            <div className="job-field">
              <span className="job-field-label">{t('tasks.newRequest.dueDate', 'Bitiş Tarihi (isteğe bağlı)')}</span>
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
          <div className="inline-actions">
            <Button type="submit" disabled={saving || loading} className="gap-2">
              <Send className="size-4" />
              {saving ? t('common.saving', 'Kaydediliyor...') : t('tasks.newRequest.submit', 'Talep Oluştur')}
            </Button>
          </div>
        </form>
      ) : null}

      {selectedKind === 'external' ? (
        <form className="section-card page-stack" onSubmit={handleCreateExternal}>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.externalFormTitle', 'Birim Dışı Talep Oluştur')}</h2>
            <p className="helper-copy">{t('requests.create.externalFormDescription', 'Birim dışı talep kaydını başlatmak için temel bilgileri girin.')}</p>
          </div>
          {renderRequestTypeField()}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="job-field sm:col-span-2">
              <label className="job-field-label" htmlFor="request-title">{t('jobs.form.title')} <span className="text-red-500">*</span></label>
              <input id="request-title" className="field-input" type="text" value={externalForm.title} onChange={e => setExternalForm(current => ({ ...current, title: e.target.value }))} required />
            </div>
            <div className="job-field sm:col-span-2">
              <label className="job-field-label" htmlFor="request-description">{t('jobs.form.description')} <span className="text-red-500">*</span></label>
              <textarea id="request-description" className="field-textarea" rows={3} value={externalForm.description} onChange={e => setExternalForm(current => ({ ...current, description: e.target.value }))} required />
            </div>
            <div className="job-field">
              <label className="job-field-label" htmlFor="request-owner-dept">{t('jobs.form.ownerDepartment')} <span className="text-red-500">*</span></label>
              <select id="request-owner-dept" className="field-select" value={externalForm.ownerDepartmentId} onChange={e => setExternalForm(current => ({ ...current, ownerDepartmentId: e.target.value }))} required>
                <option value="">-</option>
                {ownerDepartmentOptions.map(department => (
                  <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                ))}
              </select>
            </div>
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
          <div className="inline-actions">
            <Button type="submit" disabled={saving || loading} className="gap-2">
              <Send className="size-4" />
              {saving ? t('common.saving', 'Kaydediliyor...') : t('tasks.newRequest.submit', 'Talep Oluştur')}
            </Button>
          </div>
        </form>
      ) : null}

      {selectedKind === 'citizen' ? (
        <form className="section-card page-stack" onSubmit={handleCreateCitizen}>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.citizenFormTitle', 'Vatandaş Talebi Oluştur')}</h2>
            <p className="helper-copy">{t('settings.citizen.sectionDescription', 'Sosyal medya entegrasyonu dışından gelen talepler için manuel kayıt oluşturun.')}</p>
          </div>
          {renderRequestTypeField()}
          <div className="grid gap-5 sm:grid-cols-2">
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
            <label className="job-field sm:col-span-2">
              <span className="job-field-label">{t('settings.citizen.content', 'Talep İçeriği')}</span>
              <textarea
                className="field-textarea"
                required
                rows={4}
                placeholder={t('settings.citizen.contentPlaceholder', 'Vatandaş talebinin içeriğini girin...')}
                value={citizenForm.content}
                onChange={event => setCitizenForm(current => ({ ...current, content: event.target.value }))}
              />
            </label>
            <label className="job-field sm:col-span-2">
              <span className="job-field-label">{t('settings.citizen.category', 'Kategori (isteğe bağlı)')}</span>
              <input
                className="field-input"
                placeholder={t('settings.citizen.categoryPlaceholder', 'ör. Altyapı, Çevre')}
                value={citizenForm.category}
                onChange={event => setCitizenForm(current => ({ ...current, category: event.target.value }))}
              />
            </label>
          </div>
          <div className="inline-actions">
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
