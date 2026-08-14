import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Paperclip, Send } from 'lucide-react'
import { SimpleImageAttachmentIcon } from './ui/SimpleImageAttachmentIcon'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateJobs, invalidateConversations, invalidateSocialMessages } from '../api/cacheInvalidation'
import { getActiveDepartmentId } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'
import { DeferredComposerInput } from './ui/DeferredComposerInput'
import { DeferredComposerTextarea } from './ui/DeferredComposerTextarea'
import { ConfirmDialog, type ConfirmDialogState } from './ui/confirm-dialog'
import { ModalCloseButton } from './ui/modal-close-button'
import { RichTextEditor } from './ui/RichTextEditor'
import { SingleSelectDropdown } from './ui/single-select-dropdown'
import { ConversationPanel } from './ConversationPanel'
import { RequestTagAddButton, RequestTagPicker } from './RequestTagDialog'
import type { CitizenConversationDetail, Department, RequestTag, SocialMessage } from '../types/platform'
import { isPresidencyLevelDepartment } from '../utils/departments'
import { getNeighborhoodsForDistrict } from '../data/izmir-locations'
import { useMunicipalityDistrictId } from '../hooks/useMunicipalityDistrictId'
import { formatCitizenRequestNumber } from '../utils/citizenRequests'
import { getLocale } from '../utils/localization'
import { prioritySelectOptions, stringListSelectOptions } from '../utils/formDropdownOptions'
import { ADDRESS_OPEN_ADDRESS_MAX_LENGTH, ADDRESS_STREET_MAX_LENGTH, ADDRESS_STREET_NO_MAX_LENGTH, normalizeStreetNo } from '../utils/addressLimits'
import { normalizeTitleCaseField } from '../utils/textNormalization'
import { formatDisplayPhone } from '../utils/phoneNormalization'
import {
  ATTACHMENT_FILE_ACCEPT,
  attachmentFileExtension,
  isAllowedAttachmentFileName,
} from '../utils/attachmentAccept'
import {
  ATTACHMENT_MAX_TOTAL_BYTES,
  exceedsAttachmentTotalLimit,
  sumFileSizes,
} from '../utils/attachmentLimits'

interface CitizenRequestModalProps {
  message: SocialMessage
  departments: Department[]
  editJobId?: string | null
  forceNewRequest?: boolean
  citizenConversationId?: string | null
  onClose: () => void
  onCreated: () => void
}

const MAX_FILE_SIZE = ATTACHMENT_MAX_TOTAL_BYTES

function pendingFileIcon(name: string) {
  return ['.jpg', '.jpeg', '.png'].includes(attachmentFileExtension(name)) ? SimpleImageAttachmentIcon : FileText
}

function validateFile(file: File): string | null {
  if (!isAllowedAttachmentFileName(file.name)) {
    return 'Yalnızca resim (JPG, PNG), video (MP4, MOV, WEBM), PDF ve Office dosyaları yüklenebilir.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Dosya boyutu 5 MB\'ı aşamaz.'
  }
  return null
}

function toApiDateTime(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

function hasRichTextContent(value: string): boolean {
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

function normalizeCitizenHandle(value: string): string {
  return value.trim().replace(/^@+/, '')
}

function stripWhatsAppJid(value: string): string {
  const trimmed = value.trim()
  const atIndex = trimmed.indexOf('@')
  return atIndex >= 0 ? trimmed.slice(0, atIndex) : trimmed
}

function looksLikePhone(value: string): boolean {
  const trimmed = stripWhatsAppJid(value)
  if (!trimmed) return false
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return false
  if (/^[\d+\s().-]+$/.test(trimmed)) return true
  const compact = trimmed.replace(/\s/g, '')
  return compact.length > 0 && digits.length / compact.length >= 0.85
}

function extractPhoneDigits(value: string): string {
  const digits = stripWhatsAppJid(value).replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 12 && digits.startsWith('90')) return digits.slice(2)
  return digits.length > 10 ? digits.slice(-10) : digits
}

function isBlankCitizenLabel(value: string): boolean {
  const normalized = normalizeCitizenHandle(value)
  return !normalized || ['-', '—', '–'].includes(normalized)
}

function resolveInitialCitizenName(message: SocialMessage): string {
  for (const candidate of [message.citizenName, message.citizenHandle]) {
    if (!candidate?.trim()) continue
    const normalized = normalizeCitizenHandle(candidate)
    if (normalized && !looksLikePhone(normalized) && !isBlankCitizenLabel(normalized)) return normalized
  }
  return ''
}

function resolveInitialCitizenPhone(message: SocialMessage): string {
  for (const candidate of [message.citizenPhone, message.citizenHandle, message.citizenName]) {
    if (!candidate?.trim()) continue
    if (looksLikePhone(candidate)) return extractPhoneDigits(candidate)
  }
  return ''
}


function sanitizeCitizenName(value: string | null | undefined): string {
  if (!value?.trim()) return ''
  const normalized = normalizeCitizenHandle(value)
  return normalized && !looksLikePhone(normalized) && !isBlankCitizenLabel(normalized) ? normalized : ''
}

/**
 * Vatandaş talebini ilgili WhatsApp konuşması yan tarafta görünür şekilde bir pop-up içinde oluşturur.
 */
export function CitizenRequestModal({ message, departments, editJobId = null, forceNewRequest = false, citizenConversationId = null, onClose, onCreated }: CitizenRequestModalProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isEditMode = Boolean(editJobId)
  const locale = getLocale(i18n.language)
  const editCitizenRequestNumber = isEditMode ? formatCitizenRequestNumber(message, locale) : null
  const ownerDepartmentId = getActiveDepartmentId() ?? user?.departmentId ?? message.assignedDepartmentId ?? ''

  // WhatsApp konuşmasından açıldığında telefon değiştirilemez; kayıtlı vatandaş adı varsa
  // ad alanı dolu gelir ve o da değiştirilemez (card #1348). Çağrı kanalında düzenlemede
  // ad/telefon düzenlenebilir (#6a6d903e).
  const savedCitizenName = sanitizeCitizenName(message.citizenName)
  const isPhoneChannel = message.channel === 'Phone'
  const citizenNameLocked = !isPhoneChannel && Boolean(savedCitizenName)
  const citizenPhoneLocked = !isPhoneChannel && Boolean(resolveInitialCitizenPhone(message))
  const [citizenHandle, setCitizenHandle] = useState(() => (
    forceNewRequest && !editJobId ? savedCitizenName : resolveInitialCitizenName(message)
  ))
  const [citizenPhone, setCitizenPhone] = useState(() => resolveInitialCitizenPhone(message))
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDepartmentId, setTargetDepartmentId] = useState('')
  const [priority, setPriority] = useState('Normal')
  const [startDateUtc, setStartDateUtc] = useState('')
  const [dueDateUtc, setDueDateUtc] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [street, setStreet] = useState('')
  const [streetNo, setStreetNo] = useState('')
  const [openAddress, setOpenAddress] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingJob, setLoadingJob] = useState(isEditMode)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [confirmedSubmit, setConfirmedSubmit] = useState(false)
  const [conversationDetail, setConversationDetail] = useState<CitizenConversationDetail | null>(null)
  const [internalDepartmentId, setInternalDepartmentId] = useState('')
  const [sendingInternal, setSendingInternal] = useState(false)
  const [requestLabel, setRequestLabel] = useState('')
  const [requestTags, setRequestTags] = useState<RequestTag[]>([])
  const canManageRequestTags = user?.role === 'Operator' || user?.role === 'SystemAdmin'

  const loadRequestTags = useCallback(async () => {
    try {
      setRequestTags(await api.getRequestTags())
    } catch {
      // Etiket listesi boş kalabilir; form akışını bozma.
    }
  }, [])

  useEffect(() => {
    if (!canManageRequestTags) return
    void loadRequestTags()
  }, [canManageRequestTags, loadRequestTags])

  useEffect(() => {
    if (!forceNewRequest || editJobId) return
    setTitle('')
    setDescription('')
    setTargetDepartmentId('')
    setPriority('Normal')
    setStartDateUtc('')
    setDueDateUtc('')
    setNeighborhood('')
    setStreet('')
    setStreetNo('')
    setOpenAddress('')
    setPendingFiles([])
    setFileError(null)
    setError(null)
    setRequestLabel('')
    setCitizenHandle(sanitizeCitizenName(message.citizenName))
    setCitizenPhone(resolveInitialCitizenPhone(message))
  }, [forceNewRequest, editJobId, message])

  useEffect(() => {
    if (!citizenConversationId) {
      setConversationDetail(null)
      return
    }
    let cancelled = false
    void api.getCitizenConversationDetail(citizenConversationId)
      .then(detail => {
        if (!cancelled) {
          setConversationDetail(detail)
          // Yeni talep popup'ında önceki etiket butonda seçili kalmasın (#r463).
          if (!(forceNewRequest && !editJobId)) {
            setRequestLabel(detail.label?.trim() ?? '')
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConversationDetail(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [citizenConversationId, editJobId, forceNewRequest])

  const handleRequestLabelSelect = async (label: string) => {
    const normalizedLabel = normalizeTitleCaseField(label) ?? ''
    setRequestLabel(normalizedLabel)
    if (!citizenConversationId) return
    try {
      await api.updateCitizenConversationProfile(citizenConversationId, { label: normalizedLabel })
      invalidateConversations(queryClient, citizenConversationId)
    } catch {
      // Seçim UI'da kalır; kayıt hatası formu engellemez.
    }
  }

  const handleClose = () => {
    // Popup X / kapanış → Etiketler default (#r463).
    setRequestLabel('')
    onClose()
  }

  useEffect(() => {
    if (!editJobId) {
      setLoadingJob(false)
      return
    }

    let cancelled = false
    setLoadingJob(true)
    void api.getJobById(editJobId)
      .then(job => {
        if (cancelled || !job) return
        const targetIds = (job.departments ?? [])
          .filter(department => department.role === 'Target')
          .map(department => department.departmentId)
        setTitle(job.title)
        setDescription(job.description ?? (message.content ? `<p>${escapeHtml(message.content)}</p>` : ''))
        setTargetDepartmentId(targetIds[0] ?? '')
        setPriority(job.priority)
        setCitizenHandle(sanitizeCitizenName(job.citizenName) || resolveInitialCitizenName(message))
        setCitizenPhone(job.citizenPhone ? extractPhoneDigits(job.citizenPhone) : resolveInitialCitizenPhone(message))
        setStartDateUtc(job.startDateUtc ?? '')
        setDueDateUtc(job.dueDateUtc ?? '')
        setNeighborhood(job.neighborhood ?? '')
        setStreet(job.street ?? '')
        setStreetNo(job.streetNo ?? '')
        setOpenAddress(job.openAddress ?? '')
      })
      .catch(loadError => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('common.error'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingJob(false)
      })

    return () => {
      cancelled = true
    }
  }, [editJobId, message.citizenHandle, message.content, t])

  // Konuşma penceresinde de diğer birimlere kurum içi ileti gönderilebilsin diye vatandaşın
  // güncel talep/birim bilgisi (ticket listesi) çekilir (card #1512).
  // Talep Etiketi de aynı detaydan gelir (card #1865).
  // (citizenConversationId effect above already loads conversationDetail + requestLabel)
  const internalDepartmentOptions = useMemo(() => {
    const activeStatuses = new Set(['Draft', 'PendingOwnerApproval', 'PendingExternalApproval', 'RevisionRequested', 'Active'])
    const options = new Map<string, string>()
    for (const ticket of conversationDetail?.tickets ?? []) {
      if (!ticket.jobStatus || !activeStatuses.has(ticket.jobStatus) || !ticket.departmentId || !ticket.departmentName) continue
      options.set(ticket.departmentId, ticket.departmentName)
    }
    return Array.from(options, ([departmentId, name]) => ({ departmentId, name }))
  }, [conversationDetail?.tickets])

  useEffect(() => {
    if (!internalDepartmentId) return
    if (!internalDepartmentOptions.some(department => department.departmentId === internalDepartmentId)) {
      setInternalDepartmentId('')
    }
  }, [internalDepartmentId, internalDepartmentOptions])

  const handleSendInternal = async (text: string) => {
    const targetTicket = conversationDetail?.tickets.find(ticket => ticket.departmentId === internalDepartmentId)
    if (!targetTicket || sendingInternal) return
    setSendingInternal(true)
    try {
      await api.addInternalConversationMessage(targetTicket.socialMessageId, internalDepartmentId, text)
      invalidateConversations(queryClient, citizenConversationId ?? undefined, targetTicket.socialMessageId)
    } finally {
      setSendingInternal(false)
    }
  }

  // Vatandaş talebi operatörün kendi birimine de yönlendirilebilir (card #1090);
  // sahip birim hedef listesinden çıkarılmaz.
  const targetDepartmentOptions = useMemo(
    () => departments.filter(department => !isPresidencyLevelDepartment(department)),
    [departments],
  )

  const districtId = useMunicipalityDistrictId()
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(districtId), [districtId])
  const priorityOptions = useMemo(() => prioritySelectOptions(t), [t])
  const targetDepartmentSelectOptions = useMemo(
    () => targetDepartmentOptions.map(department => ({ value: department.departmentId, label: department.name })),
    [targetDepartmentOptions],
  )
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(neighborhoods), [neighborhoods])

  const addPendingFile = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setFileError(validationError)
      return
    }
    setPendingFiles(current => {
      if (exceedsAttachmentTotalLimit(sumFileSizes(current), file.size)) {
        setFileError('Dosyaların toplam boyutu 5 MB\'ı aşamaz.')
        return current
      }
      if (current.some(existing => existing.name === file.name && existing.size === file.size)) {
        return current
      }
      setFileError(null)
      return [...current, file]
    })
  }

  const downloadPendingFile = (file: File) => {
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const uploadPendingFiles = async (jobId: string) => {
    for (const file of pendingFiles) {
      await api.uploadJobAttachment(jobId, file)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!ownerDepartmentId) {
      setError(t('social.ownerDepartmentRequired', 'Önce bir müdürlük seçin.'))
      return
    }
    if (!citizenHandle.trim()) {
      setError(t('settings.citizen.citizenHandleRequired', 'Vatandaş / Gönderen gereklidir.'))
      return
    }
    const trimmedPhone = citizenPhone.replace(/\D/g, '')
    if (trimmedPhone.length !== 10) {
      setError(t('settings.citizen.citizenPhoneInvalid', 'Vatandaş telefon numarası 10 haneli olmalıdır.'))
      return
    }
    if (!trimmedPhone.startsWith('5')) {
      setError(t('settings.citizen.citizenPhoneMustStartWith5', 'Telefon numarası 5 ile başlamalıdır.'))
      return
    }
    if (!targetDepartmentId) {
      setError(t('requests.create.targetDepartmentRequired', 'Talebin gideceği birim seçilmelidir.'))
      return
    }
    if (!hasRichTextContent(description)) {
      setError(t('tasks.newRequest.descriptionRequired', 'Açıklama gereklidir.'))
      return
    }
    if (neighborhood.trim() && !street.trim()) {
      setError(t('address.streetRequired', 'Mahalle seçildiğinde Cadde / Sokak zorunludur.'))
      return
    }
    if (neighborhood.trim() && !streetNo.trim()) {
      setError(t('address.streetNoRequired', 'Mahalle seçildiğinde No zorunludur.'))
      return
    }

    if (!confirmedSubmit) {
      setConfirmDialog({
        title: isEditMode ? 'Vatandaş Talebi Güncelle' : 'Vatandaş Talebi Oluştur',
        message: isEditMode
          ? t('requests.create.confirmUpdate', 'Bu talebi güncellemek istediğinize emin misiniz?')
          : t('requests.create.confirmCreate', 'Bu talebi oluşturmak istediğinize emin misiniz?'),
        titleCompact: true,
        titleDivider: true,
        confirmLabel: isEditMode ? t('common.update', 'Güncelle') : t('tasks.newRequest.submit', 'Talep Oluştur'),
        cancelLabel: t('common.cancel', 'İptal'),
        variant: 'success',
        onConfirm: () => {
          setConfirmedSubmit(true)
          window.setTimeout(() => (document.getElementById('citizen-request-form') as HTMLFormElement | null)?.requestSubmit(), 0)
        },
      })
      return
    }

    setSaving(true)
    setError(null)
    const trimmedHandle = citizenHandle.trim()
    const trimmedTitle = title.trim() || trimmedHandle
    try {
      if (isEditMode && editJobId) {
        await api.updateJob(editJobId, {
          title: trimmedTitle,
          description: description.trim(),
          priority,
          startDateUtc: toApiDateTime(startDateUtc),
          dueDateUtc: toApiDateTime(dueDateUtc),
          isProject: false,
          citizenName: trimmedHandle,
          citizenPhone: trimmedPhone,
          neighborhood: neighborhood || null,
          street: normalizeTitleCaseField(street),
          streetNo: streetNo.trim() || null,
          openAddress: normalizeTitleCaseField(openAddress),
          targetDepartmentIds: [targetDepartmentId],
        })
        await api.updateSocialMessage(message.socialMessageId, {
          channel: message.channel,
          citizenHandle: trimmedHandle,
          content: description.trim(),
          category: message.category ?? undefined,
          latitude: message.latitude ?? undefined,
          longitude: message.longitude ?? undefined,
        })
        if (pendingFiles.length > 0) {
          await uploadPendingFiles(editJobId)
        }
        invalidateSocialMessages(queryClient, message.socialMessageId)
        invalidateJobs(queryClient, editJobId)
        onCreated()
        return
      }

      let convertMessageId = message.socialMessageId
      const shouldCreateFreshMessage = forceNewRequest && Boolean(citizenConversationId || message.jobId)
      if (shouldCreateFreshMessage) {
        convertMessageId = await api.createSocialMessage({
          channel: message.channel,
          citizenHandle: trimmedPhone.length === 10 ? `90${trimmedPhone}` : trimmedPhone,
          content: description.trim(),
          category: message.category ?? undefined,
          latitude: message.latitude ?? undefined,
          longitude: message.longitude ?? undefined,
          citizenConversationId: citizenConversationId ?? undefined,
        })
      }

      const job = await api.convertSocialMessageToJob(convertMessageId, {
        title: trimmedTitle,
        description: description.trim(),
        ownerDepartmentId,
        priority,
        requestType: 'ExternalUnit',
        targetDepartmentIds: [targetDepartmentId],
        isProject: false,
        startDateUtc: toApiDateTime(startDateUtc),
        dueDateUtc: toApiDateTime(dueDateUtc),
        neighborhood: neighborhood || null,
        street: normalizeTitleCaseField(street),
        streetNo: streetNo.trim() || null,
        openAddress: normalizeTitleCaseField(openAddress),
        citizenName: trimmedHandle,
        citizenPhone: trimmedPhone,
      })
      await api.updateSocialMessage(convertMessageId, {
        channel: message.channel,
        citizenHandle: trimmedHandle,
        content: description.trim(),
        category: message.category ?? undefined,
        latitude: message.latitude ?? undefined,
        longitude: message.longitude ?? undefined,
      })
      if (pendingFiles.length > 0) {
        await uploadPendingFiles(job.jobId)
      }
      invalidateSocialMessages(queryClient, convertMessageId)
      if (citizenConversationId) {
        invalidateConversations(queryClient, citizenConversationId, convertMessageId)
      }
      onCreated()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('common.error'))
      setSaving(false)
    } finally {
      setConfirmedSubmit(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        className="detail-modal-shell flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-3 text-white"
          style={{ background: 'linear-gradient(135deg, var(--color-header-from), var(--color-header-to))' }}
        >
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-white">
              {message.channel === 'WhatsApp'
                ? t('social.whatsappCitizenRequestTitle', 'WhatsApp Konuşması - Vatandaş Talebi Oluştur')
                : t('jobs.detail.citizenRequest', 'Vatandaş Talebi')}
            </h2>
            {message.channel === 'WhatsApp' ? (
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-medium text-white/90">
                <img src="/icons/whatsapp.webp" alt="" className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {[savedCitizenName, citizenPhone.replace(/\D/g, '').length >= 10 ? formatDisplayPhone(citizenPhone) : null]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              </div>
            ) : null}
          </div>
          <ModalCloseButton
            onClick={handleClose}
            label={t('common.close', 'Kapat')}
            className="size-7 shrink-0 text-white/80 hover:bg-red-50 hover:text-red-600"
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <div className="min-h-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
            <ConversationPanel
              socialMessageId={message.socialMessageId}
              citizenHandle={message.citizenHandle}
              citizenPhone={citizenPhone}
              citizenName={savedCitizenName || undefined}
              headerMode="phone"
              hideHeader
              showCloseButton={false}
              onClose={handleClose}
              // Yalnızca Vatandaş Operatörü beklemedeki mesajı vatandaşa iletebilir — card #1091.
              canSendPending={user?.role === 'Operator' || user?.role === 'SystemAdmin'}
              onReplySent={() => { /* talep oluşturma akışını etkilemez */ }}
              onAddMediaAsAttachment={addPendingFile}
              enableWhatsAppFileAttachment
              internalDepartmentOptions={citizenConversationId ? internalDepartmentOptions : undefined}
              internalDepartmentId={internalDepartmentId}
              onInternalDepartmentIdChange={setInternalDepartmentId}
              onSendInternal={handleSendInternal}
              sendingInternal={sendingInternal}
              compactActions
              compactBubbles
            />
          </div>

          <form id="citizen-request-form" className="citizen-request-form flex min-h-0 flex-col overflow-y-auto p-4" onSubmit={handleSubmit}>
            {loadingJob ? (
              <div className="flex flex-1 items-center justify-center py-12 text-sm text-slate-500">{t('common.loading')}</div>
            ) : (
            <div className="grid gap-2.5">
              {editCitizenRequestNumber ? (
                <div className="text-sm font-extrabold text-orange-500 underline decoration-orange-500 decoration-2 underline-offset-4">
                  {t('social.citizenRequestNumberLabel', 'Vatandaş Talep No')}: {editCitizenRequestNumber}
                </div>
              ) : null}
              <div className="grid gap-2.5 md:grid-cols-2">
                <label className="job-field">
                  <span className="job-field-label">
                    {t('settings.citizen.citizenName', 'Vatandaş Adı')}{' '}
                    <span className="normal-case text-xs font-normal text-slate-400">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span>{' '}
                    <span className="text-red-500">*</span>
                  </span>
                  <DeferredComposerInput
                    className="field-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    value={citizenHandle}
                    maxLength={50}
                    required
                    disabled={citizenNameLocked}
                    placeholder={t('settings.citizen.citizenNamePlaceholder', 'Vatandaş ismi')}
                    onChange={setCitizenHandle}
                  />
                </label>
                <label className="job-field">
                  <span className="job-field-label">
                    {t('settings.citizen.citizenPhone', 'Vatandaş Telefon No')}{' '}
                    {/* WhatsApp'tan gelen numara salt okunur; "başında 0 olmadan" giriş ipucu gösterilmez (card #1555). */}
                    {!citizenPhoneLocked ? (
                      <span className="normal-case text-xs font-normal text-slate-400">{t('settings.citizen.citizenPhoneHint', '(başında 0 olmadan ekleyin)')}</span>
                    ) : null}{' '}
                    <span className="text-red-500">*</span>
                  </span>
                  <DeferredComposerInput
                    className="field-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    value={citizenPhone}
                    maxLength={10}
                    required
                    disabled={citizenPhoneLocked}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="5XXXXXXXXX"
                    onChange={value => setCitizenPhone(value.replace(/\D/g, '').slice(0, 10))}
                  />
                </label>
              </div>

              <div className="grid gap-2.5 md:grid-cols-3">
                <div className="job-field min-w-0">
                  <label className="job-field-label" htmlFor="citizen-req-title">
                    {t('tasks.newRequest.title', 'Talep Başlığı')}{' '}
                    <span className="normal-case text-xs font-normal text-slate-400">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span>{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <DeferredComposerTextarea
                    id="citizen-req-title"
                    className="field-textarea field-textarea--compact citizen-request-title-textarea"
                    value={title}
                    maxLength={50}
                    onChange={setTitle}
                    required
                    rows={2}
                  />
                </div>

                <div className="job-field">
                  <label className="job-field-label" htmlFor="citizen-req-target">
                    {t('jobs.form.destinationUnit', 'Gideceği Birim')} <span className="text-red-500">*</span>
                  </label>
                  <SingleSelectDropdown
                    options={targetDepartmentSelectOptions}
                    value={targetDepartmentId}
                    onChange={setTargetDepartmentId}
                    placeholder={t('requests.create.targetDepartmentsPlaceholder', 'Departman seçiniz')}
                    menuWidth={300}
                  />
                </div>

                <div className="job-field">
                  <label className="job-field-label" htmlFor="citizen-req-priority">{t('jobs.form.priority', 'Öncelik')}</label>
                  <SingleSelectDropdown
                    options={priorityOptions}
                    value={priority}
                    onChange={setPriority}
                    placeholder={t('jobs.form.priority', 'Öncelik')}
                  />
                </div>
              </div>

              <div className="job-field">
                <span className="job-field-label">{t('whatsapp.label', 'Talep Etiketi')}</span>
                <div className="flex items-center gap-2">
                  <input
                    className="field-input citizen-request-tag-input min-w-0 flex-1 text-xs disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    value={requestLabel}
                    readOnly
                    disabled
                    placeholder={t('whatsapp.requestTagPlaceholder', 'Talep Etiketi seçiniz...')}
                  />
                  {canManageRequestTags ? (
                    <>
                      <RequestTagPicker
                        smallButtonText
                        tags={requestTags}
                        selectedName={requestLabel}
                        onSelect={label => { void handleRequestLabelSelect(label) }}
                        onClear={() => { void handleRequestLabelSelect('') }}
                      />
                      <RequestTagAddButton onChanged={() => { void loadRequestTags() }} />
                    </>
                  ) : null}
                </div>
              </div>

              <div className="job-field min-h-0">
                <span className="job-field-label">{t('jobs.form.description', 'Açıklama')} <span className="normal-case text-xs font-normal text-slate-400">(max 400 karakter)</span> <span className="text-red-500">*</span></span>
                <RichTextEditor value={description} onChange={setDescription} required minHeight="min-h-24" />
              </div>

              <div className="job-field">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-stretch">
                  <label className="job-field grid gap-1">
                    <span className="job-field-label">{t('address.neighborhoodLabel', 'Mahalle')}</span>
                    <SingleSelectDropdown
                      searchable
                      options={neighborhoodOptions}
                      value={neighborhood}
                      onChange={nextNeighborhood => {
                        setNeighborhood(nextNeighborhood)
                        if (!nextNeighborhood) {
                          setStreet('')
                          setStreetNo('')
                          setOpenAddress('')
                        }
                      }}
                      placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
                    />
                  </label>
                  <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2">
                    <label className="job-field grid gap-1">
                      <span className="job-field-label">
                        {t('address.streetLabel', 'Cadde / Sokak')}
                        {neighborhood ? <span className="text-red-500"> *</span> : null}
                      </span>
                      <DeferredComposerInput
                        className="field-input address-street-input citizen-request-street-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
                        maxLength={ADDRESS_STREET_MAX_LENGTH}
                        value={street}
                        onChange={setStreet}
                        onBlur={() => setStreet(normalizeTitleCaseField(street) ?? '')}
                        disabled={!neighborhood}
                        required={Boolean(neighborhood)}
                      />
                    </label>
                    <label className="job-field grid gap-1">
                      <span className="job-field-label">
                        {t('address.streetNoLabel', 'No')}
                        {neighborhood ? <span className="text-red-500"> *</span> : null}
                      </span>
                      <DeferredComposerInput
                        className="field-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        placeholder={t('address.streetNoPlaceholder', 'ör. 12')}
                        maxLength={ADDRESS_STREET_NO_MAX_LENGTH}
                        value={streetNo}
                        onChange={value => setStreetNo(normalizeStreetNo(value))}
                        disabled={!neighborhood}
                        required={Boolean(neighborhood)}
                      />
                    </label>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] md:items-stretch">
                  <label className="job-field flex min-h-0 flex-col gap-1">
                    <span className="job-field-label">
                      {t('address.openAddressLabel', 'Açık Adres')}
                      {neighborhood ? (
                        <span className="ml-1 normal-case text-xs font-normal text-slate-400">{t('address.openAddressMaxHint', '(max 100 karakter)')}</span>
                      ) : null}
                    </span>
                    <DeferredComposerTextarea
                      className="field-textarea field-textarea--compact address-open-textarea citizen-request-open-address h-[5rem] min-h-[5rem] flex-1 resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
                      maxLength={ADDRESS_OPEN_ADDRESS_MAX_LENGTH}
                      value={openAddress}
                      onChange={setOpenAddress}
                      onBlur={() => setOpenAddress(normalizeTitleCaseField(openAddress) ?? '')}
                      disabled={!neighborhood}
                    />
                  </label>
                  <div className="job-field flex min-h-0 flex-col gap-1">
                    <span className="job-field-label">{t('attachments.label', 'Dosya / Görsel Ekle (opsiyonel)')}</span>
                    <div className="flex min-h-[5rem] items-start gap-2">
                      <label className={`inline-flex h-[1.875rem] w-[6.35rem] shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-white px-1.5 text-[11px] font-semibold leading-none text-slate-800 ring-1 ring-[var(--color-border)] transition-colors hover:bg-slate-50 ${saving ? 'pointer-events-none opacity-60' : ''}`}>
                        <Paperclip className="size-3.5 shrink-0 text-emerald-700" />
                        {t('attachments.addFile', 'Dosya ekle')}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ATTACHMENT_FILE_ACCEPT}
                          multiple
                          className="hidden"
                          disabled={saving}
                          onChange={event => {
                            for (const file of Array.from(event.target.files ?? [])) {
                              addPendingFile(file)
                            }
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                        />
                      </label>
                      <div className="min-h-[5rem] max-h-[5rem] min-w-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-3 py-2">
                        {pendingFiles.length === 0 ? (
                          <p className="text-xs text-slate-400">{t('attachments.pendingEmpty', 'Henüz dosya seçilmedi.')}</p>
                        ) : (
                          <ul className="space-y-1 text-xs">
                            {pendingFiles.map((file, idx) => {
                              const Icon = pendingFileIcon(file.name)
                              return (
                              <li key={`${file.name}-${idx}`} className="flex min-w-0 items-start gap-2">
                                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700">
                                  <Icon className="size-3" aria-hidden="true" />
                                </span>
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 break-words text-left text-[10px] font-normal text-slate-900 hover:text-slate-700"
                                  onClick={() => downloadPendingFile(file)}
                                >
                                  {file.name}
                                </button>
                                <button
                                  type="button"
                                  className="shrink-0 text-[11px] font-medium text-red-500 hover:text-red-600"
                                  onClick={() => setPendingFiles(current => current.filter((_, i) => i !== idx))}
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
                    {fileError ? <div className="mt-1 text-xs text-red-500">{fileError}</div> : null}
                  </div>
                </div>
              </div>

              {error ? <div className="error">{error}</div> : null}

              <Button type="submit" disabled={saving || loadingJob} className="gap-2">
                <Send className="size-4" />
                {saving
                  ? t('common.saving', 'Kaydediliyor...')
                  : isEditMode
                    ? t('common.update', 'Güncelle')
                    : t('tasks.newRequest.submit', 'Talep Oluştur')}
              </Button>
            </div>
            )}
          </form>
        </div>
      </div>
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>,
    document.body
  )
}
