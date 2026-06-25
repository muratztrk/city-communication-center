import { ClipboardList, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
import { RichTextEditor } from '../components/ui/RichTextEditor'
import { getNeighborhoodsForDistrict, getSavedDistrictId } from '../data/izmir-locations'

interface ActivityType {
  activityTypeId: string
  name: string
  sortOrder: number
}

interface FormState {
  activityTypeId: string
  description: string
  neighborhood: string
  street: string
  openAddress: string
}

const INITIAL: FormState = {
  activityTypeId: '',
  description: '',
  neighborhood: '',
  street: '',
  openAddress: '',
}

export function EDevletActivityPlanPage() {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [typeName, setTypeName] = useState('')
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(getSavedDistrictId()), [])

  useEffect(() => {
    void api.getEDevletActivityTypes()
      .then(setActivityTypes)
      .catch(err => setError(err instanceof Error ? err.message : t('common.error')))
  }, [t])

  const reloadTypes = async () => {
    setActivityTypes(await api.getEDevletActivityTypes())
  }

  const handleSaveType = async () => {
    if (!typeName.trim()) return
    setError(null)
    try {
      if (editingTypeId) {
        await api.updateEDevletActivityType(editingTypeId, typeName.trim())
      } else {
        await api.createEDevletActivityType(typeName.trim())
      }
      setTypeName('')
      setEditingTypeId(null)
      await reloadTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const handleDeleteType = async (activityTypeId: string) => {
    setError(null)
    try {
      await api.deleteEDevletActivityType(activityTypeId)
      if (form.activityTypeId === activityTypeId) {
        setForm(current => ({ ...current, activityTypeId: '' }))
      }
      if (editingTypeId === activityTypeId) {
        setEditingTypeId(null)
        setTypeName('')
      }
      await reloadTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }

  const executeCreate = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await api.createEDevletDailyActivityPlan({
        activityTypeId: form.activityTypeId,
        description: form.description.trim(),
        neighborhood: form.neighborhood || null,
        street: form.street || null,
        openAddress: form.openAddress || null,
      })
      setForm(INITIAL)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.activityTypeId || !form.description.trim()) return
    setConfirmDialog({
      title: t('nav.edevletActivityPlan', 'e-Devlet Günlük Faaliyet Planı Oluştur'),
      message: t('edevletActivityPlan.createConfirm', 'Faaliyet planını kaydetmek istediğinize emin misiniz?'),
      confirmLabel: t('common.save', 'Kaydet'),
      cancelLabel: t('common.cancel', 'İptal'),
      variant: 'success',
      onConfirm: () => { void executeCreate() },
    })
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('nav.edevletActivityPlan', 'e-Devlet Günlük Faaliyet Planı')}</div>
            <h1 className="page-title">{t('nav.edevletActivityPlan', 'e-Devlet Günlük Faaliyet Planı Oluştur')}</h1>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={handleSubmit} className="section-card request-form request-form--readable grid gap-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
            <ClipboardList className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{t('nav.edevletActivityPlan', 'e-Devlet Günlük Faaliyet Planı Oluştur')}</h2>
            <p className="helper-copy mt-0.5 text-base leading-6">{t('edevletActivityPlan.formDescription', 'Günlük faaliyet planı kaydı oluşturun.')}</p>
          </div>
        </div>

        <div className="job-field">
          <label className="job-field-label" htmlFor="activity-type">{t('edevletActivityPlan.activityType', 'Faaliyet Tipi')} <span className="text-red-500">*</span></label>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <select
              id="activity-type"
              className="field-select"
              value={form.activityTypeId}
              onChange={event => setForm(current => ({ ...current, activityTypeId: event.target.value }))}
              required
            >
              <option value="">{t('edevletActivityPlan.activityTypePlaceholder', 'Faaliyet tipi seçin')}</option>
              {activityTypes.map(type => (
                <option key={type.activityTypeId} value={type.activityTypeId}>{type.name}</option>
              ))}
            </select>
            <Button type="button" variant="secondary" onClick={() => {
              const selected = activityTypes.find(type => type.activityTypeId === form.activityTypeId)
              if (!selected) return
              setEditingTypeId(selected.activityTypeId)
              setTypeName(selected.name)
            }}>
              {t('common.edit', 'Düzenle')}
            </Button>
            <Button type="button" variant="destructive" disabled={!form.activityTypeId} onClick={() => {
              if (!form.activityTypeId) return
              void handleDeleteType(form.activityTypeId)
            }}>
              {t('common.delete', 'Sil')}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="field-input min-w-[12rem] flex-1"
              placeholder={t('edevletActivityPlan.newTypePlaceholder', 'Yeni faaliyet tipi adı')}
              value={typeName}
              onChange={event => setTypeName(event.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => { void handleSaveType() }}>
              {editingTypeId ? t('common.update', 'Güncelle') : t('common.add', 'Ekle')}
            </Button>
            {editingTypeId ? (
              <Button type="button" variant="ghost" onClick={() => { setEditingTypeId(null); setTypeName('') }}>
                {t('common.cancel', 'İptal')}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="job-field">
          <span className="job-field-label">{t('address.sectionTitle', 'Adres Bilgisi')}</span>
          <div className="grid gap-2">
            <div className="grid gap-2 md:grid-cols-2">
              <select className="field-select" value={form.neighborhood} onChange={event => setForm(current => ({ ...current, neighborhood: event.target.value }))}>
                <option value="">{t('address.neighborhoodPlaceholder', 'Mahalle seçin')}</option>
                {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input className="field-input" placeholder={t('address.streetPlaceholder', 'Cadde / Sokak / Bulvar')} value={form.street} onChange={event => setForm(current => ({ ...current, street: event.target.value }))} />
            </div>
            <textarea className="field-input min-h-24" placeholder={t('address.openAddressPlaceholder', 'Açık adres')} value={form.openAddress} onChange={event => setForm(current => ({ ...current, openAddress: event.target.value }))} />
          </div>
        </div>

        <div className="job-field min-h-0">
          <span className="job-field-label">{t('tasks.detail.description', 'Açıklama')} <span className="text-red-500">*</span></span>
          <RichTextEditor
            value={form.description}
            onChange={description => setForm(current => ({ ...current, description }))}
            minHeight="min-h-48"
            placeholder={t('edevletActivityPlan.descriptionPlaceholder', 'Faaliyet açıklamasını girin...')}
          />
        </div>

        <Button type="submit" disabled={submitting || !form.activityTypeId} className="gap-2 self-start">
          <Send className="size-4" />
          {submitting ? t('common.saving', 'Kaydediliyor...') : t('common.save', 'Kaydet')}
        </Button>
      </form>

      {confirmDialog ? <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} /> : null}
    </div>
  )
}
