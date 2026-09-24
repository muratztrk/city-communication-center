import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { TableEmptyStateRows } from '../components/ui/table-empty-state-rows'
import { formatCitizenPhoneDisplay } from '../utils/citizenRequests'
import { getLocale } from '../utils/localization'
import { looksLikePhone } from '../utils/phoneDisplay'

type ApprovalLogKind = 'all' | 'waitingReplied' | 'pendingApprovalCleared'

const KIND_FILTERS: Array<{ value: ApprovalLogKind; labelKey: string; fallback: string }> = [
  { value: 'all', labelKey: 'whatsappMessageApprovalLogs.kinds.all', fallback: 'Tümü' },
  { value: 'waitingReplied', labelKey: 'whatsappMessageApprovalLogs.kinds.waitingReplied', fallback: 'Yanıt Verildi Yapan' },
  { value: 'pendingApprovalCleared', labelKey: 'whatsappMessageApprovalLogs.kinds.pendingApprovalCleared', fallback: 'Mesaj Onayı/Cevabı Verildi Yapan' },
]

function actionLabel(action: string, t: (key: string, fallback: string) => string): string {
  if (action === 'WhatsAppWaitingReplied') {
    return t('whatsappMessageApprovalLogs.status.waitingReplied', 'Yanıt Verildi')
  }
  if (action === 'WhatsAppPendingApprovalCleared') {
    return t('whatsappMessageApprovalLogs.status.pendingApprovalCleared', 'Mesaj Onayı/Cevabı Verildi')
  }
  return action
}

export function WhatsAppMessageApprovalLogsPage() {
  const { t, i18n } = useTranslation()
  const [kind, setKind] = useState<ApprovalLogKind>('all')
  const locale = getLocale(i18n.language)
  const logsQuery = useQuery({
    queryKey: ['whatsapp-message-approval-logs', kind],
    queryFn: () => api.getWhatsAppMessageApprovalLogs(kind),
  })
  const rows = useMemo(() => logsQuery.data ?? [], [logsQuery.data])

  return (
    <div className="page-stack desktop-page-shell">
      <section className="section-card p-0">
        <div className="sticky-page-header !rounded-b-none border-0 shadow-none">
          <div className="page-header-row">
            <div className="space-y-1">
              <h1 className="page-title">{t('nav.whatsappMessageApprovalLogs', 'Whatsapp Mesaj Onay Logları')}</h1>
              <p className="page-subtitle">
                {t('whatsappMessageApprovalLogs.subtitle', 'Yanıt Verildi ve Mesaj Onayı/Cevabı Verildi yapan operatörler.')}
              </p>
            </div>
          </div>
          <nav className="scope-chips" aria-label={t('whatsappMessageApprovalLogs.filterLabel', 'Onay log filtreleri')}>
            {KIND_FILTERS.map(filter => (
              <button
                key={filter.value}
                type="button"
                className={`scope-chip scope-chip--pending${kind === filter.value ? ' active' : ''}`}
                onClick={() => setKind(filter.value)}
              >
                {t(filter.labelKey, filter.fallback)}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {logsQuery.isError ? <div className="error">{t('common.error')}</div> : null}

      <section className="section-card desktop-page-fill">
        <div className="table-wrap desktop-panel-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('whatsappMessageApprovalLogs.columns.order', 'Sıra')}</th>
                <th>{t('whatsappMessageApprovalLogs.columns.citizen', 'Vatandaş Adı Telefon No')}</th>
                <th>{t('whatsappMessageApprovalLogs.columns.actedAt', 'İşlem Tarihi')}</th>
                <th>{t('whatsappMessageApprovalLogs.columns.status', 'Durum')}</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.isLoading ? (
                <TableEmptyStateRows columnCount={4} message={t('common.loading')} />
              ) : rows.length === 0 ? (
                <TableEmptyStateRows columnCount={4} message={t('whatsappMessageApprovalLogs.empty', 'Kayıt yok.')} />
              ) : rows.map((row, index) => {
                const name = row.citizenName?.trim() || '—'
                const phone = row.citizenPhone?.trim()
                const phoneText = phone && looksLikePhone(phone) ? formatCitizenPhoneDisplay(phone) : phone
                const citizen = phoneText ? `${name} ${phoneText}` : name
                return (
                  <tr key={row.auditLogId}>
                    <td>{index + 1}</td>
                    <td>{citizen}</td>
                    <td>{new Date(row.eventTimeUtc).toLocaleString(locale)}</td>
                    <td>{actionLabel(row.action, t)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
