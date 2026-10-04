import { Check, PenLine, Plus, Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
import { getNeighborhoodsForDistrict } from '../data/izmir-locations'
import { useMunicipalityDistrictId } from '../hooks/useMunicipalityDistrictId'
import { CbsStreetNoDropdowns } from '../components/address/CbsStreetNoDropdowns'
import { SingleSelectDropdown } from '../components/ui/single-select-dropdown'
import { stringListSelectOptions } from '../utils/formDropdownOptions'
import { emitPageToast } from '../components/ui/pageToast'
import { buildDuplicateNameDialog, hasDuplicateName } from '../utils/duplicateNameDialog'
import { toSentenceCaseTr } from '../utils/textNormalization'

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

const TYPE_NAME_MAX = 100
const DESCRIPTION_MAX = 400

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
  const districtId = useMunicipalityDistrictId()
  const neighborhoods = useMemo(() => getNeighborhoodsForDistrict(districtId), [districtId])
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(neighborhoods), [neighborhoods])
  const activityTypeOptions = useMemo(
    () => activityTypes.map(type => ({ value: type.activityTypeId, label: type.name })),
    [activityTypes],
  )

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
    const normalizedTypeName = toSentenceCaseTr(typeName)
    if (!normalizedTypeName) return
    // Aynı faaliyet tipi adı oluşturulamaz; düzenlenen tipin kendi adı hariç (#6abe6455).
    if (hasDuplicateName(activityTypes.filter(type => type.activityTypeId !== editingTypeId).map(type => type.name), normalizedTypeName)) {
      setConfirmDialog(buildDuplicateNameDialog(
        t('edevletActivityPlan.duplicateTypeTitle', 'Faaliyet Tipi Oluşturulamadı'),
        t('edevletActivityPlan.duplicateTypeMessage', 'Bu faaliyet tipi zaten kayıtlı. Lütfen farklı bir faaliyet tipi adı giriniz.'),
        t('common.ok', 'Tamam'),
      ))
      return
    }
    setError(null)
    try {
      if (editingTypeId) {
        await api.updateEDevletActivityType(editingTypeId, normalizedTypeName)
      } else {
        await api.createEDevletActivityType(normalizedTypeName)
        emitPageToast(t('edevletActivityPlan.typeAdded', 'Faaliyet tipi eklendi.'), 'success')
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
        description: toSentenceCaseTr(form.description),
        neighborhood: form.neighborhood || null,
        street: form.street.trim() || null,
        openAddress: null,
      }
      if (editingPlanId) {
        await api.updateEDevletDailyActivityPlan(editingPlanId, payload)
        navigate('/edevlet/activity-plans')
      } else {
        await api.createEDevletDailyActivityPlan(payload)
        navigate('/edevlet/activity-plans')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.activityTypeId || !form.description.trim() || (form.neighborhood && !form.street.trim())) return
    setConfirmDialog({
      title: editingPlanId
        ? t('edevletActivityPlan.editTitle', 'Faaliyet Planını Düzenle')
        : t('edevletActivityPlan.title', 'e-Devlet Günlük Faaliyet Planı Oluştur'),
      titleDivider: true,
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
    && (form.neighborhood === '' || form.street.trim() !== '')

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
            <p className="page-subtitle edevlet-banner-subtitle text-sm">
              {t('edevletActivityPlan.subtitle', 'Belediyenizin günlük faaliyet planını oluşturarak vatandaşlarınızla paylaşınız.')}
            </p>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <form onSubmit={handleSubmit} className="section-card request-form request-form--readable edevlet-plan-form grid gap-4">
        <div className="job-field">
          <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="grid gap-1">
              <label className="job-field-label" htmlFor="activity-type">
                {t('edevletActivityPlan.activityType', 'Faaliyet Tipi')} <span className="text-red-500">*</span>
              </label>
              <SingleSelectDropdown
                searchable
                options={activityTypeOptions}
                value={form.activityTypeId}
                onChange={activityTypeId => setForm(current => ({ ...current, activityTypeId }))}
                placeholder={t('edevletActivityPlan.activityTypePlaceholder', 'Faaliyet tipi seçiniz')}
              />
            </div>
            <div className="grid gap-1">
              <span className="job-field-label">
                {t('edevletActivityPlan.manageTypes', 'Faaliyet Tipi Ekle')}
                <span className="ml-1 text-xs font-normal text-slate-400">{t('edevletActivityPlan.typeNameMax', '(max 100 karakter)')}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
                <input
                  className="field-input w-full basis-full md:min-w-0 md:flex-1 md:basis-auto"
                  placeholder={t('edevletActivityPlan.newTypePlaceholder', 'Yeni faaliyet tipi adı')}
                  value={typeName}
                  maxLength={TYPE_NAME_MAX}
                  onChange={event => setTypeName(event.target.value)}
                  onBlur={() => setTypeName(current => toSentenceCaseTr(current))}
                />
                <div className="edevlet-type-actions flex w-full gap-2 md:contents">
                <Button
                  type="button"
                  variant="success"
                  className="inline-flex items-center gap-1.5"
                  onClick={() => { void handleSaveType() }}
                >
                  {editingTypeId
                    ? <Check className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    : <Plus className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
                  {editingTypeId ? t('common.update', 'Güncelle') : t('common.add', 'Ekle')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="inline-flex items-center gap-1.5"
                  disabled={!form.activityTypeId}
                  onClick={() => {
                    const selected = activityTypes.find(type => type.activityTypeId === form.activityTypeId)
                    if (!selected) return
                    setEditingTypeId(selected.activityTypeId)
                    setTypeName(selected.name)
                  }}
                >
                  <PenLine className="size-[0.9375rem] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {t('common.edit', 'Düzenle')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="inline-flex items-center gap-1.5"
                  disabled={!form.activityTypeId}
                  onClick={() => {
                    const activityTypeId = form.activityTypeId
                    if (!activityTypeId) return
                    setConfirmDialog({
                      title: t('edevletActivityPlan.deleteTypeTitle', 'Faaliyet Tipi Sil'),
                      titleDivider: true,
                      message: t('edevletActivityPlan.deleteTypeConfirm', 'Bu faaliyet tipini silmek istediğinize emin misiniz?'),
                      confirmLabel: t('common.delete', 'Sil'),
                      cancelLabel: t('common.cancel', 'İptal'),
                      variant: 'destructive',
                      onConfirm: () => { void handleDeleteType(activityTypeId) },
                    })
                  }}
                >
                  <Trash2 className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
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
        </div>

        <div className="job-field">
          <span className="job-field-label">{t('edevletActivityPlan.addressTitle', 'Adres Bilgisi')}</span>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-1">
              <span className="text-sm font-semibold text-slate-500">
                {t('address.neighborhoodLabel', 'Mahalle')}
                {form.neighborhood ? <span className="text-red-500"> *</span> : null}
              </span>
              <SingleSelectDropdown
                searchable
                clearable
                options={neighborhoodOptions}
                value={form.neighborhood}
                onChange={neighborhood => setForm(current => ({ ...current, neighborhood, street: '' }))}
                placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
              />
            </div>
            <CbsStreetNoDropdowns
              hideStreetNo
              neighborhood={form.neighborhood}
              street={form.street}
              streetNo=""
              required={Boolean(form.neighborhood)}
              className="grid min-w-0 grid-cols-1 gap-2"
              onStreetChange={street => setForm(current => ({ ...current, street }))}
              onStreetNoChange={() => undefined}
            />
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 lg:items-end">
          <div className="job-field">
            <label className="job-field-label" htmlFor="activity-description">
              {t('tasks.detail.description', 'Açıklama')}
              <span className="ml-1 text-xs font-normal text-slate-400">{t('edevletActivityPlan.descriptionMax', '(max 400 karakter)')}</span>
              <span className="text-red-500"> *</span>
            </label>
            <textarea
              id="activity-description"
              className="field-textarea min-h-28 w-full text-base leading-relaxed"
              maxLength={DESCRIPTION_MAX}
              value={form.description}
              onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
              onBlur={() => setForm(current => ({ ...current, description: toSentenceCaseTr(current.description) }))}
              placeholder={t('edevletActivityPlan.descriptionPlaceholder', 'Faaliyet açıklamasını giriniz...')}
              required
            />
          </div>
          <Button type="submit" disabled={!canSubmit} className="edevlet-submit-button min-h-12 w-full gap-2 self-end">
            <Send className="size-4 shrink-0" />
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
