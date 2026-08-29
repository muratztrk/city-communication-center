import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { CitizenRequestMap } from '../components/CitizenRequestMap'
import { PieLegendSearch } from '../components/ui/PieChart'
import { ScopeChipDateRange } from '../components/ui/scope-chip-date-range'
import { StatusPill } from '../components/ui/status-pill'
import { toApiDateParam, toDateTimePickerValue } from '../utils/dateTimePicker'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

function getPeriodRange(p: Period, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date()
  const toStr = toDateTimePickerValue(now.toISOString())
  if (p === 'daily') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    return { from: toDateTimePickerValue(start.toISOString()), to: toStr }
  }
  if (p === 'weekly') {
    const dayOfWeek = now.getDay()
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0)
    return { from: toDateTimePickerValue(start.toISOString()), to: toStr }
  }
  if (p === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    return { from: toDateTimePickerValue(start.toISOString()), to: toStr }
  }
  if (p === 'yearly') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    return { from: toDateTimePickerValue(start.toISOString()), to: toStr }
  }
  return {
    from: toDateTimePickerValue(customFrom) || customFrom,
    to: toDateTimePickerValue(customTo) || customTo,
  }
}

export function CitizenRequestMapPage() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('yearly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [mapSearch, setMapSearch] = useState('')

  const { from: activeFrom, to: activeTo } = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  )
  const apiFrom = toApiDateParam(activeFrom)
  const apiTo = toApiDateParam(activeTo)

  const pinsQuery = useQuery({
    queryKey: queryKeys.reports.citizenMapPins({ from: activeFrom, to: activeTo }),
    queryFn: () => api.getCitizenDashboardMapPins(apiFrom, apiTo),
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

  return (
    <div className="page-stack desktop-page-shell shrink-0">
      <section className="section-card p-0">
        <div
          className="grid gap-3 border-b border-white/10 px-4 py-3.5 text-white sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] rounded-t-[var(--radius-xl)] lg:rounded-t-[0.85rem]"
          style={{ background: 'linear-gradient(135deg, var(--color-header-from), var(--color-header-to))' }}
        >
          <div className="space-y-1">
            <div className="live-summary-kicker text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/70">
              {t('dashboard.liveSummary')}
            </div>
            <h1 className="page-title !text-white">
              {t('nav.citizenRequestMap', 'Vatandaş Talep Haritası')}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-white/82">
              {t('citizenRequestMap.subtitle', 'Bölgenizdeki vatandaş talepleri açık adres bilgileriyle haritada gösterilir.')}
            </p>
          </div>
          <div className="flex items-start justify-start lg:justify-end">
            <StatusPill tone="info" className="live-summary-kicker bg-white/12 text-white ring-white/15">
              {pinsQuery.isFetching ? t('common.refreshing') : t('citizenRequestMap.live', 'Canlı harita')}
            </StatusPill>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5 border-b border-[var(--color-border)] bg-[var(--color-background)]">
          <span className="text-xs font-semibold text-[color:var(--color-muted-foreground)] uppercase tracking-wide mr-1">
            {t('dashboard.period.label', 'Dönem')}:
          </span>
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                period === p
                  ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white'
                  : 'border-[var(--color-border)] bg-white text-slate-600 hover:border-[color:var(--color-primary)]/50'
              }`}
            >
              {t(`dashboard.period.${p}`, { daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık', yearly: 'Yıllık' }[p])}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPeriod('custom')}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
              period === 'custom'
                ? 'border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white'
                : 'border-[var(--color-border)] bg-white text-slate-600 hover:border-[color:var(--color-primary)]/50'
            }`}
          >
            {t('dashboard.period.custom', 'Özel')}
          </button>
          {period === 'custom' && (
            <ScopeChipDateRange from={customFrom} to={customTo} onFromChange={setCustomFrom} onToChange={setCustomTo} forceDown />
          )}
        </div>
        <div className="flex items-center px-4 py-2 sm:px-5 border-b border-[var(--color-border)] bg-[var(--color-background)]">
          <div className="map-period-search min-w-[12rem] max-w-md">
            <PieLegendSearch value={mapSearch} onChange={setMapSearch} />
          </div>
        </div>

        <CitizenRequestMap
          pins={pinsQuery.data?.pins ?? []}
          loading={pinsQuery.isLoading}
          searchQuery={mapSearch}
          onSearchQueryChange={setMapSearch}
          hideLegendSearch
        />
        {pinsQuery.isError ? (
          <div className="px-4 py-3 text-sm font-medium text-red-600 sm:px-5">
            {pinsQuery.error instanceof Error
              ? pinsQuery.error.message
              : t('errors.citizenMapLoadFailed', 'Vatandaş talep haritası yüklenemedi.')}
          </div>
        ) : null}
      </section>
    </div>
  )
}
