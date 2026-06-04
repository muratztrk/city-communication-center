import { Building2, MapPin, MessageSquareMore, Paperclip, Send, Workflow, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { getActiveDepartmentId } from '../api/http'
import { Button } from '../components/ui/button'
import { ChannelIcon } from '../components/ui/channel-icon'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { MultiSelectDropdown } from '../components/ui/multi-select-dropdown'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { useAuth } from '../context/AuthContext'
import type { Department, User } from '../types/platform'

type RequestKind = 'internal' | 'external' | 'citizen'

interface InternalFormState {
  title: string
  description: string
  priority: string
  dueDateUtc: string
  isProject: boolean
  ownerDepartmentId: string
  /** Her string bir görev-atama satırı; boş string = havuz görevi */
  ownerUserIds: string[]
}

interface ExternalFormState extends InternalFormState {
  ownerDepartmentId: string
  targetDepartmentId: string
  isCoordinated: boolean
  coordinatedDepartmentIds: string[]
  startDateUtc: string
}

interface CitizenFormState {
  channel: string
  citizenHandle: string
  content: string
  category: string
  latitude: string
  longitude: string
}

const EMPTY_INTERNAL_FORM: InternalFormState = {
  title: '',
  description: '',
  priority: 'Normal',
  dueDateUtc: '',
  isProject: false,
  ownerDepartmentId: '',
  ownerUserIds: [''],
}

const EMPTY_EXTERNAL_FORM: ExternalFormState = {
  ...EMPTY_INTERNAL_FORM,
  ownerDepartmentId: '',
  targetDepartmentId: '',
  isCoordinated: false,
  coordinatedDepartmentIds: [],
  startDateUtc: '',
}

const EMPTY_CITIZEN_FORM: CitizenFormState = {
  channel: 'Other',
  citizenHandle: '',
  content: '',
  category: '',
  latitude: '',
  longitude: '',
}

const CITIZEN_CHANNELS = ['Facebook', 'Instagram', 'X', 'Email', 'WebForm', 'WhatsApp', 'Other']

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE = 5 * 1024 * 1024

function validateFile(file: File): string | null {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_TYPES.includes(file.type)) {
    return 'Sadece JPG, PNG, GIF ve WebP dosyaları yüklenebilir.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Dosya boyutu 5 MB\'ı aşamaz.'
  }
  return null
}

function isRequestKind(value: string | null): value is RequestKind {
  return value === 'internal' || value === 'external' || value === 'citizen'
}

function toApiDateTime(value: string) {
  return value ? new Date(value).toISOString() : null
}

function toApiDateTimeWithSla(value: string, slaHours: number): string | null {
  if (value) return new Date(value).toISOString()
  if (slaHours > 0) return new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString()
  return null
}

function hasRichTextContent(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
    .length > 0
}


export function CreateRequestPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const rawKindParam = searchParams.get('kind')
  const kindParam = isRequestKind(rawKindParam) ? rawKindParam : null
  const selectedKind = kindParam
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [activeDepartmentId, setActiveDepartmentId] = useState<string | null>(getActiveDepartmentId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [internalForm, setInternalForm] = useState<InternalFormState>(EMPTY_INTERNAL_FORM)
  const [externalForm, setExternalForm] = useState<ExternalFormState>(EMPTY_EXTERNAL_FORM)
  const [citizenForm, setCitizenForm] = useState<CitizenFormState>(EMPTY_CITIZEN_FORM)
  const [defaultSlaHours, setDefaultSlaHours] = useState(0)
  const canCreateCitizenRequest = user?.role === 'Operator'

  const myDepartmentId = useMemo(() => {
    return activeDepartmentId || user?.departmentId || users.find(item => item.userId === user?.userId)?.departmentId || ''
  }, [activeDepartmentId, user?.departmentId, user?.userId, users])

  const ownerDepartmentOptions = useMemo(() => {
    if (user?.role === 'Staff' && myDepartmentId) {
      return departments.filter(department => department.departmentId === myDepartmentId)
    }
    if (user?.role === 'Manager') {
      const managed = departments.filter(department => department.managerUserId === user.userId)
      return managed.length > 0 ? managed : departments
    }
    return departments
  }, [departments, myDepartmentId, user?.role, user?.userId])

  const targetDepartmentOptions = useMemo(() => {
    return departments.filter(department => department.departmentId !== externalForm.ownerDepartmentId)
  }, [departments, externalForm.ownerDepartmentId])

  const coordinatedDepartmentOptions = useMemo(() => {
    return departments.filter(department =>
      department.departmentId !== externalForm.ownerDepartmentId &&
      department.departmentId !== externalForm.targetDepartmentId
    )
  }, [departments, externalForm.ownerDepartmentId, externalForm.targetDepartmentId])


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
    setError(null)
    navigate(`/requests/new?kind=${kind}`)
  }

  const getRequestTypeLabel = (kind: RequestKind | null) => {
    return requestTypeOptions.find(option => option.value === kind)?.label ?? ''
  }

  useEffect(() => {
    const handler = () => setActiveDepartmentId(getActiveDepartmentId())
    window.addEventListener('activeDepartmentChanged', handler)
    return () => window.removeEventListener('activeDepartmentChanged', handler)
  }, [])

  useEffect(() => {
    if (!user?.tenantId) return
    api.getTenantSettings(user.tenantId)
      .then(settings => setDefaultSlaHours(settings.defaultSlaHours ?? 0))
      .catch(() => {})
  }, [user?.tenantId])

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
    if (!selectedKind) return
    const firstDepartmentId = myDepartmentId || ownerDepartmentOptions[0]?.departmentId
    if (firstDepartmentId && externalForm.ownerDepartmentId !== firstDepartmentId) {
      setExternalForm(current => ({ ...current, ownerDepartmentId: firstDepartmentId }))
    }
  }, [externalForm.ownerDepartmentId, myDepartmentId, ownerDepartmentOptions, selectedKind])

  useEffect(() => {
    if (selectedKind !== 'internal') return
    const defaultDeptId = ownerDepartmentOptions[0]?.departmentId || myDepartmentId
    if (defaultDeptId && !internalForm.ownerDepartmentId) {
      setInternalForm(current => ({ ...current, ownerDepartmentId: defaultDeptId }))
    }
  }, [selectedKind, internalForm.ownerDepartmentId, ownerDepartmentOptions, myDepartmentId])

  useEffect(() => {
    if ((rawKindParam && !kindParam) || (kindParam === 'citizen' && !canCreateCitizenRequest)) {
      navigate('/requests/new', { replace: true })
    }
  }, [canCreateCitizenRequest, kindParam, navigate, rawKindParam])


  const renderRequestTypeField = () => (
    <div className="job-field">
      <label className="job-field-label" htmlFor="request-kind">{t('requests.create.typeLabel', 'Talep Tipi')}</label>
      <input id="request-kind" className="field-input bg-slate-50 font-semibold text-slate-700" value={getRequestTypeLabel(selectedKind)} readOnly />
    </div>
  )

  const renderPhotoUpload = () => (
    <div className="job-field">
      <span className="job-field-label">{t('attachments.label', 'Fotoğraf Ekle (opsiyonel)')}</span>
      <div
        role="button"
        tabIndex={saving ? -1 : 0}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-5 text-center text-sm transition-colors ${saving ? 'pointer-events-none opacity-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
        onClick={() => !saving && fileInputRef.current?.click()}
        onKeyDown={event => event.key === 'Enter' && !saving && fileInputRef.current?.click()}
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault()
          if (saving) return
          setFileError(null)
          for (const file of Array.from(event.dataTransfer.files)) {
            const err = validateFile(file)
            if (err) { setFileError(err); return }
            setPendingFiles(prev => [...prev, file])
          }
        }}
      >
        <Paperclip className="mb-1 size-4 text-slate-400" />
        <span className="font-semibold text-slate-700">{t('attachments.dragHint', 'Dosyayı buraya sürükleyin veya tıklayın')}</span>
        <span className="mt-0.5 text-xs text-slate-400">{t('attachments.uploadHint', 'JPG, PNG, GIF, WebP — maks. 5 MB')}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp"
          multiple
          className="hidden"
          disabled={saving}
          onChange={event => {
            setFileError(null)
            for (const file of Array.from(event.target.files ?? [])) {
              const err = validateFile(file)
              if (err) { setFileError(err); return }
              setPendingFiles(prev => [...prev, file])
            }
            if (fileInputRef.current) fileInputRef.current.value = ''
          }}
        />
      </div>
      {fileError && <div className="mt-1 text-xs text-red-500">{fileError}</div>}
      {pendingFiles.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {pendingFiles.map((file, idx) => (
            <div key={idx} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <img src={URL.createObjectURL(file)} alt={file.name} className="h-20 w-full object-cover" />
              <button
                type="button"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-red-500 opacity-0 shadow transition-opacity group-hover:opacity-100 hover:bg-white"
                onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const handleCreateInternal = async (event: React.FormEvent) => {
    event.preventDefault()
    const effectiveOwnerDeptId = internalForm.ownerDepartmentId || myDepartmentId
    if (!effectiveOwnerDeptId) {
      setError(t('tasks.newRequest.noDepartment', 'Departman bilgisi bulunamadı.'))
      return
    }
    if (!hasRichTextContent(internalForm.description)) {
      setError(t('tasks.newRequest.descriptionRequired', 'Açıklama gereklidir.'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      const selectedOwnerUserIds = internalForm.ownerUserIds.filter(id => id.trim() !== '')
      const job = await api.createJob({
        title: internalForm.title.trim(),
        description: internalForm.description.trim(),
        ownerDepartmentId: effectiveOwnerDeptId,
        ownerUserIds: selectedOwnerUserIds,
        priority: internalForm.priority,
        requestType: 'InternalUnit',
        isProject: internalForm.isProject,
        dueDateUtc: toApiDateTimeWithSla(internalForm.dueDateUtc, defaultSlaHours),
        sourceType: 'InternalRequest',
      })
      for (const file of pendingFiles) {
        await api.uploadJobAttachment(job.jobId, file)
      }
      setInternalForm(EMPTY_INTERNAL_FORM)
      setPendingFiles([])
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
    if (!externalForm.targetDepartmentId) {
      setError(t('requests.create.targetDepartmentRequired', 'Talebin gideceği birim seçilmelidir.'))
      return
    }
    if (!hasRichTextContent(externalForm.description)) {
      setError(t('tasks.newRequest.descriptionRequired', 'Açıklama gereklidir.'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      const targetDepartmentIds = [
        externalForm.targetDepartmentId,
        ...(externalForm.isCoordinated ? externalForm.coordinatedDepartmentIds : []),
      ]
      const job = await api.createJob({
        title: externalForm.title.trim(),
        description: externalForm.description.trim(),
        ownerDepartmentId: externalForm.ownerDepartmentId,
        ownerUserIds: [],
        priority: externalForm.priority,
        requestType: 'ExternalUnit',
        isProject: externalForm.isProject,
        startDateUtc: toApiDateTime(externalForm.startDateUtc),
        dueDateUtc: toApiDateTimeWithSla(externalForm.dueDateUtc, defaultSlaHours),
        targetDepartmentIds,
        sourceType: 'Manual',
      })
      for (const file of pendingFiles) {
        await api.uploadJobAttachment(job.jobId, file)
      }
      setExternalForm(EMPTY_EXTERNAL_FORM)
      setPendingFiles([])
      navigate('/jobs')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCitizen = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!hasRichTextContent(citizenForm.content)) {
      setError(t('settings.citizen.contentRequired', 'Talep içeriği gereklidir.'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.createSocialMessage({
        channel: citizenForm.channel,
        citizenHandle: citizenForm.citizenHandle.trim(),
        content: citizenForm.content.trim(),
        category: citizenForm.category.trim() || undefined,
        latitude: citizenForm.latitude ? parseFloat(citizenForm.latitude) : undefined,
        longitude: citizenForm.longitude ? parseFloat(citizenForm.longitude) : undefined,
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
            className="section-card cursor-pointer text-left transition-colors hover:border-[color:var(--color-primary)]/40 hover:shadow-md"
            onClick={() => selectRequestKind('internal')}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
                <Building2 className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">{t('requests.create.internalTitle', 'Birim İçi')}</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">{t('requests.create.internalDescription', 'Kendi biriminizden başlayan kurum içi talep oluşturun.')}</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            className="section-card cursor-pointer text-left transition-colors hover:border-[color:var(--color-primary)]/40 hover:shadow-md"
            onClick={() => selectRequestKind('external')}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Workflow className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold text-slate-950">{t('requests.create.externalTitle', 'Birim Dışı')}</h2>
                <p className="mt-1 text-sm leading-5 text-slate-600">{t('requests.create.externalDescription', 'Başka bir müdürlüğe gidecek talep oluşturun.')}</p>
              </div>
            </div>
          </button>

          {canCreateCitizenRequest ? (
            <button
              type="button"
              className="section-card cursor-pointer text-left transition-colors hover:border-[color:var(--color-primary)]/40 hover:shadow-md"
              onClick={() => selectRequestKind('citizen')}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                  <MessageSquareMore className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-950">{t('requests.create.citizenTitle', 'Vatandaş Talepleri')}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{t('requests.create.citizenDescription', 'Vatandaştan gelen talebi manuel kayıt olarak oluşturun.')}</p>
                </div>
              </div>
            </button>
          ) : null}
        </section>
      ) : null}

      {selectedKind === 'internal' ? (
        <form className="section-card grid gap-4 xl:grid-cols-2" onSubmit={handleCreateInternal}>
          <div className="xl:col-span-2">
            <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.internalFormTitle', 'Birim İçi Talep Oluştur')}</h2>
            <p className="helper-copy">{t('tasks.newRequest.sectionDescription', 'Dahili iş akışı başlatmak için talep oluşturun.')}</p>
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field">
              <span className="job-field-label">{t('tasks.newRequest.title', 'Talep Başlığı')}</span>
              <input className="field-input" required value={internalForm.title} onChange={e => setInternalForm(current => ({ ...current, title: e.target.value }))} />
            </div>
            {renderRequestTypeField()}
            <div className="grid gap-3 md:grid-cols-3">
              <div className="job-field">
                <span className="job-field-label">{t('tasks.newRequest.priority', 'Öncelik')}</span>
                <select className="field-select" value={internalForm.priority} onChange={e => setInternalForm(current => ({ ...current, priority: e.target.value }))}>
                  <option value="VeryHigh">{t('enum.priority.VeryHigh', 'Çok Yüksek')}</option>
                  <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                  <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
                </select>
              </div>
              <div className="job-field">
                <span className="job-field-label">{t('tasks.newRequest.dueDate', 'Bitiş Tarihi (opsiyonel)')}</span>
                <DateTimePicker value={internalForm.dueDateUtc} onChange={v => setInternalForm(current => ({ ...current, dueDateUtc: v }))} placeholder={t('tasks.newRequest.dueDate', 'Bitiş Tarihi (opsiyonel)')} />
              </div>
              <div className="job-field">
                <span className="job-field-label">{t('jobs.form.isProject', 'Proje niteliğinde mi?')}</span>
                <select className="field-select" value={internalForm.isProject ? 'yes' : 'no'} onChange={e => setInternalForm(current => ({ ...current, isProject: e.target.value === 'yes' }))}>
                  <option value="no">{t('common.no', 'Hayır')}</option>
                  <option value="yes">{t('common.yes', 'Evet')}</option>
                </select>
              </div>
            </div>
            <div className="job-field">
              <span className="job-field-label">{t('tasks.newRequest.ownerUser', 'Görev Sahibi Kişi/Birim')}</span>
              <select
                className="field-select"
                value={internalForm.ownerUserIds[0] ?? ''}
                onChange={e => setInternalForm(current => ({ ...current, ownerUserIds: e.target.value ? [e.target.value] : [''] }))}
              >
                <option value="">{t('tasks.newRequest.departmentPool', 'Birim Havuzu')}</option>
                {user && <option value={user.userId}>{user.displayName}</option>}
              </select>
            </div>
            {renderPhotoUpload()}
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field min-h-0">
              <span className="job-field-label">{t('tasks.newRequest.description', 'Açıklama')}</span>
              <RichTextEditor
                value={internalForm.description}
                onChange={description => setInternalForm(current => ({ ...current, description }))}
                required
                minHeight="min-h-64"
              />
            </div>
            <Button type="submit" disabled={saving || loading} className="gap-2">
              <Send className="size-4" />
              {saving ? t('common.saving', 'Kaydediliyor...') : t('tasks.newRequest.submit', 'Talep Oluştur')}
            </Button>
          </div>
        </form>
      ) : null}

      {selectedKind === 'external' ? (
        <form className="section-card grid gap-4 xl:grid-cols-2" onSubmit={handleCreateExternal}>
          <div className="xl:col-span-2">
            <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.externalFormTitle', 'Birim Dışı Talep Oluştur')}</h2>
            <p className="helper-copy">{t('requests.create.externalFormDescription', 'Birim dışı talep kaydını başlatmak için temel bilgileri girin.')}</p>
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field">
              <label className="job-field-label" htmlFor="request-title">{t('jobs.form.title')} <span className="text-red-500">*</span></label>
              <input id="request-title" className="field-input" type="text" value={externalForm.title} onChange={e => setExternalForm(current => ({ ...current, title: e.target.value }))} required />
            </div>
            {renderRequestTypeField()}
            <div className="job-field">
              <label className="job-field-label" htmlFor="request-target-dept">{t('jobs.form.targetDepartment', 'Talebin Gideceği Birim')} <span className="text-red-500">*</span></label>
              <select
                id="request-target-dept"
                className="field-select"
                value={externalForm.targetDepartmentId}
                onChange={e => setExternalForm(current => ({ ...current, targetDepartmentId: e.target.value }))}
                required
              >
                <option value="">{t('requests.create.targetDepartmentsPlaceholder', 'Birim/Müdürlük seçin')}</option>
                {targetDepartmentOptions.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="job-field">
              <label className="job-field-label" htmlFor="request-is-coordinated">{t('jobs.form.isCoordinated', 'Koordineli talep mi?')}</label>
              <select
                id="request-is-coordinated"
                className="field-select"
                value={externalForm.isCoordinated ? 'yes' : 'no'}
                onChange={e => setExternalForm(current => ({
                  ...current,
                  isCoordinated: e.target.value === 'yes',
                  coordinatedDepartmentIds: e.target.value === 'yes' ? current.coordinatedDepartmentIds : [],
                }))}
              >
                <option value="no">{t('common.no', 'Hayır')}</option>
                <option value="yes">{t('common.yes', 'Evet')}</option>
              </select>
            </div>
            {externalForm.isCoordinated ? (
              <div className="job-field">
                <span className="job-field-label">{t('jobs.form.coordinatedDepartments', 'Koordineli Birimler')}</span>
                <MultiSelectDropdown
                  options={coordinatedDepartmentOptions.map(d => ({ value: d.departmentId, label: d.name }))}
                  value={externalForm.coordinatedDepartmentIds}
                  onChange={coordinatedDepartmentIds => setExternalForm(current => ({ ...current, coordinatedDepartmentIds }))}
                  placeholder={t('requests.create.coordinatedDepartmentsPlaceholder', 'Birim/Müdürlük seçin')}
                  emptyText={t('requests.create.coordinatedDepartmentsEmpty', 'Seçilebilir birim bulunmuyor.')}
                />
                <span className="helper-copy">{t('jobs.form.coordinatedDepartmentsHelp', 'Koordineli olarak dahil edilecek ek birimler.')}</span>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-priority">{t('jobs.form.priority')}</label>
                <select id="request-priority" className="field-select" value={externalForm.priority} onChange={e => setExternalForm(current => ({ ...current, priority: e.target.value }))}>
                  <option value="VeryHigh">{t('enum.priority.VeryHigh', 'Çok Yüksek')}</option>
                  <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                  <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
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
                <DateTimePicker id="request-start-date" value={externalForm.startDateUtc} onChange={v => setExternalForm(current => ({ ...current, startDateUtc: v }))} />
              </div>
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-due-date">{t('jobs.form.dueDate')}</label>
                <DateTimePicker id="request-due-date" value={externalForm.dueDateUtc} onChange={v => setExternalForm(current => ({ ...current, dueDateUtc: v }))} />
              </div>
            </div>
            {renderPhotoUpload()}
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field min-h-0">
              <span className="job-field-label">{t('jobs.form.description')} <span className="text-red-500">*</span></span>
              <RichTextEditor
                value={externalForm.description}
                onChange={description => setExternalForm(current => ({ ...current, description }))}
                required
                minHeight="min-h-64"
              />
            </div>
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
            <div className="job-field">
              <span className="job-field-label">{t('settings.citizen.channel', 'Kanal')}</span>
              <div className="grid grid-cols-4 gap-2">
                {CITIZEN_CHANNELS.map(channel => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => setCitizenForm(current => ({ ...current, channel }))}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-colors ${
                      citizenForm.channel === channel
                        ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/8 text-[color:var(--color-primary)]'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <ChannelIcon channel={channel} className="size-5 shrink-0" />
                    <span className="truncate w-full text-center leading-tight">{t(`settings.citizen.channels.${channel}`, channel)}</span>
                  </button>
                ))}
              </div>
            </div>
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
            <div className="job-field">
              <span className="job-field-label">{t('location.label', 'Konum (İsteğe Bağlı)')}</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  className="field-input flex-1"
                  placeholder={t('location.latPlaceholder', 'Enlem (ör. 41.0082)')}
                  value={citizenForm.latitude}
                  onChange={e => setCitizenForm(c => ({ ...c, latitude: e.target.value }))}
                />
                <input
                  type="number"
                  step="any"
                  className="field-input flex-1"
                  placeholder={t('location.lngPlaceholder', 'Boylam (ör. 28.9784)')}
                  value={citizenForm.longitude}
                  onChange={e => setCitizenForm(c => ({ ...c, longitude: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!navigator.geolocation) return
                    navigator.geolocation.getCurrentPosition(pos => {
                      setCitizenForm(c => ({
                        ...c,
                        latitude: pos.coords.latitude.toFixed(6),
                        longitude: pos.coords.longitude.toFixed(6),
                      }))
                    })
                  }}
                  title={t('location.useCurrentTitle', 'Mevcut konumu kullan')}
                >
                  <MapPin className="size-4" />
                </Button>
              </div>
              {citizenForm.latitude && citizenForm.longitude && (
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${(parseFloat(citizenForm.longitude) - 0.005).toFixed(6)},${(parseFloat(citizenForm.latitude) - 0.005).toFixed(6)},${(parseFloat(citizenForm.longitude) + 0.005).toFixed(6)},${(parseFloat(citizenForm.latitude) + 0.005).toFixed(6)}&layer=mapnik&marker=${citizenForm.latitude},${citizenForm.longitude}`}
                  className="mt-2 h-52 w-full rounded-xl border border-slate-200"
                  title={t('location.mapPreview', 'Konum Önizleme')}
                />
              )}
            </div>
          </div>
          <div className="grid content-start gap-3">
            <label className="job-field">
              <span className="job-field-label">{t('settings.citizen.content', 'Talep İçeriği')}</span>
              <RichTextEditor
                value={citizenForm.content}
                onChange={content => setCitizenForm(current => ({ ...current, content }))}
                required
                placeholder={t('settings.citizen.contentPlaceholder', 'Vatandaş talebinin içeriğini girin...')}
                minHeight="min-h-48"
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
