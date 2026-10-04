import { ClipboardList, Info, MapPin, X as XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'
import { MyRequestSectionHeading } from './jobs/my-request-detail/MyRequestSectionHeading'
import { DetailModalTitle } from '../utils/detailModalTitle'

type PlanDetail = Awaited<ReturnType<typeof api.getEDevletDailyActivityPlan>>

interface Props {
  planId: string
  planNoDisplay: string
  locale: string
  onClose: () => void
}

// e-Devlet faaliyet planı detay popup'ı: Talepler sayfasındaki detay popup'ıyla aynı kabuk/başlık/kart düzeni (#6ac0cd78).
export function EDevletActivityPlanDetailModal({ planId, planNoDisplay, locale, onClose }: Props) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<PlanDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.getEDevletDailyActivityPlan(planId)
      .then(result => { if (active) setDetail(result) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : t('common.error')) })
    return () => { active = false }
  }, [planId, t])

  const rows: Array<{ label: string; value: string }> = detail ? [
    { label: t('edevletActivityPlans.columns.planNo', 'Faaliyet No'), value: planNoDisplay },
    { label: t('edevletActivityPlans.columns.activityType', 'Faaliyet Tipi'), value: detail.activityTypeName },
    { label: t('edevletActivityPlans.columns.date', 'Tarih'), value: new Date(detail.createdAtUtc).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
    { label: t('edevletActivityPlans.detail.status', 'Durum'), value: detail.status === 'Cancelled' ? t('edevletActivityPlans.detail.cancelled', 'İptal Edildi') : t('edevletActivityPlans.detail.active', 'Aktif') },
  ] : []
  const addressRows: Array<{ label: string; value: string }> = detail ? [
    { label: t('edevletActivityPlans.columns.neighborhood', 'Mahalle'), value: detail.neighborhood ?? '—' },
    { label: t('edevletActivityPlans.columns.street', 'Cadde/Sokak'), value: detail.street ?? '—' },
    { label: t('edevletActivityPlans.detail.openAddress', 'Açık Adres'), value: detail.openAddress || '—' },
  ] : []

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <section
        className="detail-modal-shell flex max-h-[min(85dvh,52rem)] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 border-b border-slate-100 px-4 py-2">
          <div className="detail-modal-header-title min-w-0">
            <div className="text-[0.75rem] font-extrabold uppercase tracking-[0.18em] text-slate-600">
              <DetailModalTitle title={t('edevletActivityPlans.detail.title', 'Faaliyet Planı Detayları')} />
            </div>
          </div>
          <DetailModalHeaderBrand />
          <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center gap-2">
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
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {!detail && !error ? <div className="loading">{t('common.loading')}</div> : null}
          {detail ? (
            <>
              <section className="form-card page-stack mb-5">
                <MyRequestSectionHeading icon={Info} tone="primary">{t('edevletActivityPlans.detail.info', 'Faaliyet Bilgileri')}</MyRequestSectionHeading>
                {rows.map(row => (
                  <div key={row.label} className="job-detail-field-row job-detail-field-row--request-info">
                    <div className="job-detail-field-row__label">{row.label}</div>
                    <div className="job-detail-field-row__value text-slate-900">{row.value}</div>
                  </div>
                ))}
              </section>
              <section className="form-card page-stack mb-5">
                <MyRequestSectionHeading icon={MapPin}>{t('edevletActivityPlans.detail.location', 'Konum')}</MyRequestSectionHeading>
                {addressRows.map(row => (
                  <div key={row.label} className="job-detail-field-row job-detail-field-row--request-info">
                    <div className="job-detail-field-row__label">{row.label}</div>
                    <div className="job-detail-field-row__value text-slate-900">{row.value}</div>
                  </div>
                ))}
              </section>
              <section className="form-card page-stack">
                <MyRequestSectionHeading icon={ClipboardList}>{t('edevletActivityPlans.columns.description', 'Açıklama')}</MyRequestSectionHeading>
                <div className="whitespace-pre-wrap text-sm leading-5 text-slate-900">{detail.description || '—'}</div>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  )
}
