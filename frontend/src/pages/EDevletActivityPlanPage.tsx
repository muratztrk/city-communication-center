import { Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
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
}

const INITIAL: FormState = {
  activityTypeId: '',
  description: '',
  neighborhood: '',
  street: '',
}

const TYPE_NAME_MAX = 50
const STREET_MAX = 50
const DESCRIPTION_MAX = 100

export function EDevletActivityPlanPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editingPlanId = searchParams.get('planId')
  const [form, setForm] = useState<FormState>(INITIAL)
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [typeName, setTypeName] = useState('')
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(Boolean(editingPlanId))
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(getSavedDistrictId()), [])

  useEffect(() => {
    void api.getEDevletActivityTypes()
      .then(setActivityTypes)
      .catch(err => setError(err instanceof Error ? err.message : t('common.error')))
  }, [t])

  useEffect(() => {
    if (!editingPlanId) return
    setLoadingPlan(true)
    void api.getEDevletDailyActivityPlan(editingPlanId)
      .then(plan => {
        setForm({
          activityTypeId: plan.activityTypeId,
          description: plan.description,
          neighborhood: plan.neighborhood ?? '',
          street: plan.street ?? '',
        })
      })
      .catch(err => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoadingPlan(false))
  }, [editingPlanId, t])

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

  const executeSave = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        activityTypeId: form.activityTypeId,
        description: form.description.trim(),
        neighborhood: form.neighborhood,
        street: form.street,
        openAddress: null,
      }
      if (editingPlanId) {
        await api.updateEDevletDailyActivityPlan(editingPlanId, payload)
        navigate('/edevlet/activity-plans')
      } else {
        await api.createEDevletDailyActivityPlan(payload)
        setForm(INITIAL)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.activityTypeId || !form.description.trim() || !form.neighborhood || !form.street.trim()) return
    setConfirmDialog({
      title: editingPlanId
        ? t('edevletActivityPlan.editTitle', 'Faaliyet Planını Düzenle')
        : t('edevletActivityPlan.title', 'e-Devlet Günlük Faaliyet Planı Oluştur'),
      message: editingPlanId
        ? t('edevletActivityPlan.updateConfirm', 'Faaliyet planındaki değişiklikleri kaydetmek istediğinize emin misiniz?')
        : t('edevletActivityPlan.createConfirm', 'Faaliyet planını kaydetmek istediğinize emin misiniz?'),
      confirmLabel: editingPlanId
        ? t('common.save', 'Kaydet')
        : t('edevletActivityPlan.submit', 'Faaliyet Planı Oluştur'),
      cancelLabel: t('common.cancel', 'İptal'),
      variant: 'success',
      onConfirm: () => { void executeSave() },
    })
  }

  const canSubmit = !submitting && !loadingPlan
    && form.activityTypeId !== ''
    && form.description.trim() !== ''
    && form.neighborhood !== ''
    && form.street.trim() !== ''

  if (loadingPlan) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('edevletActivityPlan.kicker', 'e-Devlet entegrasyonu')}</div>
            <h1 className="page-title">
              {editingPlanId
                ? t('edevletActivityPlan.editTitle', 'Faaliyet Planını Düzenle')
                : t('edevletActivityPlan.title', 'e-Devlet Günlük Faaliyet Planı Oluştur')}
            </h1>
            <p className="page-subtitle text-base">
              {t('edevletActivityPlan.subtitle', 'Belediyenizin günlük faaliyet planını oluşturarak vatandaşlarınızla paylaşınız.')}
            </p>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={handleSubmit} className="section-card request-form request-form--readable grid gap-4">
        <div className="job-field">
          <div className="grid items-end gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="grid gap-1">
              <label className="job-field-label" htmlFor="activity-type">
                {t('edevletActivityPlan.activityType', 'Faaliyet Tipi')} <span className="text-red-500">*</span>
              </label>
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
            </div>
            <div className="grid gap-1">
              <span className="job-field-label">{t('edevletActivityPlan.manageTypes', 'Faaliyet Tipi Ekle/Düzenle/Sil (max 50 Karakter)')}</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="field-input min-w-[10rem] flex-1"
                  placeholder={t('edevletActivityPlan.newTypePlaceholder', 'Yeni faaliyet tipi adı')}
                  value={typeName}
                  maxLength={TYPE_NAME_MAX}
                  onChange={event => setTypeName(event.target.value)}
                />
                <Button type="button" variant="secondary" onClick={() => { void handleSaveType() }}>
                  {editingTypeId ? t('common.update', 'Güncelle') : t('common.add', 'Ekle')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!form.activityTypeId}
                  onClick={() => {
                    const selected = activityTypes.find(type => type.activityTypeId === form.activityTypeId)
                    if (!selected) return
                    setEditingTypeId(selected.activityTypeId)
                    setTypeName(selected.name)
                  }}
                >
                  {t('common.edit', 'Düzenle')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!form.activityTypeId}
                  onClick={() => {
                    if (!form.activityTypeId) return
                    void handleDeleteType(form.activityTypeId)
                  }}
                >
                  {t('common.delete', 'Sil')}
                </Button>
                {editingTypeId ? (
                  <Button type="button" variant="ghost" onClick={() => { setEditingTypeId(null); setTypeName('') }}>
                    {t('common.cancel', 'İptal')}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="job-field">
          <span className="job-field-label">{t('address.sectionTitleRequired', 'Adres Bilgisi')} <span className="text-red-500">*</span></span>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-sm font-semibold text-slate-500">{t('address.neighborhoodLabel', 'Mahalle')} <span className="text-red-500">*</span></span>
              <select
                className="field-select"
                value={form.neighborhood}
                onChange={event => setForm(current => ({ ...current, neighborhood: event.target.value }))}
                required
              >
                <option value="">{t('address.neighborhoodPlaceholder', 'Mahalle seçin')}</option>
                {neighborhoods.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-semibold text-slate-500" htmlFor="activity-street">
                {t('edevletActivityPlan.streetLabel', 'Cadde / Sokak / Bulvar (max 50 Karakter)')} <span className="text-red-500">*</span>
              </label>
              <input
                id="activity-street"
                className="field-input"
                placeholder={t('address.streetPlaceholder', 'ör. Atatürk Caddesi')}
                value={form.street}
                maxLength={STREET_MAX}
                onChange={event => setForm(current => ({ ...current, street: event.target.value }))}
                required
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="job-field lg:w-1/2">
            <label className="job-field-label" htmlFor="activity-description">
              {t('tasks.detail.description', 'Açıklama')}
              <span className="text-xs font-normal text-slate-400"> {t('edevletActivityPlan.descriptionMax', '(max 100 karakter)')}</span>
              <span className="text-red-500"> *</span>
            </label>
            <textarea
              id="activity-description"
              className="field-textarea min-h-28 w-full text-base leading-relaxed"
              maxLength={DESCRIPTION_MAX}
              value={form.description}
              onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
              placeholder={t('edevletActivityPlan.descriptionPlaceholder', 'Faaliyet açıklamasını girin...')}
              required
            />
          </div>
          <Button type="submit" disabled={!canSubmit} className="gap-2 self-start lg:mb-1 lg:shrink-0">
            <Send className="size-4" />
            {submitting
              ? t('common.saving', 'Kaydediliyor...')
              : editingPlanId
                ? t('common.save', 'Kaydet')
                : t('edevletActivityPlan.submit', 'Faaliyet Planı Oluştur')}
          </Button>
        </div>
      </form>

      {confirmDialog ? <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} /> : null}
    </div>
  )
}
