import { ClipboardList, Info, MapPin, PenLine, Printer, Save, Users, X as XIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { getNeighborhoodsForDistrict } from '../data/izmir-locations'
import { useMunicipalityDistrictId } from '../hooks/useMunicipalityDistrictId'
import { printHtmlDocument } from '../utils/printDocument'
import { stringListSelectOptions } from '../utils/formDropdownOptions'
import { toSentenceCaseTr } from '../utils/textNormalization'
import { DetailModalTitle } from '../utils/detailModalTitle'
import { DateTimeText } from './ui/date-time-text'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'
import { CbsStreetNoDropdowns } from './address/CbsStreetNoDropdowns'
import { MyRequestSectionHeading } from './jobs/my-request-detail/MyRequestSectionHeading'
import { emitPageToast } from './ui/pageToast'
import { Button } from './ui/button'
import { SingleSelectDropdown } from './ui/single-select-dropdown'

type PlanDetail = Awaited<ReturnType<typeof api.getEDevletDailyActivityPlan>>
type ActivityType = Awaited<ReturnType<typeof api.getEDevletActivityTypes>>[number]

interface Props {
  planId: string
  planNoDisplay: string
  locale: string
  onClose: () => void
  /** Kaydedilince liste yenilensin. */
  onSaved?: () => void
  /** Anasayfa-Birimler e-Devlet pie drilldown: salt okunur, Düzenle yok (#4111). */
  readOnly?: boolean
}

interface EditForm {
  activityTypeId: string
  status: string
  neighborhood: string
  street: string
  description: string
}

function escHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// e-Devlet faaliyet planı detay popup'ı: Talepler detay popup'ıyla aynı kabuk; 3 kart yan yana,
// başlıkta Düzenle (koyu turkuaz) + Yazdır + kapat (#6ac0cd78 / #6ac20d67).
export function EDevletActivityPlanDetailModal({ planId, planNoDisplay, locale, onClose, onSaved, readOnly = false }: Props) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<PlanDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<EditForm | null>(null)
  const [editorsOpen, setEditorsOpen] = useState(false)
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const districtId = useMunicipalityDistrictId()
  const neighborhoodOptions = useMemo(() => stringListSelectOptions(getNeighborhoodsForDistrict(districtId)), [districtId])
  const typeOptions = useMemo(() => activityTypes.map(type => ({ value: type.activityTypeId, label: type.name })), [activityTypes])
  const statusOptions = useMemo(() => [
    { value: 'Active', label: t('edevletActivityPlans.detail.active', 'Aktif') },
    { value: 'Cancelled', label: t('edevletActivityPlans.detail.cancelled', 'Pasif') },
  ], [t])

  const load = useCallback(async () => {
    try {
      setDetail(await api.getEDevletDailyActivityPlan(planId))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    }
  }, [planId, t])

  useEffect(() => { void load() }, [load])

  const statusLabel = (status: string) => statusOptions.find(option => option.value === status)?.label ?? status
  // Tarih ile saat arasında küçük bullet (#6ac20f3b): "02.10.2026 • 19:01".
  const formatDateParts = (value: string) => {
    const date = new Date(value)
    return `${date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })} \u2022 ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
  }
  const dateText = detail ? formatDateParts(detail.createdAtUtc) : ''
  const edits = detail?.edits ?? []
  const lastEdit = edits.length > 0 ? edits[edits.length - 1] : null
  // Kaydedilmemiş (dokunulmamış) açıklama biçimlendirilmez; yalnız değiştirildiyse cümle düzeni uygulanır.
  const descriptionToSave = (current: string) => (detail && current === detail.description ? current : toSentenceCaseTr(current))

  const startEdit = async () => {
    if (!detail) return
    setError(null)
    try {
      if (activityTypes.length === 0) setActivityTypes(await api.getEDevletActivityTypes())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
      return
    }
    setForm({
      activityTypeId: detail.activityTypeId,
      status: detail.status,
      neighborhood: detail.neighborhood ?? '',
      street: detail.street ?? '',
      description: detail.description,
    })
    setEditing(true)
  }

  const canSave = !!form && !saving && form.activityTypeId !== '' && form.description.trim() !== ''
    && (form.neighborhood === '' || form.street.trim() !== '')

  const save = async () => {
    if (!form || !canSave) return
    setSaving(true)
    setError(null)
    try {
      await api.updateEDevletDailyActivityPlan(planId, {
        activityTypeId: form.activityTypeId,
        description: descriptionToSave(form.description),
        neighborhood: form.neighborhood || null,
        street: form.street.trim() || null,
        openAddress: detail?.openAddress ?? null,
        status: form.status,
      })
      await load()
      setEditing(false)
      emitPageToast(t('edevletActivityPlans.detail.saved', 'Faaliyet planı güncellendi.'), 'success')
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const print = () => {
    if (!detail) return
    const rows: Array<[string, string]> = [
      [t('edevletActivityPlans.columns.planNo', 'Faaliyet No'), planNoDisplay],
      [t('edevletActivityPlans.columns.activityType', 'Faaliyet Tipi'), detail.activityTypeName],
      [t('edevletActivityPlans.columns.date', 'Tarih'), dateText],
      [t('edevletActivityPlans.detail.status', 'Durum'), statusLabel(detail.status)],
      [t('edevletActivityPlans.columns.neighborhood', 'Mahalle'), detail.neighborhood ?? '—'],
      [t('edevletActivityPlans.columns.street', 'Cadde/Sokak'), detail.street ?? '—'],
    ]
    printHtmlDocument(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${escHtml(planNoDisplay)}</title><style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:2rem;margin:0}
      .section{margin-top:1.5rem}
      .section-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #9ca3af;padding-bottom:3px;margin-bottom:8px;color:#333}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #9ca3af;padding:4px 8px;text-align:left}
      th{width:34%;background:#f0f0f0}
      .desc{border:1px solid #9ca3af;padding:8px;border-radius:3px;background:#fafafa;font-size:11px;line-height:1.6}
      .footer{margin-top:2rem;font-size:10px;color:#aaa}
    </style></head><body>
    <div class="section"><div class="section-title">${escHtml(t('edevletActivityPlans.detail.title', 'Faaliyet Planı Detayları'))}</div>
    <table><tbody>${rows.map(([label, value]) => `<tr><th>${escHtml(label)}</th><td>${escHtml(value)}</td></tr>`).join('')}</tbody></table></div>
    <div class="section"><div class="section-title">${escHtml(t('edevletActivityPlans.columns.description', 'Açıklama'))}</div>
    <div class="desc">${escHtml(detail.description || '').replace(/\\n/g, '<br/>')}</div></div>
    <div class="footer">${escHtml(t('common.printDate', 'Yazdırma tarihi'))}: ${escHtml(new Date().toLocaleString(locale))}</div>
    </body></html>`)
  }

  const row = (label: React.ReactNode, value: React.ReactNode, rowKey?: string) => (
    <div key={rowKey ?? (typeof label === 'string' ? label : undefined)} className="job-detail-field-row job-detail-field-row--request-info">
      <div className="job-detail-field-row__label">{label}</div>
      <div className="job-detail-field-row__value text-slate-900">{value}</div>
    </div>
  )

  const viewingEdit = editing && form !== null
  // Faaliyet tarihi bugünü geçmişse Düzenle görünmez (#6ac2121c).
  const isPastPlan = detail ? new Date(detail.createdAtUtc).toDateString() !== new Date().toDateString() : false
  const creatorRows = [
    row(t('edevletActivityPlans.detail.createdByDepartment', 'Oluşturan Birim'), detail?.departmentName || '—'),
    row(t('edevletActivityPlans.detail.createdBy', 'Oluşturan Personel'), detail?.createdByDisplayName || '—'),
  ]
  const editorRows = lastEdit ? [
    row(
      t('edevletActivityPlans.detail.editor', 'Düzenleyen'),
      (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          onClick={() => setEditorsOpen(true)}
        >
          <Users className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {t('edevletActivityPlans.detail.editors', 'Düzenleyenler')}
        </button>
      ),
    ),
    row(t('edevletActivityPlans.detail.editDate', 'Düzenleme Tarihi'), <DateTimeText value={lastEdit.editedAtUtc} locale={locale} dotClassName="size-[5px]" />),
  ] : []

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <section
        className="detail-modal-shell edevlet-plan-detail-shell flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 border-b border-slate-100 px-4 py-2">
          <div className="detail-modal-header-title min-w-0">
            <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-slate-600">
              <DetailModalTitle title={t('edevletActivityPlans.detail.title', 'Faaliyet Planı Detayları')} />
            </div>
          </div>
          <DetailModalHeaderBrand />
          <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center gap-2">
            {viewingEdit ? (
              <>
                <Button
                  type="button"
                  size="lg"
                  variant="success"
                  className="edevlet-plan-detail-header-btn inline-flex items-center justify-center gap-1.5"
                  disabled={!canSave}
                  onClick={() => void save()}
                >
                  <Save className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {t('common.save', 'Kaydet')}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  className="edevlet-plan-detail-header-btn inline-flex items-center justify-center gap-1.5"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                >
                  {t('common.cancel', 'Vazgeç')}
                </Button>
              </>
            ) : (
              <>
                {!readOnly && !isPastPlan ? (
                  <Button
                    type="button"
                    size="lg"
                    className="inline-flex items-center gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
                    disabled={!detail}
                    onClick={() => void startEdit()}
                  >
                    <PenLine className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {t('common.edit', 'Düzenle')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  className="detail-print-action inline-flex items-center gap-1.5 text-slate-700 hover:bg-slate-100"
                  disabled={!detail}
                  onClick={print}
                  aria-label={t('common.print', 'Yazdır')}
                >
                  <Printer className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {t('common.print', 'Yazdır')}
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="detail-modal-header-close flex size-9 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
              aria-label={t('common.close', 'Kapat')}
            >
              <XIcon className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {!detail && !error ? <div className="loading">{t('common.loading')}</div> : null}
          {detail ? (
            <div className={`grid gap-4 lg:grid-cols-3${viewingEdit ? ' edevlet-plan-detail-edit' : ''}`}>
              <section className="form-card page-stack min-w-0 edevlet-plan-detail-card">
                <MyRequestSectionHeading icon={Info} className="job-detail-card-title--spread">
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span>{t('edevletActivityPlans.detail.info', 'Faaliyet Bilgileri')}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs font-semibold text-slate-500">{planNoDisplay}</span>
                  </span>
                </MyRequestSectionHeading>
                <div className="my-request-detail-fields page-stack edevlet-plan-detail-fields">
                  {creatorRows}
                  {viewingEdit ? (
                    <>
                      {row(t('edevletActivityPlans.columns.activityType', 'Faaliyet Tipi'), (
                        <SingleSelectDropdown
                          searchable
                          menuPortal
                          className="w-full max-w-full"
                          options={typeOptions}
                          value={form.activityTypeId}
                          onChange={activityTypeId => setForm(current => current && ({ ...current, activityTypeId }))}
                          placeholder={t('edevletActivityPlan.typePlaceholder', 'Faaliyet tipi seçiniz')}
                        />
                      ))}
                      {row(t('edevletActivityPlans.detail.status', 'Durum'), (
                        <SingleSelectDropdown
                          menuPortal
                          className="w-full max-w-full"
                          options={statusOptions}
                          value={form.status}
                          onChange={status => setForm(current => current && ({ ...current, status }))}
                          placeholder={t('edevletActivityPlans.detail.status', 'Durum')}
                        />
                      ))}
                      {row(t('edevletActivityPlans.columns.date', 'Tarih'), detail ? <DateTimeText value={detail.createdAtUtc} locale={locale} dotClassName="size-[5px]" /> : '')}
                    </>
                  ) : (
                    <>
                      {row(t('edevletActivityPlans.columns.activityType', 'Faaliyet Tipi'), detail.activityTypeName)}
                      {row(t('edevletActivityPlans.columns.date', 'Tarih'), detail ? <DateTimeText value={detail.createdAtUtc} locale={locale} dotClassName="size-[5px]" /> : '')}
                      {row(t('edevletActivityPlans.detail.status', 'Durum'), (
                        <span className={detail.status === 'Active' ? 'font-semibold text-green-600' : undefined}>{statusLabel(detail.status)}</span>
                      ))}
                      {editorRows}
                    </>
                  )}
                </div>
              </section>

              <section className="form-card page-stack min-w-0 edevlet-plan-detail-card">
                <MyRequestSectionHeading icon={ClipboardList} className="job-detail-card-title--spread">
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">{t('edevletActivityPlans.columns.description', 'Açıklama')}</span>
                </MyRequestSectionHeading>
                {viewingEdit ? (
                  <textarea
                    className="min-h-32 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    maxLength={400}
                    value={form.description}
                    onChange={event => setForm(current => current && ({ ...current, description: event.target.value }))}
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-5 text-slate-900">{detail.description || '—'}</div>
                )}
              </section>
              <section className="form-card page-stack min-w-0 edevlet-plan-detail-card edevlet-plan-detail-address">
                <MyRequestSectionHeading icon={MapPin} className="job-detail-card-title--spread">
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">{t('edevletActivityPlans.detail.address', 'Adres Bilgileri')}</span>
                </MyRequestSectionHeading>
                <div className="my-request-detail-fields page-stack edevlet-plan-detail-fields">
                  {viewingEdit ? (
                    <>
                      {row(
                        <>
                          {t('address.neighborhoodLabel', 'Mahalle')}
                          {form.neighborhood ? <span className="text-red-500"> *</span> : null}
                        </>,
                        <SingleSelectDropdown
                          searchable
                          clearable
                          menuPortal
                          className="w-full max-w-full"
                          options={neighborhoodOptions}
                          value={form.neighborhood}
                          onChange={neighborhood => setForm(current => current && ({ ...current, neighborhood, street: '' }))}
                          placeholder={t('address.neighborhoodPlaceholder', 'Mahalle seçin')}
                        />,
                        'address-neighborhood',
                      )}
                      {row(
                        <>
                          {t('edevletActivityPlans.columns.street', 'Cadde/Sokak')}
                          {form.neighborhood ? <span className="text-red-500"> *</span> : null}
                        </>,
                        <CbsStreetNoDropdowns
                          hideStreetNo
                          hideStreetLabel
                          neighborhood={form.neighborhood}
                          street={form.street}
                          streetNo=""
                          required={Boolean(form.neighborhood)}
                          className="grid min-w-0 w-full grid-cols-1 gap-2"
                          onStreetChange={street => setForm(current => current && ({ ...current, street }))}
                          onStreetNoChange={() => undefined}
                        />,
                        'address-street',
                      )}
                    </>
                  ) : (
                    <>
                      {row(t('edevletActivityPlans.columns.neighborhood', 'Mahalle'), detail.neighborhood ?? '—')}
                      {row(t('edevletActivityPlans.columns.street', 'Cadde/Sokak'), detail.street ?? '—')}
                    </>
                  )}
                </div>
              </section>

            </div>
          ) : null}
        </div>
      </section>
      {editorsOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/30 p-4" role="presentation" onClick={event => { event.stopPropagation(); setEditorsOpen(false) }}>
          <section className="flex max-h-[min(70dvh,32rem)] w-[min(30rem,100%)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2">
              <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-slate-600">{t('edevletActivityPlans.detail.editors', 'Düzenleyenler')}</div>
              <button
                type="button"
                onClick={() => setEditorsOpen(false)}
                className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
                aria-label={t('common.close', 'Kapat')}
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto p-4">
              {[...edits].reverse().map((edit, index) => (
                <li key={`${edit.editedAtUtc}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{edit.editedByDisplayName || '—'}</span>
                    <span className="shrink-0 text-xs text-slate-500"><DateTimeText value={edit.editedAtUtc} locale={locale} dotClassName="size-[5px]" /></span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-teal-700">{t('edevletActivityPlans.detail.action', 'İşlem')}: {edit.action || t('edevletActivityPlans.detail.actionEdit', 'Düzenleme')}</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                    {(edit.changes && edit.changes.length > 0 ? edit.changes : edit.changedFields).map(change => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </li>
              ))}
              {detail && edits.length === 0 ? (
                <li className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{detail.createdByDisplayName || '—'}</span>
                    <span className="shrink-0 text-xs text-slate-500"><DateTimeText value={detail.createdAtUtc} locale={locale} dotClassName="size-[5px]" /></span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-teal-700">{t('edevletActivityPlans.detail.action', 'İşlem')}: {t('edevletActivityPlans.detail.actionCreate', 'Oluşturma')}</div>
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
