import { Pencil, Plus, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { ConfirmDialog, type ConfirmDialogState } from '../components/ui/confirm-dialog'
import { StatusPill } from '../components/ui/status-pill'
import { getLocale } from '../utils/localization'

interface ActivityPlanRow {
  planId: string
  planNumber: number | null
  planNumberYear: number | null
  createdAtUtc: string
  activityTypeName: string
  neighborhood: string | null
  street: string | null
  description: string
  status: string
}

function formatPlanNumber(planNumber: number | null, planNumberYear: number | null) {
  if (!planNumber || !planNumberYear) return '—'
  return `${planNumberYear}-${String(planNumber).padStart(4, '0')}`
}

export function EDevletActivityPlansListPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<ActivityPlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)

  const loadPlans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPlans(await api.getEDevletDailyActivityPlans())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadPlans()
  }, [loadPlans])

  const handleCancel = (plan: ActivityPlanRow) => {
    setConfirmDialog({
      title: t('edevletActivityPlans.cancelTitle', 'Faaliyet Planını İptal Et'),
      message: t('edevletActivityPlans.cancelConfirm', 'Bu faaliyet planını iptal etmek istediğinize emin misiniz?'),
      confirmLabel: t('edevletActivityPlans.cancelAction', 'İptal Et'),
      cancelLabel: t('common.back', 'Geri'),
      variant: 'destructive',
      onConfirm: () => {
        void (async () => {
          try {
            await api.cancelEDevletDailyActivityPlan(plan.planId)
            await loadPlans()
          } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'))
          }
        })()
      },
    })
  }

  const handleDuplicate = (plan: ActivityPlanRow) => {
    setConfirmDialog({
      title: t('edevletActivityPlans.duplicateTitle', 'Faaliyet Planı Oluştur'),
      message: t('edevletActivityPlans.duplicateConfirm', 'Seçili kayıttan yeni bir faaliyet planı oluşturulsun mu?'),
      confirmLabel: t('edevletActivityPlans.createAction', 'Oluştur'),
      cancelLabel: t('common.cancel', 'İptal'),
      variant: 'success',
      onConfirm: () => {
        void (async () => {
          try {
            await api.duplicateEDevletDailyActivityPlan(plan.planId)
            await loadPlans()
          } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'))
          }
        })()
      },
    })
  }

  if (loading) {
    return <div className="loading">{t('common.loading')}</div>
  }

  return (
    <div className="page-stack desktop-page-shell">
      <header className="sticky-page-header">
        <div className="page-header-row">
          <div className="space-y-1">
            <div className="page-kicker">{t('edevletActivityPlans.kicker', 'e-Devlet entegrasyonu')}</div>
            <h1 className="page-title">{t('edevletActivityPlans.title', 'e-Devlet Günlük Faaliyet Planları Listesi')}</h1>
            <p className="page-subtitle text-base">
              {t('edevletActivityPlans.subtitle', 'Biriminize ait günlük faaliyet planlarını görüntüleyin ve yönetin.')}
            </p>
          </div>
          <StatusPill tone="info">{plans.length} {t('edevletActivityPlans.recordCount', 'kayıt')}</StatusPill>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('edevletActivityPlans.columns.rowNo', 'Sıra No')}</th>
                <th>{t('edevletActivityPlans.columns.planNo', 'Faaliyet No')}</th>
                <th>{t('edevletActivityPlans.columns.date', 'Tarih')}</th>
                <th>{t('edevletActivityPlans.columns.activityType', 'Faaliyet Tipi')}</th>
                <th>{t('edevletActivityPlans.columns.neighborhood', 'Mahalle')}</th>
                <th>{t('edevletActivityPlans.columns.street', 'Cadde/Sokak/Bulvar')}</th>
                <th>{t('edevletActivityPlans.columns.description', 'Açıklama')}</th>
                <th>{t('edevletActivityPlans.columns.actions', 'İşlemler')}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan, index) => {
                const isCancelled = plan.status === 'Cancelled'
                return (
                  <tr key={plan.planId}>
                    <td>{index + 1}</td>
                    <td>{formatPlanNumber(plan.planNumber, plan.planNumberYear)}</td>
                    <td>{new Date(plan.createdAtUtc).toLocaleString(getLocale(i18n.language))}</td>
                    <td>{plan.activityTypeName}</td>
                    <td>{plan.neighborhood ?? '—'}</td>
                    <td>{plan.street ?? '—'}</td>
                    <td className="max-w-xs truncate" title={plan.description}>{plan.description}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                          disabled={isCancelled}
                          onClick={() => navigate(`/edevlet/activity-plan?planId=${plan.planId}`)}
                        >
                          <Pencil className="size-3.5" />
                          {t('common.edit', 'Düzenle')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                          onClick={() => handleDuplicate(plan)}
                        >
                          <Plus className="size-3.5" />
                          {t('edevletActivityPlans.createAction', 'Oluştur')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="gap-1.5"
                          disabled={isCancelled}
                          onClick={() => handleCancel(plan)}
                        >
                          <XCircle className="size-3.5" />
                          {t('edevletActivityPlans.cancelAction', 'İptal Et')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">{t('edevletActivityPlans.empty', 'Henüz faaliyet planı bulunmuyor.')}</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {confirmDialog ? <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} /> : null}
    </div>
  )
}
