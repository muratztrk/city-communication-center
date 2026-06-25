import { Pencil, Plus, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
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

type PlanScope = 'daily' | 'past'

const SCOPE_FILTERS: Array<{ value: PlanScope; labelKey: string; fallback: string; chipClass: string }> = [
  { value: 'daily', labelKey: 'edevletActivityPlans.scope.daily', fallback: 'Günlük Faaliyetler', chipClass: 'scope-chip--approved' },
  { value: 'past', labelKey: 'edevletActivityPlans.scope.past', fallback: 'Geçmiş Faaliyet', chipClass: 'scope-chip--all' },
]

function formatPlanNumber(planNumber: number | null, planNumberYear: number | null) {
  if (!planNumber || !planNumberYear) return '—'
  return `${planNumberYear}-${String(planNumber).padStart(4, '0')}`
}

function isSameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function isPlanInScope(createdAtUtc: string, scope: PlanScope) {
  const created = new Date(createdAtUtc)
  const isToday = isSameLocalDay(created, new Date())
  return scope === 'daily' ? isToday : !isToday
}

export function EDevletActivityPlansListPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const scopeParam = searchParams.get('view')
  const scope: PlanScope = scopeParam === 'past' ? 'past' : 'daily'
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

  const filteredPlans = useMemo(
    () => plans.filter(plan => isPlanInScope(plan.createdAtUtc, scope)),
    [plans, scope],
  )

  const setScope = (nextScope: PlanScope) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (nextScope === 'daily') {
        next.delete('view')
      } else {
        next.set('view', nextScope)
      }
      return next
    }, { replace: true })
  }

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
            setScope('daily')
          } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error'))
          }
        })()
      },
    })
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
          <StatusPill tone="info">{filteredPlans.length} {t('edevletActivityPlans.recordCount', 'kayıt')}</StatusPill>
        </div>
      </header>

      <nav className="scope-chips" aria-label={t('edevletActivityPlans.title', 'e-Devlet Günlük Faaliyet Planları Listesi')}>
        {SCOPE_FILTERS.map(filter => (
          <button
            key={filter.value}
            type="button"
            className={`scope-chip ${filter.chipClass}${filter.value === scope ? ' active' : ''}`}
            onClick={() => setScope(filter.value)}
          >
            {t(filter.labelKey, filter.fallback)}
          </button>
        ))}
      </nav>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="loading">{t('common.loading')}</div>
      ) : (
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
                {filteredPlans.map((plan, index) => {
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
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        {scope === 'daily'
                          ? t('edevletActivityPlans.emptyDaily', 'Bugün oluşturulmuş faaliyet planı bulunmuyor.')
                          : t('edevletActivityPlans.emptyPast', 'Geçmiş faaliyet planı bulunmuyor.')}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {confirmDialog ? <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} /> : null}
    </div>
  )
}
