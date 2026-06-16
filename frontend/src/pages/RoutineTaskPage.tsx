import { ClipboardList, Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { DateTimePicker } from '../components/ui/date-time-picker'
import { RichTextEditor } from '../components/ui/RichTextEditor'

interface FormState {
  title: string
  description: string
  priority: string
  dueDateUtc: string
}

const INITIAL: FormState = {
  title: '',
  description: '',
  priority: 'Normal',
  dueDateUtc: '',
}

export function RoutineTaskPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(current => ({ ...current, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await api.createRoutineTask({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        dueDateUtc: form.dueDateUtc ? new Date(form.dueDateUtc).toISOString() : null,
        notes: null,
      })
      navigate('/my-tasks?view=all')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
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

      <form onSubmit={handleSubmit} className="section-card grid gap-4 xl:grid-cols-2">
        {/* Banner */}
        <div className="xl:col-span-2 flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
            <ClipboardList className="size-5" />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-950">
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
              {t('tasks.newRequest.title', 'Başlık')} <span className="text-red-500">*</span>
            </label>
            <input
              id="routine-title"
              className="field-input"
              type="text"
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
        </div>

        {/* Sağ sütun: Açıklama + Butonlar */}
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
    </div>
  )
}
