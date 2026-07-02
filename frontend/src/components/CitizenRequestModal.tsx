import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileImage, FileText, Paperclip, Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateJobs, invalidateConversations, invalidateSocialMessages } from '../api/cacheInvalidation'
import { getActiveDepartmentId } from '../api/http'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui/button'
import { ConfirmDialog, type ConfirmDialogState } from './ui/confirm-dialog'
import { RichTextEditor } from './ui/RichTextEditor'
import { ConversationPanel } from './ConversationPanel'
import type { Department, SocialMessage } from '../types/platform'
import { isPresidencyLevelDepartment } from '../utils/departments'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../data/izmir-locations'
import { formatCitizenRequestNumber } from '../utils/citizenRequests'
import { getLocale } from '../utils/localization'

interface CitizenRequestModalProps {
  message: SocialMessage
  departments: Department[]
  editJobId?: string | null
  forceNewRequest?: boolean
  citizenConversationId?: string | null
  onClose: () => void
  onCreated: () => void
}

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']
const ACCEPT_ATTR = ALLOWED_EXTENSIONS.join(',')
const MAX_FILE_SIZE = 5 * 1024 * 1024

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function pendingFileIcon(name: string) {
  return ['.jpg', '.jpeg', '.png'].includes(fileExtension(name)) ? FileImage : FileText
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

  const [citizenHandle, setCitizenHandle] = useState(() => (
    forceNewRequest && !editJobId ? '' : resolveInitialCitizenName(message)
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
  const [openAddress, setOpenAddress] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingJob, setLoadingJob] = useState(isEditMode)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [confirmedSubmit, setConfirmedSubmit] = useState(false)

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
    setOpenAddress('')
    setPendingFiles([])
    setFileError(null)
    setError(null)
    setCitizenHandle('')
    setCitizenPhone(resolveInitialCitizenPhone(message))
  }, [forceNewRequest, editJobId, message])

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

  // Vatandaş talebi operatörün kendi birimine de yönlendirilebilir (card #1090);
  // sahip birim hedef listesinden çıkarılmaz.
  const targetDepartmentOptions = useMemo(
    () => departments.filter(department => !isPresidencyLevelDepartment(department)),
    [departments],
  )

  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(getSavedDistrictId()), [])

  const addPendingFile = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setFileError(validationError)
      return
    }
    setFileError(null)
    setPendingFiles(current => {
      if (current.some(existing => existing.name === file.name && existing.size === file.size)) {
        return current
      }
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
    if (!targetDepartmentId) {
      setError(t('requests.create.targetDepartmentRequired', 'Talebin gideceği birim seçilmelidir.'))
      return
    }
    if (!hasRichTextContent(description)) {
      setError(t('tasks.newRequest.descriptionRequired', 'Açıklama gereklidir.'))
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
          street: street || null,
          openAddress: openAddress || null,
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
        street: street || null,
        openAddress: openAddress || null,
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
            <div className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-white/70">
              {t('social.title', 'Vatandaş Talepleri')}
            </div>
            <h2 className="text-base font-extrabold text-white">
              {message.channel === 'WhatsApp'
                ? t('social.whatsappCitizenRequestTitle', 'WhatsApp Konuşması - Vatandaş Talebi Oluştur')
                : t('jobs.detail.citizenRequest', 'Vatandaş Talebi')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
            aria-label={t('common.close', 'Kapat')}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.44fr)_minmax(0,0.56fr)]">
          <div className="min-h-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
            <ConversationPanel
              socialMessageId={message.socialMessageId}
              citizenHandle={message.citizenHandle}
              citizenPhone={citizenPhone}
              headerMode="phone"
              onClose={onClose}
              // Yalnızca Vatandaş Operatörü beklemedeki mesajı vatandaşa iletebilir — card #1091.
              canSendPending={user?.role === 'Operator' || user?.role === 'SystemAdmin'}
              onReplySent={() => { /* talep oluşturma akışını etkilemez */ }}
              onAddMediaAsAttachment={addPendingFile}
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
                    {t('settings.citizen.citizenName', 'Vatandaş İsmi / Gönderen')}{' '}
                    <span className="field-hint">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span>{' '}
                    <span className="text-red-500">*</span>
                  </span>
                  <input
                    className="field-input"
                    value={citizenHandle}
                    maxLength={50}
                    required
                    placeholder={t('settings.citizen.citizenNamePlaceholder', 'Vatandaş ismi')}
                    onChange={event => setCitizenHandle(event.target.value)}
                  />
                </label>
                <label className="job-field">
                  <span className="job-field-label">
                    {t('settings.citizen.citizenPhone', 'Vatandaş Telefon No')}{' '}
                    <span className="field-hint">{t('settings.citizen.citizenPhoneHint', '(başında 0 olmadan ekleyin)')}</span>{' '}
                    <span className="text-red-500">*</span>
                  </span>
                  <input
                    className="field-input"
                    value={citizenPhone}
                    maxLength={10}
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="5XXXXXXXXX"
                    onChange={event => setCitizenPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </label>
              </div>

              <div className="grid gap-2.5 md:grid-cols-3">
                <div className="job-field">
                  <label className="job-field-label" htmlFor="citizen-req-title">
                    {t('tasks.newRequest.title', 'Talep Başlığı')}{' '}
                    <span className="field-hint">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span>{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="citizen-req-title"
                    className="field-input"
                    value={title}
                    maxLength={50}
                    onChange={event => setTitle(event.target.value)}
                    required
                  />
                </div>

                <div className="job-field">
                  <label className="job-field-label" htmlFor="citizen-req-target">
                    {t('jobs.form.targetDepartment', 'Talebin Gideceği Birim')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="citizen-req-target"
                    className="field-select"
                    value={targetDepartmentId}
                    onChange={event => setTargetDepartmentId(event.target.value)}
                  >
                    <option value="">{t('requests.create.targetDepartmentsPlaceholder', 'Departman seçiniz')}</option>
                    {targetDepartmentOptions.map(department => (
                      <option key={department.departmentId} value={department.departmentId}>{department.name}</option>
                    ))}
                  </select>
                </div>

                <div className="job-field">
                  <label className="job-field-label" htmlFor="citizen-req-priority">{t('jobs.form.priority', 'Öncelik')}</label>
                  <select id="citizen-req-priority" className="field-select" value={priority} onChange={event => setPriority(event.target.value)}>
                    <option value="VeryHigh">{t('enum.priority.VeryHigh', 'Çok Yüksek')}</option>
                    <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                    <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
                  </select>
                </div>
              </div>

              <div className="job-field min-h-0">
                <span className="job-field-label">{t('jobs.form.description', 'Açıklama')} <span className="text-red-500">*</span></span>
                <RichTextEditor value={description} onChange={setDescription} required minHeight="min-h-28" />
              </div>

              <div className="job-field">
                <div className="grid gap-2 md:grid-cols-2 md:items-stretch">
                  <label className="job-field grid gap-1">
                    <span className="job-field-label">{t('address.neighborhoodLabel', 'Mahalle')}</span>
                    <select
                      className="field-select"
                      value={neighborhood}
                      onChange={event => {
                        const nextNeighborhood = event.target.value
                        setNeighborhood(nextNeighborhood)
                        if (!nextNeighborhood) {
                          setStreet('')
                          setOpenAddress('')
                        }
                      }}
                    >
                      <option value="">{t('address.neighborhoodPlaceholder', 'Mahalle seçin')}</option>
                      {neighborhoods.map(item => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="job-field grid gap-1">
                    <span className="job-field-label">{t('address.streetLabel', 'Cadde / Sokak / Bulvar')}</span>
                    <input
                      className="field-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
                      value={street}
                      onChange={event => setStreet(event.target.value)}
                      disabled={!neighborhood}
                    />
                  </label>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] md:items-stretch">
                  <label className="job-field flex min-h-0 flex-col gap-1">
                    <span className="job-field-label">{t('address.openAddressLabel', 'Açık Adres')}</span>
                    <textarea
                      className="field-textarea field-textarea--compact min-h-[5.5rem] flex-1 resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
                      value={openAddress}
                      onChange={event => setOpenAddress(event.target.value)}
                      disabled={!neighborhood}
                    />
                  </label>
                  <div className="job-field flex min-h-0 flex-col gap-1">
                    <span className="job-field-label">{t('attachments.label', 'Dosya / Fotoğraf Ekle (opsiyonel)')}</span>
                    <div className="flex min-h-[5.5rem] items-stretch gap-2">
                      <label className={`inline-flex h-[2.0625rem] w-[7.6rem] shrink-0 cursor-pointer items-center justify-center gap-1 self-end rounded-lg bg-white px-2 text-xs font-semibold text-slate-800 ring-1 ring-[var(--color-border)] transition-colors hover:bg-slate-50 ${saving ? 'pointer-events-none opacity-60' : ''}`}>
                        <Paperclip className="size-3.5" />
                        {t('attachments.addFile', 'Dosya ekle')}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept={ACCEPT_ATTR}
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
                      <div className="min-h-[5.5rem] max-h-[5.5rem] min-w-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-3 py-2">
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
