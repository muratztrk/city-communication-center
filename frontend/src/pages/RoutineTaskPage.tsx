import { ClipboardList, FileText, Image, Paperclip, Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateTasks } from '../api/cacheInvalidation'
import { Button } from '../components/ui/button'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../data/izmir-locations'
import { prioritySelectOptions, stringListSelectOptions } from '../utils/formDropdownOptions'
import { normalizeTitleCaseField } from '../utils/textNormalization'
import { ADDRESS_OPEN_ADDRESS_MAX_LENGTH, ADDRESS_STREET_MAX_LENGTH } from '../utils/addressLimits'

interface FormState {
  title: string
  description: string
  priority: string
  dueDateUtc: string
  neighborhood: string
  street: string
  openAddress: string
}

const INITIAL: FormState = {
  title: '',
  description: '',
  priority: 'Normal',
  dueDateUtc: '',
  neighborhood: '',
  street: '',
  openAddress: '',
}

// Talep oluşturma formuyla aynı dosya kuralları (card 575).
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']
const ACCEPT_ATTR = ALLOWED_EXTENSIONS.join(',')
const MAX_FILE_SIZE = 5 * 1024 * 1024

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function pendingFileIcon(name: string) {
  return ['.jpg', '.jpeg', '.png'].includes(fileExtension(name)) ? Image : FileText
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

function toDateTimePickerValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function RoutineTaskPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { taskId } = useParams()
  const queryClient = useQueryClient()
  const isEditMode = Boolean(taskId)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(isEditMode)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(getSavedDistrictId()), [])
  const priorityOptions = useMemo(() => prioritySelectOptions(t), [t])
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(neighborhoods), [neighborhoods])

  useEffect(() => {
    if (!taskId) return
    let cancelled = false
    setLoadingEdit(true)
    setError(null)
    void (async () => {
      try {
        const detail = await api.getTaskById(taskId)
        const job = await api.getJobById(detail.jobId)
        if (cancelled) return
        if (detail.jobSourceType !== 'Routine') {
          setError(t('routineTask.editNotRoutine', 'Bu görev rutin görev değil.'))
          return
        }
        if (detail.currentStatus === 'Completed' || detail.currentStatus === 'Cancelled') {
          setError(t('routineTask.editNotAllowed', 'Tamamlanmış veya iptal edilmiş rutin görev düzenlenemez.'))
          return
        }
        setForm({
          title: detail.title,
          description: detail.description,
          priority: detail.priority,
          dueDateUtc: toDateTimePickerValue(detail.dueDateUtc),
          neighborhood: job.neighborhood ?? '',
          street: job.street ?? '',
          openAddress: job.openAddress ?? '',
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('common.error'))
        }
      } finally {
        if (!cancelled) setLoadingEdit(false)
      }
    })()
    return () => { cancelled = true }
  }, [taskId, t])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(current => key === 'neighborhood' && !value
      ? { ...current, neighborhood: '', street: '', openAddress: '' }
      : { ...current, [key]: value })

  const addFiles = (files: FileList | null) => {
    if (!files) return
    setFileError(null)
    for (const file of Array.from(files)) {
      const err = validateFile(file)
      if (err) { setFileError(err); return }
      setPendingFiles(prev => [...prev, file])
    }
  }

  const executeSave = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        title: normalizeTitleCaseField(form.title) ?? '',
        description: form.description.trim(),
        priority: form.priority,
        dueDateUtc: form.dueDateUtc ? new Date(form.dueDateUtc).toISOString() : null,
        notes: null,
        neighborhood: normalizeTitleCaseField(form.neighborhood),
        street: normalizeTitleCaseField(form.street),
        openAddress: normalizeTitleCaseField(form.openAddress),
      }

      const task = isEditMode && taskId
        ? await api.updateRoutineTask(taskId, payload)
        : await api.createRoutineTask(payload)

      for (const file of pendingFiles) {
        await api.uploadTaskAttachment(task.taskId, file)
      }
      invalidateTasks(queryClient, task.taskId, task.jobId)
      navigate(isEditMode ? '/my-tasks?view=pending' : '/my-tasks?view=all')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) return
    setConfirmDialog({
      title: isEditMode
        ? t('routineTask.editTitle', 'Rutin Görev Düzenle')
        : t('nav.createRoutineTask', 'Rutin Görev Oluştur'),
      message: isEditMode
        ? t('routineTask.updateConfirm', 'Bu rutin görevi güncellemek istediğinize emin misiniz?')
        : t('routineTask.createConfirm', 'Bu görevi oluşturmak istediğinize emin misiniz?'),
      titleCompact: true,
      titleDivider: true,
      confirmLabel: isEditMode
        ? t('common.update', 'Güncelle')
        : t('routineTask.createConfirmButton', 'Görev Oluştur'),
      cancelLabel: t('common.cancel', 'İptal'),
      variant: 'success',
      onConfirm: () => { void executeSave() },
    })
  }
  const hasNeighborhood = form.neighborhood.trim().length > 0

  const canSubmit = !submitting && !loadingEdit && form.title.trim() !== '' && form.description.trim() !== ''
  const pageTitle = isEditMode
    ? t('routineTask.editTitle', 'Rutin Görev Düzenle')
    : t('nav.createRoutineTask', 'Rutin Görev Oluştur')

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('nav.myTasks', 'Görevlerim')}</div>
            <h1 className="page-title">{pageTitle}</h1>
            <p className="page-subtitle text-base">{t('routineTask.subtitle', 'Onay gerektirmeyen kişisel görev')}</p>
          </div>
        </div>
      </header>

      {loadingEdit ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
      <form onSubmit={handleSubmit} className="section-card routine-task-form routine-task-form--readable grid gap-4 xl:grid-cols-2">
        {/* Banner */}
        <div className="xl:col-span-2 flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
            <ClipboardList className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">
              {pageTitle}
            </h2>
            <p className="helper-copy mt-0.5 text-base leading-6">
              {t('routineTask.formDescription', 'Onay süreci gerektirmeyen kişisel görevler için kullanın.')}
            </p>
          </div>
        </div>

        {/* Sol sütun: Başlık + Öncelik + Bitiş Tarihi */}
        <div className="grid content-start gap-3">
          <div className="job-field">
            <label className="job-field-label" htmlFor="routine-title">
              {t('tasks.newRequest.title', 'Başlık')} <span className="text-xs font-normal text-slate-400">{t('tasks.newRequest.maxChars', '(max 50 karakter)')}</span> <span className="text-red-500">*</span>
            </label>
            <input
              id="routine-title"
              className="field-input"
              type="text"
              maxLength={50}
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder={t('routineTask.titlePlaceholder', 'Görev başlığını girin')}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="job-field">
              <label className="job-field-label" htmlFor="routine-priority">
                {t('tasks.newRequest.priority', 'Öncelik')}
              </label>
              <SingleSelectDropdown
                options={priorityOptions}
                value={form.priority}
                onChange={priority => set('priority', priority)}
                placeholder={t('tasks.newRequest.priority', 'Öncelik')}
              />
            </div>

            <div className="job-field">
              <label className="job-field-label" htmlFor="routine-due">
                {t('tasks.newRequest.dueDate', 'Bitiş Tarihi')}
                <span className="ml-1 text-slate-400">({t('common.optional', 'opsiyonel')})</span>
              </label>
              <DateTimePicker
                id="routine-due"
                value={form.dueDateUtc}
                onChange={v => set('dueDateUtc', v)}
              />
            </div>
          </div>

          {/* Adres Bilgisi + Dosya/Fotoğraf — Öncelik ve Bitiş Tarihi satırının hemen altında. */}
          <div className="job-field border-t border-slate-100 pt-4">
            <span className="job-field-label">{t('address.sectionTitle', 'Adres Bilgisi (İsteğe Bağlı)')}</span>
            <div className="grid gap-2">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-1">
                  <span className="text-sm font-semibold text-slate-500">{t('address.neighborhoodLabel', 'Mahalle')}</span>
                  <SingleSelectDropdown
                    openUp
                    searchable
                    options={neighborhoodOptions}
                    value={form.neighborhood}
                    onChange={neighborhood => set('neighborhood', neighborhood)}
                    placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-sm font-semibold text-slate-500">{t('address.streetLabel', 'Cadde / Sokak / Bulvar')}</span>
                  <input
                    className="field-input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
                    maxLength={ADDRESS_STREET_MAX_LENGTH}
                    value={form.street}
                    onChange={e => set('street', e.target.value)}
                    onBlur={() => set('street', normalizeTitleCaseField(form.street) ?? '')}
                    disabled={!hasNeighborhood}
                  />
                </div>
              </div>
              <div className="grid gap-2 lg:grid-cols-2 lg:items-stretch">
                <label className="grid min-h-0 gap-1">
                  <span className="text-sm font-semibold text-slate-500">{t('address.openAddressLabel', 'Açık Adres')}</span>
                  <textarea
                    className="field-textarea h-full min-h-[5.5rem] resize-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
                    maxLength={ADDRESS_OPEN_ADDRESS_MAX_LENGTH}
                    value={form.openAddress}
                    onChange={e => set('openAddress', e.target.value)}
                    onBlur={() => set('openAddress', normalizeTitleCaseField(form.openAddress) ?? '')}
                    disabled={!hasNeighborhood}
                  />
                </label>

                <div className="job-field min-h-0">
                  <span className="job-field-label">{t('attachments.label', 'Dosya / Fotoğraf Ekle (opsiyonel)')}</span>
                  <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-stretch">
                    <div className="flex items-end justify-start">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={submitting}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip className="size-3.5 text-emerald-700" aria-hidden="true" />
                        {t('attachments.addFile', 'Dosya ekle')}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPT_ATTR}
                        multiple
                        className="hidden"
                        disabled={submitting}
                        onChange={event => {
                          addFiles(event.target.files)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                      />
                    </div>
                    <div className="flex h-full min-h-[5.5rem] flex-col rounded-2xl border border-slate-200 bg-white px-3 py-2">
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
                              <span className="min-w-0 flex-1 break-words text-[10px] font-normal text-slate-900">{file.name}</span>
                              <button
                                type="button"
                                className="shrink-0 text-[11px] font-medium text-red-500 hover:text-red-600"
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
                  {fileError && <div className="mt-1 text-xs text-red-500">{fileError}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ sütun: Açıklama */}
        <div className="grid content-start gap-3">
          <div className="job-field min-h-0">
            <label className="job-field-label" htmlFor="routine-desc">
              {t('tasks.newRequest.description', 'Açıklama')} <span className="text-xs font-normal text-slate-400">(max 400 karakter)</span> <span className="text-red-500">*</span>
            </label>
            <RichTextEditor
              value={form.description}
              onChange={v => set('description', v)}
              placeholder={t('routineTask.descPlaceholder', 'Görev açıklamasını girin')}
              minHeight="min-h-48"
            />
          </div>
        </div>

        {/* Hata + işlem butonları */}
        <div className="grid gap-3 xl:col-span-2">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={submitting}>
              {t('common.dismiss', 'Vazgeç')}
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-2">
              <Send className="size-4" />
              {submitting
                ? t('common.loading', 'Kaydediliyor...')
                : isEditMode
                  ? t('common.update', 'Güncelle')
                  : t('routineTask.submit', 'Görevi Oluştur')}
            </Button>
          </div>
        </div>
      </form>
      )}
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
