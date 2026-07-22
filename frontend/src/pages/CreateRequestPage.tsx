import { Building2, FileText, Paperclip, Phone, Send, Workflow } from 'lucide-react'
import { SimpleImageAttachmentIcon } from '../components/ui/SimpleImageAttachmentIcon'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateConversations, invalidateJobs, invalidateSocialMessages } from '../api/cacheInvalidation'
import { getActiveDepartmentId } from '../api/http'
import { Button } from '../components/ui/button'
import { ChannelIcon } from '../components/ui/channel-icon'
import { RequestTagAddButton, RequestTagPicker } from '../components/RequestTagDialog'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { earliestDueDatePickerValue, clampDueDatePickerValue } from '../utils/dateTimePicker'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { useAuth } from '../context/AuthContext'
import { userWorksInDepartment } from '../utils/userDepartments'
import type { Department, RequestTag, User } from '../types/platform'
import { isPresidencyLevelDepartment } from '../utils/departments'
import { lowercaseFileExtension } from '../utils/fileNameDisplay'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../data/izmir-locations'
import { prioritySelectOptions, stringListSelectOptions, yesNoSelectOptions } from '../utils/formDropdownOptions'
import { normalizeTitleCaseField } from '../utils/textNormalization'
import { ADDRESS_OPEN_ADDRESS_MAX_LENGTH, ADDRESS_STREET_MAX_LENGTH } from '../utils/addressLimits'

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
  channel: 'Phone',
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

const CITIZEN_CHANNELS = ['Phone'] as const
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

function pendingFileIcon(name: string) {
  return ['.jpg', '.jpeg', '.png'].includes(fileExtension(name)) ? SimpleImageAttachmentIcon : FileText
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

function toApiDueDateTime(value: string) {
  if (!value) return null
  return new Date(clampDueDatePickerValue(value)).toISOString()
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
  const [attachmentUploadProgress, setAttachmentUploadProgress] = useState(0)
  const [showAttachmentUploadProgress, setShowAttachmentUploadProgress] = useState(false)
  const [activeDepartmentId, setActiveDepartmentId] = useState<string | null>(getActiveDepartmentId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentUploadDelayRef = useRef<number | null>(null)
  const [internalForm, setInternalForm] = useState<InternalFormState>(EMPTY_INTERNAL_FORM)
  const [externalForm, setExternalForm] = useState<ExternalFormState>(EMPTY_EXTERNAL_FORM)
  const [citizenForm, setCitizenForm] = useState<CitizenFormState>(EMPTY_CITIZEN_FORM)

  useEffect(() => () => {
    if (attachmentUploadDelayRef.current !== null) {
      window.clearTimeout(attachmentUploadDelayRef.current)
    }
  }, [])
  // "Talep Oluştur"a basmadan mod seçimine (Geri) dönülünce girilen veriler temizlenir; tekrar
  // girildiğinde alanlar boş başlar. `kind` bir query param olduğundan seçim ekranına dönüşte bileşen
  // unmount olmaz ve state kalırdı; başka sayfaya gidildiğinde ise zaten unmount olup sıfırlanır.
  // Düzenleme (editJobId) ve sosyal mesajdan ön-doldurma akışları hariç tutulur (card #1411).
  useEffect(() => {
    if (selectedKind === null && !editJobId && !socialMessageIdParam) {
      setInternalForm(EMPTY_INTERNAL_FORM)
      setExternalForm(EMPTY_EXTERNAL_FORM)
      setCitizenForm(EMPTY_CITIZEN_FORM)
      setPendingFiles([])
      setFileError(null)
      setEditPrefilled(false)
    }
  }, [selectedKind, editJobId, socialMessageIdParam])
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
    if ((user?.role === 'Staff' || user?.role === 'Operator' || user?.role === 'CitizenRequestManager') && myDepartmentId) {
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

  // Vatandaş talebi operatörün kendi birimine de yönlendirilebilir (card #1090).
  const citizenTargetDepartmentOptions = useMemo(() => {
    return departments.filter(department => !isPresidencyLevelDepartment(department))
  }, [departments])

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

  const priorityOptions = useMemo(() => prioritySelectOptions(t), [t])
  const yesNoOptions = useMemo(() => yesNoSelectOptions(t), [t])
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(neighborhoods), [neighborhoods])
  const targetDepartmentSelectOptions = useMemo(
    () => targetDepartmentOptions.map(department => ({ value: department.departmentId, label: department.name })),
    [targetDepartmentOptions],
  )
  const citizenTargetDepartmentSelectOptions = useMemo(
    () => citizenTargetDepartmentOptions.map(department => ({ value: department.departmentId, label: department.name })),
    [citizenTargetDepartmentOptions],
  )
  // Standart kullanıcıda "Birim Havuzu" yalnız placeholder değil, SEÇİLEBİLİR ilk seçenektir;
  // kendisini seçtikten sonra havuza geri dönebilmelidir (card #1350).
  const internalOwnerUserSelectOptions = useMemo(() => {
    const base = internalOwnerUserOptions.map(option => ({ value: option.userId, label: option.displayName }))
    if (!isManagerLike) {
      return [{ value: '', label: t('tasks.newRequest.departmentPool', 'Birim Havuzu') }, ...base]
    }
    return base
  }, [internalOwnerUserOptions, isManagerLike, t])


  const requestTypeOptions = useMemo(() => {
    const options: { value: RequestKind; label: string }[] = [
      { value: 'internal' as const, label: t('requests.create.internalPluralTitle', 'Birim İçi Talepler') },
      { value: 'external' as const, label: t('requests.create.externalPluralTitle', 'Birim Dışı Talepler') },
    ]

    if (canCreateCitizenRequest) {
      options.push({ value: 'citizen' as const, label: t('requests.create.citizenCallTitle', 'Vatandaş Çağrı Talebi') })
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

  // Talep Etiketi bloğu: WhatsApp profilindeki salt-okunur değer + Etiketler + Etiket Ekle
  // bileşenlerinin klonu, aynı etiket verisiyle (card #1561). Konuşması olan vatandaşta seçim
  // profile anında kaydedilir; konuşma yoksa form üzerinde bilgilendirici olarak kalır.
  const canManageRequestTags = user?.role === 'Operator' || user?.role === 'SystemAdmin'
  const [requestTags, setRequestTags] = useState<RequestTag[]>([])
  const [citizenLabel, setCitizenLabel] = useState('')
  const [citizenConversationId, setCitizenConversationId] = useState<string | null>(null)

  const loadRequestTags = useCallback(async () => {
    try {
      setRequestTags(await api.getRequestTags())
    } catch {
      // sessizce yut: etiket dropdown'ı boş kalır, form etkilenmez
    }
  }, [])

  useEffect(() => {
    if (selectedKind !== 'citizen' || !canManageRequestTags) return
    void loadRequestTags()
  }, [selectedKind, canManageRequestTags, loadRequestTags])

  const handleCitizenLabelSelect = useCallback(async (label: string) => {
    setCitizenLabel(label)
    if (!citizenConversationId) return
    try {
      await api.updateCitizenConversationProfile(citizenConversationId, { label })
      invalidateConversations(queryClient, citizenConversationId)
    } catch {
      // profil güncellenemezse yerel seçim korunur
    }
  }, [citizenConversationId, queryClient])

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
        setCitizenConversationId(message.citizenConversationId ?? null)
        setCitizenLabel(message.category ?? '')
        if (message.citizenConversationId && !message.category) {
          void api.getCitizenConversationDetail(message.citizenConversationId)
            .then(detail => { if (!cancelled) setCitizenLabel(detail.label ?? '') })
            .catch(() => {})
        }
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
        setCitizenConversationId(message.citizenConversationId ?? null)
        setCitizenLabel(message.category ?? '')
        if (message.citizenConversationId && !message.category) {
          void api.getCitizenConversationDetail(message.citizenConversationId)
            .then(detail => { if (!cancelled) setCitizenLabel(detail.label ?? '') })
            .catch(() => {})
        }
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
      <span className="job-field-label">{t('attachments.label', 'Dosya / Görsel Ekle (opsiyonel)')}</span>
      <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
        <div
          role="button"
          tabIndex={saving ? -1 : 0}
          className={`request-photo-dropzone flex min-h-[4rem] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-2.5 text-center text-sm transition-colors ${saving ? 'pointer-events-none opacity-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
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
          <span className="mt-0.5 text-xs text-slate-400">{t('attachments.uploadHint', 'JPG, PNG, PDF, Office — max 5 MB')}</span>
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
        <div className="flex h-full min-h-[4rem] flex-col rounded-2xl border border-slate-200 bg-white px-3 py-2">
          {pendingFiles.length === 0 ? (
            <p className="text-sm text-slate-500">{t('attachments.pendingEmpty', 'Henüz dosya seçilmedi.')}</p>
          ) : (
            <ul className="space-y-1">
              {pendingFiles.map((file, idx) => {
                const Icon = pendingFileIcon(file.name)
                const displayName = lowercaseFileExtension(file.name)
                const dot = displayName.lastIndexOf('.')
                const baseName = dot > 0 ? displayName.slice(0, dot) : displayName
                const extension = dot > 0 ? displayName.slice(dot) : ''
                return (
                <li key={`${file.name}-${idx}`} className="flex min-w-0 items-start gap-2">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700">
                    <Icon className="size-3" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[13px] font-medium leading-snug text-slate-900">
                    {baseName}
                    {extension ? <span className="text-[13px] font-medium text-slate-900">{extension}</span> : null}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-red-500 hover:text-red-600"
                    onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                  >
                    {t('common.delete', 'Sil')}
                  </button>
                </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      {saving && showAttachmentUploadProgress ? (
        <div className="mt-2" aria-label={t('attachments.uploadProgress', 'Yükleme ilerlemesi')}>
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-500">
            <span>{t('attachments.uploading', 'Yükleniyor...')}</span>
            <span>%{attachmentUploadProgress}</span>
          </div>
          <div className="overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-1.5 rounded-full bg-[color:var(--color-primary)] transition-[width] duration-150"
              style={{ width: `${Math.max(attachmentUploadProgress, 4)}%` }}
            />
          </div>
        </div>
      ) : null}
      {fileError && <div className="mt-1 text-xs text-red-500">{fileError}</div>}
    </div>
  )

  const uploadPendingFiles = async (jobId: string) => {
    if (pendingFiles.length === 0) return

    setAttachmentUploadProgress(0)
    setShowAttachmentUploadProgress(false)
    if (attachmentUploadDelayRef.current !== null) window.clearTimeout(attachmentUploadDelayRef.current)
    attachmentUploadDelayRef.current = window.setTimeout(() => {
      attachmentUploadDelayRef.current = null
      setShowAttachmentUploadProgress(true)
    }, 1_000)

    try {
      for (const [index, file] of pendingFiles.entries()) {
        await api.uploadJobAttachment(jobId, file, fileProgress => {
          const overallProgress = Math.round(((index + fileProgress / 100) / pendingFiles.length) * 100)
          setAttachmentUploadProgress(overallProgress)
        })
      }
    } finally {
      if (attachmentUploadDelayRef.current !== null) {
        window.clearTimeout(attachmentUploadDelayRef.current)
        attachmentUploadDelayRef.current = null
      }
      setShowAttachmentUploadProgress(false)
      setAttachmentUploadProgress(0)
    }
  }

  const renderAddressFields = (
    form: { neighborhood: string; street: string; openAddress: string },
    setField: (field: 'neighborhood' | 'street' | 'openAddress', value: string) => void,
  ) => {
    const hasNeighborhood = form.neighborhood.trim().length > 0

    return (
    <div className="job-field">
      <span className="job-field-label">{t('address.sectionTitle', 'Adres Bilgisi (İsteğe Bağlı)')}</span>
      <div className="grid gap-2">
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-1">
            <span className="text-sm font-semibold text-slate-500">{t('address.neighborhoodLabel', 'Mahalle')}</span>
            <SingleSelectDropdown
              searchable
              options={neighborhoodOptions}
              value={form.neighborhood}
              onChange={neighborhood => {
                setField('neighborhood', neighborhood)
                if (!neighborhood) {
                  setField('street', '')
                  setField('openAddress', '')
                }
              }}
              placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
            />
          </div>
          <div className="grid gap-1">
            <span className="text-sm font-semibold text-slate-500">
              {t('address.streetLabel', 'Cadde / Sokak / Bulvar')}
              {hasNeighborhood ? <span className="text-red-500"> *</span> : null}
            </span>
            <input
              className="field-input address-street-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
              maxLength={ADDRESS_STREET_MAX_LENGTH}
              value={form.street}
              onChange={e => setField('street', e.target.value)}
              onBlur={() => setField('street', normalizeTitleCaseField(form.street) ?? '')}
              disabled={!hasNeighborhood}
              required={hasNeighborhood}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <label className="grid gap-1 min-h-0">
            <span className="text-sm font-semibold text-slate-500">{t('address.openAddressLabel', 'Açık Adres')}</span>
            <textarea
              className="field-textarea address-open-textarea min-h-[5.5rem] resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
              maxLength={ADDRESS_OPEN_ADDRESS_MAX_LENGTH}
              value={form.openAddress}
              onChange={e => setField('openAddress', e.target.value)}
              onBlur={() => setField('openAddress', normalizeTitleCaseField(form.openAddress) ?? '')}
              disabled={!hasNeighborhood}
            />
          </label>
          {renderPhotoUpload('min-h-0')}
        </div>
      </div>
    </div>
    )
  }

  const handleCreateInternal = async (event: React.FormEvent) => {
    event.preventDefault()
    const effectiveOwnerDeptId = (user?.role === 'Staff' || user?.role === 'Operator' || user?.role === 'CitizenRequestManager')
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
    if (internalForm.neighborhood.trim() && !internalForm.street.trim()) {
      setError(t('address.streetRequired', 'Mahalle seçildiğinde Cadde / Sokak / Bulvar zorunludur.'))
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
          dueDateUtc: toApiDueDateTime(internalForm.dueDateUtc),
          isProject: internalForm.isProject,
          neighborhood: internalForm.neighborhood || '',
          street: normalizeTitleCaseField(internalForm.street) ?? '',
          openAddress: normalizeTitleCaseField(internalForm.openAddress) ?? '',
        })
        await uploadPendingFiles(editJobId)
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
        dueDateUtc: toApiDueDateTime(internalForm.dueDateUtc),
        sourceType: 'InternalRequest',
        neighborhood: internalForm.neighborhood || null,
        street: normalizeTitleCaseField(internalForm.street),
        openAddress: normalizeTitleCaseField(internalForm.openAddress),
      })
      await uploadPendingFiles(job.jobId)
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
    if (externalForm.neighborhood.trim() && !externalForm.street.trim()) {
      setError(t('address.streetRequired', 'Mahalle seçildiğinde Cadde / Sokak / Bulvar zorunludur.'))
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
          title: normalizeTitleCaseField(externalForm.title) ?? '',
          description: externalForm.description.trim(),
          priority: externalForm.priority,
          startDateUtc: toApiDateTime(externalForm.startDateUtc),
          dueDateUtc: toApiDueDateTime(externalForm.dueDateUtc),
          isProject: externalForm.isProject,
          neighborhood: normalizeTitleCaseField(externalForm.neighborhood) ?? '',
          street: normalizeTitleCaseField(externalForm.street) ?? '',
          openAddress: normalizeTitleCaseField(externalForm.openAddress) ?? '',
          targetDepartmentIds,
        })
        await uploadPendingFiles(editJobId)
        invalidateJobs(queryClient, editJobId)
        navigate('/my-requests')
        return
      }
      const job = await api.createJob({
        title: normalizeTitleCaseField(externalForm.title) ?? '',
        description: externalForm.description.trim(),
        ownerDepartmentId: externalForm.ownerDepartmentId,
        ownerUserIds: [],
        priority: externalForm.priority,
        requestType: 'ExternalUnit',
        isProject: externalForm.isProject,
        startDateUtc: toApiDateTime(externalForm.startDateUtc),
        dueDateUtc: toApiDueDateTime(externalForm.dueDateUtc),
        targetDepartmentIds,
        sourceType: 'Manual',
        neighborhood: normalizeTitleCaseField(externalForm.neighborhood),
        street: normalizeTitleCaseField(externalForm.street),
        openAddress: normalizeTitleCaseField(externalForm.openAddress),
      })
      await uploadPendingFiles(job.jobId)
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
    if (!trimmedPhone.startsWith('5')) {
      setError(t('settings.citizen.citizenPhoneMustStartWith5', 'Telefon numarası 5 ile başlamalıdır.'))
      return
    }
    if (citizenForm.neighborhood.trim() && !citizenForm.street.trim()) {
      setError(t('address.streetRequired', 'Mahalle seçildiğinde Cadde / Sokak / Bulvar zorunludur.'))
      return
    }
    if (confirmedKind !== 'citizen') {
      const linkedSocialMessageId = editSocialMessageId ?? socialMessageIdParam
      setConfirmDialog({
        title: editJobId && linkedSocialMessageId ? 'Vatandaş Çağrı Talebi Güncelle' : 'Vatandaş Çağrı Talebi Oluştur',
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
    // Vatandaş adı (Job.CitizenName) girilen casing'den bağımsız her kelimenin ilk harfi büyük
    // kaydedilir; SocialMessage.CitizenHandle ham haliyle korunur — WhatsApp gibi diğer kanallarda
    // bu alan telefon/kimlik türevi bir eşleşme anahtarıdır, isim gibi normalize edilmez
    // (codex review, card #1547).
    const normalizedCitizenName = normalizeTitleCaseField(trimmedName) ?? trimmedName
    const linkedSocialMessageId = editSocialMessageId ?? socialMessageIdParam
    try {
      if (editJobId && linkedSocialMessageId) {
        await api.updateJob(editJobId, {
          title: citizenForm.title.trim() || normalizedCitizenName,
          description: citizenForm.content.trim(),
          priority: citizenForm.priority,
          startDateUtc: toApiDateTime(citizenForm.startDateUtc),
          dueDateUtc: toApiDueDateTime(citizenForm.dueDateUtc),
          isProject: false,
          citizenName: normalizedCitizenName,
          citizenPhone: trimmedPhone,
          neighborhood: citizenForm.neighborhood || null,
          street: normalizeTitleCaseField(citizenForm.street),
          openAddress: normalizeTitleCaseField(citizenForm.openAddress),
          targetDepartmentIds: [citizenForm.targetDepartmentId],
        })
        await api.updateSocialMessage(linkedSocialMessageId, {
          channel: citizenForm.channel,
          citizenHandle: trimmedName,
          content: citizenForm.content.trim(),
          category: citizenLabel.trim() || undefined,
        })
        await uploadPendingFiles(editJobId)
        invalidateSocialMessages(queryClient, linkedSocialMessageId)
        invalidateJobs(queryClient, editJobId)
        setCitizenForm(EMPTY_CITIZEN_FORM)
        setEditSocialMessageId(null)
        setCitizenLabel('')
        setCitizenConversationId(null)
        navigateAfterCitizenRequest(navigate, returnToParam)
        return
      }

      const convertPayload = {
        title: citizenForm.title.trim() || normalizedCitizenName,
        description: citizenForm.content.trim(),
        ownerDepartmentId: myDepartmentId,
        priority: citizenForm.priority,
        requestType: 'ExternalUnit' as const,
        targetDepartmentIds: [citizenForm.targetDepartmentId],
        isProject: false,
        startDateUtc: toApiDateTime(citizenForm.startDateUtc),
        dueDateUtc: toApiDueDateTime(citizenForm.dueDateUtc),
        neighborhood: citizenForm.neighborhood || null,
        street: normalizeTitleCaseField(citizenForm.street),
        openAddress: normalizeTitleCaseField(citizenForm.openAddress),
        citizenName: normalizedCitizenName,
        citizenPhone: trimmedPhone,
      }

      if (linkedSocialMessageId) {
        await api.updateSocialMessage(linkedSocialMessageId, {
          channel: citizenForm.channel,
          citizenHandle: trimmedName,
          content: citizenForm.content.trim(),
          category: citizenLabel.trim() || undefined,
        })
        const job = await api.convertSocialMessageToJob(linkedSocialMessageId, convertPayload)
        await uploadPendingFiles(job.jobId)
        invalidateSocialMessages(queryClient, linkedSocialMessageId)
      } else {
        const socialMessageId = await api.createSocialMessage({
          channel: citizenForm.channel,
          citizenHandle: trimmedName,
          content: citizenForm.content.trim(),
          category: citizenLabel.trim() || undefined,
        })
        const job = await api.convertSocialMessageToJob(socialMessageId, convertPayload)
        await uploadPendingFiles(job.jobId)
        invalidateSocialMessages(queryClient, socialMessageId)
      }
      invalidateJobs(queryClient)
      setCitizenForm(EMPTY_CITIZEN_FORM)
      setEditSocialMessageId(null)
      setCitizenLabel('')
      setCitizenConversationId(null)
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
                <h2 className="text-xl font-semibold text-slate-950">{t('requests.create.internalTitle', 'Birim İçi')}</h2>
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
                <h2 className="text-xl font-semibold text-slate-950">{t('requests.create.externalTitle', 'Birim Dışı')}</h2>
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
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <Phone className="size-5" />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{t('requests.create.citizenCallTitle', 'Vatandaş Çağrı Talebi')}</h2>
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
            <h2 className="inline-flex items-center gap-2 text-xl font-extrabold text-slate-950">
              <Building2 className="size-5 text-[color:var(--color-primary)]" />
              {t('requests.create.internalFormTitle', 'Birim İçi Talep Oluştur')}
            </h2>
            <p className="helper-copy">{t('tasks.newRequest.sectionDescription', 'Birim içi talep kaydını başlatmak için temel bilgileri giriniz.')}</p>
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field">
              <span className="job-field-label">{t('tasks.newRequest.title', 'Talep Başlığı')} <span className="text-xs font-normal text-slate-400">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span> <span className="text-red-500">*</span></span>
              <input className="field-input" required maxLength={50} value={internalForm.title} onChange={e => setInternalForm(current => ({ ...current, title: e.target.value }))} />
            </div>
            <div className="job-field">
              <span className="job-field-label">
                {t('tasks.newRequest.ownerUser', 'Görevi Yapan Kişi/Birim')}
                {isManagerLike && <span className="text-red-500"> *</span>}
              </span>
              {isManagerLike ? (
                <SingleSelectDropdown
                  options={internalOwnerUserSelectOptions}
                  value={internalForm.ownerUserIds[0] ?? ''}
                  onChange={userId => setInternalForm(current => ({ ...current, ownerUserIds: userId ? [userId] : [''] }))}
                  placeholder={t('tasks.newRequest.selectStaff', 'Personel seçiniz')}
                />
              ) : (
                <SingleSelectDropdown
                  options={internalOwnerUserSelectOptions}
                  value={internalForm.ownerUserIds[0] ?? ''}
                  onChange={userId => setInternalForm(current => ({ ...current, ownerUserIds: userId ? [userId] : [''] }))}
                  placeholder={t('tasks.newRequest.departmentPool', 'Birim Havuzu')}
                />
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="job-field">
                <span className="job-field-label">{t('tasks.newRequest.priority', 'Öncelik')}</span>
                <SingleSelectDropdown
                  options={priorityOptions}
                  value={internalForm.priority}
                  onChange={priority => setInternalForm(current => ({ ...current, priority }))}
                  placeholder={t('tasks.newRequest.priority', 'Öncelik')}
                />
              </div>
              <div className="job-field">
                <span className="job-field-label">{t('tasks.newRequest.dueDate', 'Bitiş Tarihi (opsiyonel)')}</span>
                <DateTimePicker value={internalForm.dueDateUtc} onChange={v => setInternalForm(current => ({ ...current, dueDateUtc: clampDueDatePickerValue(v) }))} placeholder={t('tasks.newRequest.dueDate', 'Bitiş Tarihi (opsiyonel)')} forceUp minDateTime={earliestDueDatePickerValue()} />
              </div>
              <div className="job-field">
                <span className="job-field-label">{t('jobs.form.isProject', 'Proje niteliğinde mi?')}</span>
                <SingleSelectDropdown
                  options={yesNoOptions}
                  value={internalForm.isProject ? 'yes' : 'no'}
                  onChange={value => setInternalForm(current => ({ ...current, isProject: value === 'yes' }))}
                  placeholder={t('jobs.form.isProject', 'Proje niteliğinde mi?')}
                />
              </div>
            </div>
            {renderAddressFields(internalForm, (field, value) => setInternalForm(current => ({ ...current, [field]: value })))}
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field min-h-0">
              <span className="job-field-label">{t('tasks.newRequest.description', 'Açıklama')} <span className="text-xs font-normal text-slate-400">(max 400 karakter)</span> <span className="text-red-500">*</span></span>
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
        <form id="external-request-form" className="section-card request-form request-form--readable grid gap-3 xl:grid-cols-2" onSubmit={handleCreateExternal}>
          <div className="xl:col-span-2">
            <h2 className="inline-flex items-center gap-2 text-xl font-extrabold text-slate-950">
              <Workflow className="size-5 text-emerald-700" />
              {isReporter ? t('requests.create.reporterFormTitle', 'Talep Oluştur') : t('requests.create.externalFormTitle', 'Birim Dışı Talep Oluştur')}
            </h2>
            <p className="helper-copy">{isReporter ? t('requests.create.reporterFormDescription', 'Talep kaydını başlatmak için temel bilgileri girin.') : t('requests.create.externalFormDescription', 'Birim dışı talep kaydını başlatmak için temel bilgileri girin.')}</p>
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field">
              <label className="job-field-label" htmlFor="request-title">{t('tasks.newRequest.title', 'Talep Başlığı')} <span className="text-xs font-normal text-slate-400">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span> <span className="text-red-500">*</span></label>
              <input id="request-title" className="field-input" type="text" maxLength={50} value={externalForm.title} onChange={e => setExternalForm(current => ({ ...current, title: e.target.value }))} required />
            </div>
            <div className="job-field">
              <label className="job-field-label" htmlFor="request-target-dept">{t('jobs.form.targetDepartment', 'Talebin Gideceği Birim')} <span className="text-red-500">*</span></label>
              <SingleSelectDropdown
                options={targetDepartmentSelectOptions}
                value={externalForm.targetDepartmentId}
                onChange={targetDepartmentId => setExternalForm(current => ({ ...current, targetDepartmentId }))}
                placeholder={t('requests.create.targetDepartmentsPlaceholder', 'Departman seçiniz')}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-priority">{t('jobs.form.priority')}</label>
                <SingleSelectDropdown
                  options={priorityOptions}
                  value={externalForm.priority}
                  onChange={priority => setExternalForm(current => ({ ...current, priority }))}
                  placeholder={t('jobs.form.priority', 'Öncelik')}
                />
              </div>
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-is-project">{t('jobs.form.isProject', 'Proje niteliğinde mi?')}</label>
                <SingleSelectDropdown
                  options={yesNoOptions}
                  value={externalForm.isProject ? 'yes' : 'no'}
                  onChange={value => setExternalForm(current => ({ ...current, isProject: value === 'yes' }))}
                  placeholder={t('jobs.form.isProject', 'Proje niteliğinde mi?')}
                />
              </div>
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-start-date">{t('jobs.form.startDate')}</label>
                <DateTimePicker id="request-start-date" value={externalForm.startDateUtc} onChange={v => setExternalForm(current => ({ ...current, startDateUtc: v }))} />
              </div>
              <div className="job-field">
                <label className="job-field-label" htmlFor="request-due-date">{t('jobs.form.dueDate')}</label>
                <DateTimePicker id="request-due-date" value={externalForm.dueDateUtc} onChange={v => setExternalForm(current => ({ ...current, dueDateUtc: clampDueDatePickerValue(v) }))} minDateTime={earliestDueDatePickerValue()} />
              </div>
            </div>
            {renderAddressFields(externalForm, (field, value) => setExternalForm(current => ({ ...current, [field]: value })))}
          </div>
          <div className="grid content-start gap-3">
            <div className="job-field min-h-0">
              <span className="job-field-label">{t('jobs.form.description')} <span className="text-xs font-normal text-slate-400">(max 400 karakter)</span> <span className="text-red-500">*</span></span>
              <RichTextEditor
                value={externalForm.description}
                onChange={description => setExternalForm(current => ({ ...current, description }))}
                required
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

      {selectedKind === 'citizen' ? (
        <form id="citizen-request-form" className="section-card request-form request-form--readable grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]" onSubmit={handleCreateCitizen}>
          <div className="xl:col-span-2">
            <h2 className="inline-flex items-center gap-2 text-xl font-extrabold text-slate-950">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Phone className="size-4" />
              </span>
              {t('requests.create.citizenCallFormTitle', 'Vatandaş Çağrı Talebi Oluştur')}
            </h2>
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
                <SingleSelectDropdown
                  options={citizenTargetDepartmentSelectOptions}
                  value={citizenForm.targetDepartmentId}
                  onChange={targetDepartmentId => setCitizenForm(current => ({ ...current, targetDepartmentId }))}
                  placeholder={t('requests.create.targetDepartmentsPlaceholder', 'Departman seçiniz')}
                />
              </div>
              <div className="job-field">
                <label className="job-field-label" htmlFor="citizen-request-priority">{t('jobs.form.priority', 'Öncelik')}</label>
                <SingleSelectDropdown
                  options={priorityOptions}
                  value={citizenForm.priority}
                  onChange={priority => setCitizenForm(current => ({ ...current, priority }))}
                  placeholder={t('jobs.form.priority', 'Öncelik')}
                />
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
            <div className="grid gap-3 md:grid-cols-2">
              <div className="job-field">
                <span className="job-field-label">{t('settings.citizen.channel', 'Talep Kanalı')}</span>
                <div className="flex gap-1">
                  {CITIZEN_CHANNELS.map(channel => (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => setCitizenForm(current => ({ ...current, channel }))}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold transition-colors ${
                        citizenForm.channel === channel
                          ? 'border-sky-500 text-sky-600'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <ChannelIcon channel={channel} className="size-4 shrink-0" />
                      <span className="truncate text-center leading-tight">{t(`settings.citizen.channels.${channel}`, channel)}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Talep Kanalı'nın sağında WhatsApp profilindeki Talep Etiketi bloğunun klonu (card #1561). */}
              <div className="job-field">
                <span className="job-field-label">{t('whatsapp.label', 'Talep Etiketi')}</span>
                <div className="flex items-center gap-2">
                  <input
                    className="field-input min-w-0 flex-1 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    value={citizenLabel}
                    readOnly
                    disabled
                  />
                  {canManageRequestTags && (
                    <>
                      <RequestTagPicker largeText tags={requestTags} onSelect={label => void handleCitizenLabelSelect(label)} />
                      <RequestTagAddButton largeText onChanged={() => void loadRequestTags()} />
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="job-field min-h-0">
              <span className="job-field-label">{t('settings.citizen.content', 'Açıklama')} <span className="text-xs font-normal text-slate-400">(max 400 karakter)</span> <span className="text-red-500">*</span></span>
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
              {saving ? t('common.saving', 'Kaydediliyor...') : editJobId ? t('common.update', 'Güncelle') : t('requests.create.citizenCallSubmit', 'Talep Oluştur')}
            </Button>
          </div>
        </form>
      ) : null}
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
