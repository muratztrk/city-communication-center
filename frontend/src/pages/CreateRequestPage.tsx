import { Building2, MessageSquareMore, Paperclip, Send, Workflow } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateJobs, invalidateSocialMessages } from '../api/cacheInvalidation'
import { getActiveDepartmentId } from '../api/http'
import { Button } from '../components/ui/button'
import { ChannelIcon } from '../components/ui/channel-icon'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
import { useAuth } from '../context/AuthContext'
import { userWorksInDepartment } from '../utils/userDepartments'
import type { Department, User } from '../types/platform'
import { isPresidencyLevelDepartment } from '../utils/departments'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../data/izmir-locations'

type RequestKind = 'internal' | 'external' | 'citizen'

interface InternalFormState {
  title: string
  description: string
  priority: string
  dueDateUtc: string
  isProject: boolean
  ownerDepartmentId: string
  /** Tek görev sahibi; boş string = birim havuzu */
  ownerUserIds: string[]
  neighborhood: string
  street: string
  openAddress: string
}

interface ExternalFormState extends InternalFormState {
  ownerDepartmentId: string
  targetDepartmentId: string
  startDateUtc: string
}

interface CitizenFormState {
  channel: string
  citizenHandle: string
  citizenPhone: string
  content: string
  category: string
  latitude: string
  longitude: string
  title: string
  targetDepartmentId: string
  priority: string
  isProject: boolean
  startDateUtc: string
  dueDateUtc: string
  neighborhood: string
  street: string
  openAddress: string
}

const EMPTY_INTERNAL_FORM: InternalFormState = {
  title: '',
  description: '',
  priority: 'Normal',
  dueDateUtc: '',
  isProject: false,
  ownerDepartmentId: '',
  ownerUserIds: [''],
  neighborhood: '',
  street: '',
  openAddress: '',
}

const EMPTY_EXTERNAL_FORM: ExternalFormState = {
  ...EMPTY_INTERNAL_FORM,
  ownerDepartmentId: '',
  targetDepartmentId: '',
  startDateUtc: '',
}

const EMPTY_CITIZEN_FORM: CitizenFormState = {
  channel: 'WhatsApp',
  citizenHandle: '',
  citizenPhone: '',
  content: '',
  category: '',
  latitude: '',
  longitude: '',
  title: '',
  targetDepartmentId: '',
  priority: 'Normal',
  isProject: false,
  startDateUtc: '',
  dueDateUtc: '',
  neighborhood: '',
  street: '',
  openAddress: '',
}

const CITIZEN_CHANNELS = ['WhatsApp', 'Phone', 'Instagram', 'Facebook', 'X', 'Email', 'WebForm', 'EDevlet'] as const
const OWNER_TASK_NOTES_PREFIX = 'ccc:owner-task-request:v1:'

function getRequestedOwnerUserIds(
  departments: { role: string; notes?: string | null }[],
  tasks: { ownerUserId?: string | null; assignedUserId: string | null }[],
) {
  const ownerDepartmentNotes = departments.find(department => department.role === 'Owner')?.notes
  if (ownerDepartmentNotes?.startsWith(OWNER_TASK_NOTES_PREFIX)) {
    try {
      const parsed = JSON.parse(ownerDepartmentNotes.slice(OWNER_TASK_NOTES_PREFIX.length)) as { ownerUserIds?: string[] }
      const ownerUserIds = parsed.ownerUserIds?.filter(id => typeof id === 'string' && id.trim() !== '') ?? []
      if (ownerUserIds.length > 0) {
        return [...new Set(ownerUserIds)]
      }
    } catch {
      // Ignore malformed historical payloads and fall back to current task assignments.
    }
  }

  const fallbackUserIds = tasks
    .map(task => task.ownerUserId ?? task.assignedUserId)
    .filter((id): id is string => typeof id === 'string' && id.trim() !== '')

  return fallbackUserIds.length > 0 ? [...new Set(fallbackUserIds)] : ['']
}

// Resim (JPG/PNG), PDF ve Office uzantıları; gif/webp kaldırıldı (card 539).
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']
const ACCEPT_ATTR = ALLOWED_EXTENSIONS.join(',')
const MAX_FILE_SIZE = 5 * 1024 * 1024

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function validateFile(file: File): string | null {
  if (!ALLOWED_EXTENSIONS.includes(fileExtension(file.name))) {
    return 'Yalnızca resim (JPG, PNG), PDF ve Office dosyaları yüklenebilir.'
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

function hasRichTextContent(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
    .length > 0
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function toRichTextContent(value: string): string {
  if (!value.trim()) return ''
  return value.includes('<') ? value : `<p>${escapeHtml(value)}</p>`
}

function navigateAfterCitizenRequest(
  navigate: ReturnType<typeof useNavigate>,
  returnTo: string | null,
) {
  if (returnTo === 'whatsapp') {
    navigate('/whatsapp')
    return
  }
  if (returnTo === 'social') {
    navigate('/social')
    return
  }
  navigate('/requests/new?kind=citizen')
}


export function CreateRequestPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const rawKindParam = searchParams.get('kind')
  const kindParam = isRequestKind(rawKindParam) ? rawKindParam : null
  const selectedKind = kindParam
  // Onay öncesi bir talebi "verileri dolu" düzenleme modu (card 452).
  const editJobId = searchParams.get('editJobId')
  const socialMessageIdParam = searchParams.get('socialMessageId')
  const returnToParam = searchParams.get('returnTo')
  const [editPrefilled, setEditPrefilled] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [confirmedKind, setConfirmedKind] = useState<RequestKind | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [activeDepartmentId, setActiveDepartmentId] = useState<string | null>(getActiveDepartmentId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [internalForm, setInternalForm] = useState<InternalFormState>(EMPTY_INTERNAL_FORM)
  const [externalForm, setExternalForm] = useState<ExternalFormState>(EMPTY_EXTERNAL_FORM)
  const [citizenForm, setCitizenForm] = useState<CitizenFormState>(EMPTY_CITIZEN_FORM)
  const canCreateCitizenRequest = user?.role === 'Operator'
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(getSavedDistrictId()), [])

  const myDepartmentId = useMemo(() => {
    const me = users.find(item => item.userId === user?.userId)
    const homeDepartmentId = user?.departmentId || me?.departmentId || ''
    // Bayat/geçersiz aktif birim koruması: localStorage'daki aktif birim, kullanıcının gerçekten
    // ait olduğu (ana + ek birimler) ya da yönettiği bir birim değilse owner kabul etme; ana birime
    // düş. Aksi halde form, başka bir birim adına talep açar ve o birim hedef listesinden düşer.
    const accessibleDepartmentIds = new Set<string>()
    if (homeDepartmentId) accessibleDepartmentIds.add(homeDepartmentId)
    me?.departments?.forEach(department => accessibleDepartmentIds.add(department.departmentId))
    departments
      .filter(department => department.managerUserId === user?.userId)
      .forEach(department => accessibleDepartmentIds.add(department.departmentId))
    if (activeDepartmentId && accessibleDepartmentIds.has(activeDepartmentId)) {
      return activeDepartmentId
    }
    return homeDepartmentId
  }, [activeDepartmentId, user?.departmentId, user?.userId, users, departments])

  const ownerDepartmentOptions = useMemo(() => {
    if ((user?.role === 'Staff' || user?.role === 'Operator') && myDepartmentId) {
      return departments.filter(department => department.departmentId === myDepartmentId)
    }
    if (user?.role === 'Manager') {
      const managed = departments.filter(department => department.managerUserId === user.userId)
      return managed.length > 0 ? managed : departments
    }
    return departments
  }, [departments, myDepartmentId, user?.role, user?.userId])

  const targetDepartmentOptions = useMemo(() => {
    return departments.filter(department =>
      department.departmentId !== externalForm.ownerDepartmentId
      && !isPresidencyLevelDepartment(department))
  }, [departments, externalForm.ownerDepartmentId])

  const citizenTargetDepartmentOptions = useMemo(() => {
    return departments.filter(department =>
      department.departmentId !== myDepartmentId
      && !isPresidencyLevelDepartment(department))
  }, [departments, myDepartmentId])

  // Birim İçi talepte "Görev Sahibi Kişi/Birim": yalnızca birim yöneticisi/sorumlusu,
  // kendisi dahil birimin tüm personellerini görev sahibi olarak seçebilir.
  const isManagerLike = user?.role === 'Manager' || user?.role === 'SystemAdmin'
  // Üst Düzey Yönetici (Reporter) yalnızca birim dışı talep oluşturur; tip seçimi atlanır.
  const isReporter = user?.role === 'Reporter'
  const internalOwnerUserOptions = useMemo(() => {
    const deptId = internalForm.ownerDepartmentId || myDepartmentId
    if (!isManagerLike || !deptId) {
      return user ? [{ userId: user.userId, displayName: user.displayName }] : []
    }
    const inDepartment = users.filter(item =>
      item.isActive &&
      userWorksInDepartment(item, deptId))
    const options = inDepartment.map(item => ({ userId: item.userId, displayName: item.displayName }))
    if (user && !options.some(option => option.userId === user.userId)) {
      options.unshift({ userId: user.userId, displayName: user.displayName })
    }
    return options
  }, [internalForm.ownerDepartmentId, myDepartmentId, isManagerLike, users, user])


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
    // Geçmişe yeni kayıt ekleriz; böylece "Geri" butonu 1 önceki sayfa olan
    // talep tipi seçim ekranına (/requests/new) döner, Kontrol Paneli'ne değil.
    navigate(`/requests/new?kind=${kind}`)
  }

  useEffect(() => {
    const handler = () => setActiveDepartmentId(getActiveDepartmentId())
    window.addEventListener('activeDepartmentChanged', handler)
    return () => window.removeEventListener('activeDepartmentChanged', handler)
  }, [])

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

  // Düzenleme modunda mevcut talep verilerini forma yükle (card 452).
  useEffect(() => {
    if (!editJobId || editPrefilled || selectedKind === 'citizen') return
    let cancelled = false
    api.getJobById(editJobId)
      .then(job => {
        if (cancelled || !job) return
        const targetIds = (job.departments ?? [])
          .filter(department => department.role === 'Target')
          .map(department => department.departmentId)
        const common = {
          title: job.title,
          description: job.description ?? '',
          priority: job.priority,
          dueDateUtc: job.dueDateUtc ?? '',
          isProject: job.isProject,
          ownerDepartmentId: job.ownerDepartmentId,
          neighborhood: job.neighborhood ?? '',
          street: job.street ?? '',
          openAddress: job.openAddress ?? '',
        }
        if (job.requestType === 'ExternalUnit') {
          setExternalForm(current => ({
            ...current,
            ...common,
            startDateUtc: job.startDateUtc ?? '',
            targetDepartmentId: targetIds[0] ?? '',
          }))
        } else {
          setInternalForm(current => ({
            ...current,
            ...common,
            ownerUserIds: getRequestedOwnerUserIds(job.departments ?? [], job.tasks ?? []),
          }))
        }
        setEditPrefilled(true)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
    return () => { cancelled = true }
  }, [editJobId, editPrefilled, selectedKind, t])

  const [editSocialMessageId, setEditSocialMessageId] = useState<string | null>(null)

  useEffect(() => {
    if (!editJobId || editPrefilled || selectedKind !== 'citizen') return
    let cancelled = false
    api.getJobById(editJobId)
      .then(async job => {
        if (cancelled || !job?.sourceRefId) return
        const message = await api.getSocialMessageById(job.sourceRefId)
        if (cancelled || !message) return
        const targetIds = (job.departments ?? [])
          .filter(department => department.role === 'Target')
          .map(department => department.departmentId)
        setEditSocialMessageId(message.socialMessageId)
        setCitizenForm({
          channel: message.channel,
          citizenHandle: job.citizenName ?? message.citizenHandle,
          citizenPhone: job.citizenPhone ?? '',
          content: message.content ?? job.description ?? '',
          category: message.category ?? '',
          latitude: message.latitude != null ? String(message.latitude) : '',
          longitude: message.longitude != null ? String(message.longitude) : '',
          title: job.title,
          targetDepartmentId: targetIds[0] ?? '',
          priority: job.priority,
          isProject: job.isProject,
          startDateUtc: job.startDateUtc ?? '',
          dueDateUtc: job.dueDateUtc ?? '',
          neighborhood: job.neighborhood ?? '',
          street: job.street ?? '',
          openAddress: job.openAddress ?? '',
        })
        setEditPrefilled(true)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
    return () => { cancelled = true }
  }, [editJobId, editPrefilled, selectedKind, t])

  useEffect(() => {
    if (!socialMessageIdParam || editPrefilled || selectedKind !== 'citizen' || editJobId) return
    let cancelled = false
    void api.getSocialMessageById(socialMessageIdParam)
      .then(message => {
        if (cancelled || !message) return
        setEditSocialMessageId(message.socialMessageId)
        setCitizenForm({
          ...EMPTY_CITIZEN_FORM,
          channel: message.channel,
          citizenHandle: message.citizenHandle,
          content: toRichTextContent(message.content ?? ''),
          title: message.category?.trim() || message.citizenHandle,
        })
        setEditPrefilled(true)
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : t('common.error')) })
    return () => { cancelled = true }
  }, [editJobId, editPrefilled, selectedKind, socialMessageIdParam, t])

  useEffect(() => {
    if (editJobId) return // düzenleme modunda sahip birim talepten gelir; varsayılanla ezme.
    if (!selectedKind) return
    const firstDepartmentId = myDepartmentId || ownerDepartmentOptions[0]?.departmentId
    if (firstDepartmentId && externalForm.ownerDepartmentId !== firstDepartmentId) {
      setExternalForm(current => ({ ...current, ownerDepartmentId: firstDepartmentId }))
    }
  }, [externalForm.ownerDepartmentId, myDepartmentId, ownerDepartmentOptions, selectedKind, editJobId])

  useEffect(() => {
    if (editJobId) return
    if (selectedKind !== 'internal') return
    const defaultDeptId = myDepartmentId || ownerDepartmentOptions[0]?.departmentId
    if (defaultDeptId && !internalForm.ownerDepartmentId) {
      setInternalForm(current => ({ ...current, ownerDepartmentId: defaultDeptId }))
    }
  }, [selectedKind, internalForm.ownerDepartmentId, ownerDepartmentOptions, myDepartmentId, editJobId])

  useEffect(() => {
    if ((rawKindParam && !kindParam) || (kindParam === 'citizen' && !canCreateCitizenRequest)) {
      navigate('/requests/new', { replace: true })
    }
  }, [canCreateCitizenRequest, kindParam, navigate, rawKindParam])

  // Üst Düzey Yönetici "Talep Oluştur"a tıkladığında doğrudan Birim Dışı formu açılır.
  useEffect(() => {
    if (isReporter && !selectedKind) {
      navigate('/requests/new?kind=external', { replace: true })
    }
  }, [isReporter, selectedKind, navigate])


  const renderPhotoUpload = (className?: string) => (
    <div className={['job-field', className].filter(Boolean).join(' ')}>
      <span className="job-field-label">{t('attachments.label', 'Dosya / Fotoğraf Ekle (opsiyonel)')}</span>
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <div
          role="button"
          tabIndex={saving ? -1 : 0}
          className={`request-photo-dropzone flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-3 text-center text-sm transition-colors ${saving ? 'pointer-events-none opacity-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
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
            accept={ACCEPT_ATTR}
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
        <div className="min-h-[5.5rem] rounded-2xl border border-slate-200 bg-white px-3 py-2">
          {pendingFiles.length === 0 ? (
            <p className="text-xs text-slate-400">{t('attachments.pendingEmpty', 'Henüz dosya seçilmedi.')}</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {pendingFiles.map((file, idx) => (
                <li key={`${file.name}-${idx}`} className="flex min-w-0 items-start gap-2">
                  <span className="min-w-0 flex-1 break-words font-medium text-slate-700">{file.name}</span>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-medium text-red-500 hover:text-red-600"
                    onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                  >
                    {t('common.delete', 'Sil')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {fileError && <div className="mt-1 text-xs text-red-500">{fileError}</div>}
    </div>
  )

  const renderAddressFields = (
    form: { neighborhood: string; street: string; openAddress: string },
    setField: (field: 'neighborhood' | 'street' | 'openAddress', value: string) => void,
  ) => (
    <div className="job-field">
      <span className="job-field-label">{t('address.sectionTitle', 'Adres Bilgisi (İsteğe Bağlı)')}</span>
      <div className="grid gap-2">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-1">
            <span className="text-sm font-semibold text-slate-500">{t('address.neighborhoodLabel', 'Mahalle')}</span>
            <select
              className="field-select"
              value={form.neighborhood}
              onChange={e => setField('neighborhood', e.target.value)}
            >
              <option value="">{t('address.neighborhoodPlaceholder', 'Mahalle seçin')}</option>
              {neighborhoods.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <span className="text-sm font-semibold text-slate-500">{t('address.streetLabel', 'Cadde / Sokak / Bulvar')}</span>
            <input
              className="field-input"
              placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
              value={form.street}
              onChange={e => setField('street', e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <label className="grid gap-1 min-h-0">
            <span className="text-sm font-semibold text-slate-500">{t('address.openAddressLabel', 'Açık Adres')}</span>
            <textarea
              className="field-textarea min-h-[5.5rem] resize-none"
              placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
              value={form.openAddress}
              onChange={e => setField('openAddress', e.target.value)}
            />
          </label>
          {renderPhotoUpload('min-h-0')}
        </div>
      </div>
    </div>
  )

  const handleCreateInternal = async (event: React.FormEvent) => {
    event.preventDefault()
    const effectiveOwnerDeptId = (user?.role === 'Staff' || user?.role === 'Operator')
      ? myDepartmentId
      : (internalForm.ownerDepartmentId || myDepartmentId)
    if (!effectiveOwnerDeptId) {
      setError(t('tasks.newRequest.noDepartment', 'Departman bilgisi bulunamadı.'))
      return
    }
    if (!hasRichTextContent(internalForm.description)) {
      setError(t('tasks.newRequest.descriptionRequired', 'Açıklama gereklidir.'))
      return
    }
    // Yönetici/sorumlu için personel seçimi zorunludur (tek kişi).
    if (isManagerLike && internalForm.ownerUserIds.filter(id => id.trim() !== '').length === 0) {
      setError(t('tasks.newRequest.ownerUserRequired', 'Lütfen bir personel seçiniz.'))
      return
    }
    if (confirmedKind !== 'internal') {
      setConfirmDialog({
        title: editJobId ? 'Birim İçi Talep Güncelle' : 'Birim İçi Talep Oluştur',
        message: editJobId ? 'Bu talebi güncellemek istediğinize emin misiniz?' : 'Bu talebi oluşturmak istediğinize emin misiniz?',
        titleCompact: true,
        titleDivider: true,
        confirmLabel: editJobId ? 'Güncelle' : 'Talep Oluştur', cancelLabel: 'İptal', variant: 'success',
        onConfirm: () => {
          setConfirmedKind('internal')
          window.setTimeout(() => (document.getElementById('internal-request-form') as HTMLFormElement | null)?.requestSubmit(), 0)
        },
      })
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (editJobId) {
        await api.updateJob(editJobId, {
          title: internalForm.title.trim(),
          description: internalForm.description.trim(),
          priority: internalForm.priority,
          startDateUtc: null,
          dueDateUtc: toApiDateTime(internalForm.dueDateUtc),
          isProject: internalForm.isProject,
          neighborhood: internalForm.neighborhood || '',
          street: internalForm.street || '',
          openAddress: internalForm.openAddress || '',
        })
        for (const file of pendingFiles) {
          await api.uploadJobAttachment(editJobId, file)
        }
        invalidateJobs(queryClient, editJobId)
        navigate('/my-requests')
        return
      }
      const selectedOwnerUserIds = internalForm.ownerUserIds.filter(id => id.trim() !== '')
      const job = await api.createJob({
        title: internalForm.title.trim(),
        description: internalForm.description.trim(),
        ownerDepartmentId: effectiveOwnerDeptId,
        ownerUserIds: selectedOwnerUserIds,
        priority: internalForm.priority,
        requestType: 'InternalUnit',
        isProject: internalForm.isProject,
        dueDateUtc: toApiDateTime(internalForm.dueDateUtc),
        sourceType: 'InternalRequest',
        neighborhood: internalForm.neighborhood || null,
        street: internalForm.street || null,
        openAddress: internalForm.openAddress || null,
      })
      for (const file of pendingFiles) {
        await api.uploadJobAttachment(job.jobId, file)
      }
      invalidateJobs(queryClient, job.jobId)
      setInternalForm(EMPTY_INTERNAL_FORM)
      setPendingFiles([])
      navigate('/requests/new')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
      setConfirmedKind(null)
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
    if (confirmedKind !== 'external') {
      setConfirmDialog({
        title: editJobId ? 'Birim Dışı Talep Güncelle' : 'Birim Dışı Talep Oluştur',
        message: editJobId ? 'Bu talebi güncellemek istediğinize emin misiniz?' : 'Bu talebi oluşturmak istediğinize emin misiniz?',
        titleCompact: true,
        titleDivider: true,
        confirmLabel: editJobId ? 'Güncelle' : 'Talep Oluştur', cancelLabel: 'İptal', variant: 'success',
        onConfirm: () => {
          setConfirmedKind('external')
          window.setTimeout(() => (document.getElementById('external-request-form') as HTMLFormElement | null)?.requestSubmit(), 0)
        },
      })
      return
    }

    setSaving(true)
    setError(null)
    try {
      const targetDepartmentIds = [externalForm.targetDepartmentId]
      if (editJobId) {
        await api.updateJob(editJobId, {
          title: externalForm.title.trim(),
          description: externalForm.description.trim(),
          priority: externalForm.priority,
          startDateUtc: toApiDateTime(externalForm.startDateUtc),
          dueDateUtc: toApiDateTime(externalForm.dueDateUtc),
          isProject: externalForm.isProject,
          neighborhood: externalForm.neighborhood || '',
          street: externalForm.street || '',
          openAddress: externalForm.openAddress || '',
          targetDepartmentIds,
        })
        for (const file of pendingFiles) {
          await api.uploadJobAttachment(editJobId, file)
        }
        invalidateJobs(queryClient, editJobId)
        navigate('/my-requests')
        return
      }
      const job = await api.createJob({
        title: externalForm.title.trim(),
        description: externalForm.description.trim(),
        ownerDepartmentId: externalForm.ownerDepartmentId,
        ownerUserIds: [],
        priority: externalForm.priority,
        requestType: 'ExternalUnit',
        isProject: externalForm.isProject,
        startDateUtc: toApiDateTime(externalForm.startDateUtc),
        dueDateUtc: toApiDateTime(externalForm.dueDateUtc),
        targetDepartmentIds,
        sourceType: 'Manual',
        neighborhood: externalForm.neighborhood || null,
        street: externalForm.street || null,
        openAddress: externalForm.openAddress || null,
      })
      for (const file of pendingFiles) {
        await api.uploadJobAttachment(job.jobId, file)
      }
      invalidateJobs(queryClient, job.jobId)
      setExternalForm(EMPTY_EXTERNAL_FORM)
      setPendingFiles([])
      navigate(isReporter ? '/my-requests?view=pending' : '/requests/new')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
      setConfirmedKind(null)
    }
  }

  const handleCreateCitizen = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!myDepartmentId) {
      setError(t('tasks.newRequest.noDepartment', 'Departman bilgisi bulunamadı.'))
      return
    }
    if (!citizenForm.targetDepartmentId) {
      setError(t('requests.create.targetDepartmentRequired', 'Talebin gideceği birim seçilmelidir.'))
      return
    }
    if (!hasRichTextContent(citizenForm.content)) {
      setError(t('settings.citizen.contentRequired', 'Açıklama gereklidir.'))
      return
    }
    if (!citizenForm.citizenHandle.trim()) {
      setError(t('settings.citizen.citizenHandleRequired', 'Vatandaş / Gönderen gereklidir.'))
      return
    }
    const trimmedPhone = citizenForm.citizenPhone.replace(/\D/g, '')
    if (trimmedPhone.length !== 10) {
      setError(t('settings.citizen.citizenPhoneInvalid', 'Vatandaş telefon numarası 10 haneli olmalıdır.'))
      return
    }
    if (confirmedKind !== 'citizen') {
      const linkedSocialMessageId = editSocialMessageId ?? socialMessageIdParam
      setConfirmDialog({
        title: editJobId && linkedSocialMessageId ? 'Vatandaş Talebi Güncelle' : 'Vatandaş Talebi Oluştur',
        message: editJobId && linkedSocialMessageId
          ? 'Bu talebi güncellemek istediğinize emin misiniz?'
          : 'Bu talebi oluşturmak istediğinize emin misiniz?',
        titleCompact: true,
        titleDivider: true,
        confirmLabel: editJobId && linkedSocialMessageId ? 'Güncelle' : 'Talep Oluştur',
        cancelLabel: 'İptal',
        variant: 'success',
        onConfirm: () => {
          setConfirmedKind('citizen')
          window.setTimeout(() => (document.getElementById('citizen-request-form') as HTMLFormElement | null)?.requestSubmit(), 0)
        },
      })
      return
    }

    setSaving(true)
    setError(null)
    const trimmedName = citizenForm.citizenHandle.trim()
    const linkedSocialMessageId = editSocialMessageId ?? socialMessageIdParam
    try {
      if (editJobId && linkedSocialMessageId) {
        await api.updateJob(editJobId, {
          title: citizenForm.title.trim() || trimmedName,
          description: citizenForm.content.trim(),
          priority: citizenForm.priority,
          startDateUtc: toApiDateTime(citizenForm.startDateUtc),
          dueDateUtc: toApiDateTime(citizenForm.dueDateUtc),
          isProject: false,
          citizenName: trimmedName,
          citizenPhone: trimmedPhone,
          neighborhood: citizenForm.neighborhood || null,
          street: citizenForm.street || null,
          openAddress: citizenForm.openAddress || null,
          targetDepartmentIds: [citizenForm.targetDepartmentId],
        })
        await api.updateSocialMessage(linkedSocialMessageId, {
          channel: citizenForm.channel,
          citizenHandle: trimmedName,
          content: citizenForm.content.trim(),
        })
        invalidateSocialMessages(queryClient, linkedSocialMessageId)
        invalidateJobs(queryClient, editJobId)
        setCitizenForm(EMPTY_CITIZEN_FORM)
        setEditSocialMessageId(null)
        navigateAfterCitizenRequest(navigate, returnToParam)
        return
      }

      const convertPayload = {
        title: citizenForm.title.trim() || trimmedName,
        description: citizenForm.content.trim(),
        ownerDepartmentId: myDepartmentId,
        priority: citizenForm.priority,
        requestType: 'ExternalUnit' as const,
        targetDepartmentIds: [citizenForm.targetDepartmentId],
        isProject: false,
        startDateUtc: toApiDateTime(citizenForm.startDateUtc),
        dueDateUtc: toApiDateTime(citizenForm.dueDateUtc),
        neighborhood: citizenForm.neighborhood || null,
        street: citizenForm.street || null,
        openAddress: citizenForm.openAddress || null,
        citizenName: trimmedName,
        citizenPhone: trimmedPhone,
      }

      if (linkedSocialMessageId) {
        await api.convertSocialMessageToJob(linkedSocialMessageId, convertPayload)
        invalidateSocialMessages(queryClient, linkedSocialMessageId)
      } else {
        const socialMessageId = await api.createSocialMessage({
          channel: citizenForm.channel,
          citizenHandle: trimmedName,
          content: citizenForm.content.trim(),
        })
        await api.convertSocialMessageToJob(socialMessageId, convertPayload)
        invalidateSocialMessages(queryClient, socialMessageId)
      }
      invalidateJobs(queryClient)
      setCitizenForm(EMPTY_CITIZEN_FORM)
      setEditSocialMessageId(null)
      navigateAfterCitizenRequest(navigate, returnToParam)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
      setConfirmedKind(null)
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
                <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.internalTitle', 'Birim İçi')}</h2>
                <p className="mt-1 text-base leading-6 text-slate-600">{t('requests.create.internalDescription', 'Kendi biriminizde birim içi talep sürecini oluşturun.')}</p>
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
                <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.externalTitle', 'Birim Dışı')}</h2>
                <p className="mt-1 text-base leading-6 text-slate-600">{t('requests.create.externalDescription', 'Başka bir birime gidecek talep sürecini oluşturun.')}</p>
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
                  <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.citizenTitle', 'Vatandaş Talepleri')}</h2>
                  <p className="mt-1 text-base leading-6 text-slate-600">{t('requests.create.citizenDescription', 'Vatandaştan gelen talebi manuel kayıt olarak oluşturun.')}</p>
                </div>
              </div>
            </button>
          ) : null}
        </section>
      ) : null}

      {selectedKind === 'internal' ? (
        <form id="internal-request-form" className="section-card request-form request-form--readable grid gap-4 xl:grid-cols-2" onSubmit={handleCreateInternal}>
          <div className="xl:col-span-2">
            <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.internalFormTitle', 'Birim İçi Talep Oluştur')}</h2>
            <p className="helper-copy">{t('tasks.newRequest.sectionDescription', 'Birim içi talep kaydını başlatmak için temel bilgileri giriniz.')}</p>
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field">
              <span className="job-field-label">{t('tasks.newRequest.title', 'Talep Başlığı')} <span className="text-xs font-normal text-slate-400">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span> <span className="text-red-500">*</span></span>
              <input className="field-input" required maxLength={50} value={internalForm.title} onChange={e => setInternalForm(current => ({ ...current, title: e.target.value }))} />
            </div>
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
              <span className="job-field-label">
                {t('tasks.newRequest.ownerUser', 'Görev Sahibi Kişi/Birim')}
                {isManagerLike && <span className="text-red-500"> *</span>}
              </span>
              {isManagerLike ? (
                <select
                  className="field-select"
                  value={internalForm.ownerUserIds[0] ?? ''}
                  onChange={e => setInternalForm(current => ({ ...current, ownerUserIds: e.target.value ? [e.target.value] : [''] }))}
                  required
                >
                  <option value="">{t('tasks.newRequest.selectStaff', 'Personel seçiniz')}</option>
                  {internalOwnerUserOptions.map(option => (
                    <option key={option.userId} value={option.userId}>{option.displayName}</option>
                  ))}
                </select>
              ) : (
                <select
                  className="field-select"
                  value={internalForm.ownerUserIds[0] ?? ''}
                  onChange={e => setInternalForm(current => ({ ...current, ownerUserIds: e.target.value ? [e.target.value] : [''] }))}
                >
                  <option value="">{t('tasks.newRequest.departmentPool', 'Birim Havuzu')}</option>
                  {internalOwnerUserOptions.map(option => (
                    <option key={option.userId} value={option.userId}>{option.displayName}</option>
                  ))}
                </select>
              )}
            </div>
            {renderAddressFields(internalForm, (field, value) => setInternalForm(current => ({ ...current, [field]: value })))}
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field min-h-0">
              <span className="job-field-label">{t('tasks.newRequest.description', 'Açıklama')} <span className="text-red-500">*</span></span>
              <RichTextEditor
                value={internalForm.description}
                onChange={description => setInternalForm(current => ({ ...current, description }))}
                required
                minHeight="min-h-64"
              />
            </div>
            <Button type="submit" disabled={saving || loading} className="gap-2">
              <Send className="size-4" />
              {saving ? t('common.saving', 'Kaydediliyor...') : editJobId ? t('common.update', 'Güncelle') : t('tasks.newRequest.submit', 'Talep Oluştur')}
            </Button>
          </div>
        </form>
      ) : null}

      {selectedKind === 'external' ? (
        <form id="external-request-form" className="section-card request-form request-form--readable grid gap-4 xl:grid-cols-2" onSubmit={handleCreateExternal}>
          <div className="xl:col-span-2">
            <h2 className="text-xl font-extrabold text-slate-950">{isReporter ? t('requests.create.reporterFormTitle', 'Talep Oluştur') : t('requests.create.externalFormTitle', 'Birim Dışı Talep Oluştur')}</h2>
            <p className="helper-copy">{isReporter ? t('requests.create.reporterFormDescription', 'Talep kaydını başlatmak için temel bilgileri girin.') : t('requests.create.externalFormDescription', 'Birim dışı talep kaydını başlatmak için temel bilgileri girin.')}</p>
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field">
              <label className="job-field-label" htmlFor="request-title">{t('tasks.newRequest.title', 'Talep Başlığı')} <span className="text-xs font-normal text-slate-400">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span> <span className="text-red-500">*</span></label>
              <input id="request-title" className="field-input" type="text" maxLength={50} value={externalForm.title} onChange={e => setExternalForm(current => ({ ...current, title: e.target.value }))} required />
            </div>
            <div className="job-field">
              <label className="job-field-label" htmlFor="request-target-dept">{t('jobs.form.targetDepartment', 'Talebin Gideceği Birim')} <span className="text-red-500">*</span></label>
              <select
                id="request-target-dept"
                className="field-select"
                value={externalForm.targetDepartmentId}
                onChange={e => setExternalForm(current => ({ ...current, targetDepartmentId: e.target.value }))}
                required
              >
                <option value="">{t('requests.create.targetDepartmentsPlaceholder', 'Departman seçiniz')}</option>
                {targetDepartmentOptions.map(d => (
                  <option key={d.departmentId} value={d.departmentId}>{d.name}</option>
                ))}
              </select>
            </div>
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
            {renderAddressFields(externalForm, (field, value) => setExternalForm(current => ({ ...current, [field]: value })))}
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
              {saving ? t('common.saving', 'Kaydediliyor...') : editJobId ? t('common.update', 'Güncelle') : t('tasks.newRequest.submit', 'Talep Oluştur')}
            </Button>
          </div>
        </form>
      ) : null}

      {selectedKind === 'citizen' ? (
        <form id="citizen-request-form" className="section-card request-form request-form--readable grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]" onSubmit={handleCreateCitizen}>
          <div className="xl:col-span-2">
            <h2 className="text-xl font-extrabold text-slate-950">{t('requests.create.citizenFormTitle', 'Vatandaş Talebi Oluştur')}</h2>
            <p className="helper-copy">{t('settings.citizen.sectionDescription', 'Sosyal medya entegrasyonu dışından gelen talepler için manuel kayıt oluşturun.')}</p>
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field">
              <label className="job-field-label" htmlFor="citizen-request-title">{t('tasks.newRequest.title', 'Talep Başlığı')} <span className="text-xs font-normal text-slate-400">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span> <span className="text-red-500">*</span></label>
              <input id="citizen-request-title" className="field-input" type="text" maxLength={50} value={citizenForm.title} onChange={event => setCitizenForm(current => ({ ...current, title: event.target.value }))} required />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="job-field">
                <label className="job-field-label" htmlFor="citizen-request-target-dept">{t('jobs.form.targetDepartment', 'Talebin Gideceği Birim')} <span className="text-red-500">*</span></label>
                <select
                  id="citizen-request-target-dept"
                  className="field-select"
                  value={citizenForm.targetDepartmentId}
                  onChange={event => setCitizenForm(current => ({ ...current, targetDepartmentId: event.target.value }))}
                  required
                >
                  <option value="">{t('requests.create.targetDepartmentsPlaceholder', 'Departman seçiniz')}</option>
                  {citizenTargetDepartmentOptions.map(department => (
                    <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                  ))}
                </select>
              </div>
              <div className="job-field">
                <label className="job-field-label" htmlFor="citizen-request-priority">{t('jobs.form.priority', 'Öncelik')}</label>
                <select id="citizen-request-priority" className="field-select" value={citizenForm.priority} onChange={event => setCitizenForm(current => ({ ...current, priority: event.target.value }))}>
                  <option value="VeryHigh">{t('enum.priority.VeryHigh', 'Çok Yüksek')}</option>
                  <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                  <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
                </select>
              </div>
            </div>
            {renderAddressFields(citizenForm, (field, value) => setCitizenForm(current => ({ ...current, [field]: value })))}
          </div>
          <div className="grid content-start gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="job-field">
                <span className="job-field-label">{t('settings.citizen.citizenName', 'Vatandaş İsmi / Gönderen')} <span className="text-xs font-normal text-slate-400">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span> <span className="text-red-500">*</span></span>
                <input
                  className="field-input"
                  required
                  maxLength={50}
                  placeholder={t('settings.citizen.citizenNamePlaceholder', 'Vatandaş ismi')}
                  value={citizenForm.citizenHandle}
                  onChange={event => setCitizenForm(current => ({ ...current, citizenHandle: event.target.value }))}
                />
              </label>
              <label className="job-field">
                <span className="job-field-label normal-case">{t('settings.citizen.citizenPhone', 'Vatandaş Telefon No')} <span className="text-xs font-normal text-slate-400 normal-case">{t('settings.citizen.citizenPhoneHint', '(Başında 0 olmadan ekleyin)')}</span> <span className="text-red-500">*</span></span>
                <input
                  className="field-input"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={10}
                  placeholder="5XXXXXXXXX"
                  value={citizenForm.citizenPhone}
                  onChange={event => setCitizenForm(current => ({
                    ...current,
                    citizenPhone: event.target.value.replace(/\D/g, '').slice(0, 10),
                  }))}
                />
              </label>
            </div>
            <div className="job-field">
              <span className="job-field-label">{t('settings.citizen.channel', 'Talep Kanalı')}</span>
              <div className="flex w-full gap-1">
                {CITIZEN_CHANNELS.map(channel => (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => setCitizenForm(current => ({ ...current, channel }))}
                    className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[0.68rem] font-semibold transition-colors ${
                      citizenForm.channel === channel
                        ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/8 text-[color:var(--color-primary)]'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <ChannelIcon channel={channel} className="size-4 shrink-0" />
                    <span className="truncate w-full text-center leading-tight">{t(`settings.citizen.channels.${channel}`, channel)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="job-field min-h-0">
              <span className="job-field-label">{t('settings.citizen.content', 'Açıklama')} <span className="text-red-500">*</span></span>
              <RichTextEditor
                value={citizenForm.content}
                onChange={content => setCitizenForm(current => ({ ...current, content }))}
                required
                placeholder={t('settings.citizen.contentPlaceholder', 'Vatandaş talebinin açıklamasını girin...')}
                minHeight="min-h-48"
              />
            </div>
            <Button type="submit" disabled={saving || loading} className="gap-2">
              <Send className="size-4" />
              {saving ? t('common.saving', 'Kaydediliyor...') : editJobId ? t('common.update', 'Güncelle') : t('tasks.newRequest.submit', 'Talep Oluştur')}
            </Button>
          </div>
        </form>
      ) : null}
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
