import { ClipboardList, Paperclip, Send } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateTasks } from '../api/cacheInvalidation'
import { Button } from '../components/ui/button'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../data/izmir-locations'

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

function validateFile(file: File): string | null {
  if (!ALLOWED_EXTENSIONS.includes(fileExtension(file.name))) {
    return 'Yalnızca resim (JPG, PNG), PDF ve Office dosyaları yüklenebilir.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Dosya boyutu 5 MB\'ı aşamaz.'
  }
  return null
}

export function RoutineTaskPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(getSavedDistrictId()), [])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(current => ({ ...current, [key]: value }))

  const addFiles = (files: FileList | null) => {
    if (!files) return
    setFileError(null)
    for (const file of Array.from(files)) {
      const err = validateFile(file)
      if (err) { setFileError(err); return }
      setPendingFiles(prev => [...prev, file])
    }
  }

  const executeCreate = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const task = await api.createRoutineTask({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        dueDateUtc: form.dueDateUtc ? new Date(form.dueDateUtc).toISOString() : null,
        notes: null,
        neighborhood: form.neighborhood || null,
        street: form.street || null,
        openAddress: form.openAddress || null,
      })
      for (const file of pendingFiles) {
        await api.uploadTaskAttachment(task.taskId, file)
      }
      invalidateTasks(queryClient)
      navigate('/my-tasks?view=all')
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
      title: t('nav.createRoutineTask', 'Rutin Görev Oluştur'),
      message: t('routineTask.createConfirm', 'Bu görevi oluşturmak istediğinize emin misiniz?'),
      titleCompact: true,
      titleDivider: true,
      confirmLabel: t('routineTask.createConfirmButton', 'Görev Oluştur'),
      cancelLabel: t('common.cancel', 'İptal'),
      variant: 'success',
      onConfirm: () => { void executeCreate() },
    })
  }

  const canSubmit = !submitting && form.title.trim() !== '' && form.description.trim() !== ''

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('nav.myTasks', 'Görevlerim')}</div>
            <h1 className="page-title">{t('nav.createRoutineTask', 'Rutin Görev Oluştur')}</h1>
            <p className="page-subtitle text-base">{t('routineTask.subtitle', 'Onay gerektirmeyen kişisel görev')}</p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="section-card routine-task-form routine-task-form--readable grid gap-4 xl:grid-cols-2">
        {/* Banner */}
        <div className="xl:col-span-2 flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
            <ClipboardList className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">
              {t('nav.createRoutineTask', 'Rutin Görev Oluştur')}
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
              <select
                id="routine-priority"
                className="field-select"
                value={form.priority}
                onChange={e => set('priority', e.target.value)}
              >
                <option value="VeryHigh">{t('enum.priority.VeryHigh', 'Çok Yüksek')}</option>
                <option value="High">{t('enum.priority.High', 'Yüksek')}</option>
                <option value="Normal">{t('enum.priority.Normal', 'Normal')}</option>
              </select>
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
                  <select
                    className="field-select"
                    value={form.neighborhood}
                    onChange={e => set('neighborhood', e.target.value)}
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
                    onChange={e => set('street', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2 lg:grid-cols-2 lg:items-stretch">
                <label className="grid min-h-0 gap-1">
                  <span className="text-sm font-semibold text-slate-500">{t('address.openAddressLabel', 'Açık Adres')}</span>
                  <textarea
                    className="field-textarea h-full min-h-[5.5rem] resize-none"
                    placeholder={t('address.openAddressPlaceholder', 'Bina no, kat, daire bilgisi giriniz...')}
                    value={form.openAddress}
                    onChange={e => set('openAddress', e.target.value)}
                  />
                </label>

                <div className="job-field min-h-0">
                  <span className="job-field-label">{t('attachments.label', 'Dosya / Fotoğraf Ekle (opsiyonel)')}</span>
                  <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
                    <div
                      role="button"
                      tabIndex={submitting ? -1 : 0}
                      className={`request-photo-dropzone flex min-h-[5.5rem] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-3 text-center text-sm transition-colors ${submitting ? 'pointer-events-none opacity-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                      onClick={() => !submitting && fileInputRef.current?.click()}
                      onKeyDown={event => event.key === 'Enter' && !submitting && fileInputRef.current?.click()}
                      onDragOver={event => event.preventDefault()}
                      onDrop={event => {
                        event.preventDefault()
                        if (submitting) return
                        addFiles(event.dataTransfer.files)
                      }}
                    >
                      <Paperclip className="mb-1 size-4 text-slate-400" />
                      <span className="font-semibold text-slate-700">{t('attachments.dragHint', 'Dosyayı buraya sürükleyin veya tıklayın')}</span>
                      <span className="mt-0.5 text-xs text-slate-400">{t('attachments.uploadHint', 'JPG, PNG, PDF, Office — maks. 5 MB')}</span>
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
              </div>
            </div>
          </div>
        </div>

        {/* Sağ sütun: Açıklama */}
        <div className="grid content-start gap-3">
          <div className="job-field min-h-0">
            <label className="job-field-label" htmlFor="routine-desc">
              {t('tasks.newRequest.description', 'Açıklama')} <span className="text-red-500">*</span>
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
            <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={submitting}>
              {t('common.cancel', 'İptal')}
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-2">
              <Send className="size-4" />
              {submitting ? t('common.loading', 'Kaydediliyor...') : t('routineTask.submit', 'Görevi Oluştur')}
            </Button>
          </div>
        </div>
      </form>
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
