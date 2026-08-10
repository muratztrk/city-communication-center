import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { queryKeys } from '../api/queryKeys'
import { getLocale } from '../utils/localization'
import { OPEN_NOTIFICATIONS_MODAL_EVENT } from './layout/NotificationBell'
import type { AppNotification } from '../types/platform'

function formatPreviewDate(value: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function DashboardNotificationsCard() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)

  const notifQuery = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => api.getNotifications(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const items = (notifQuery.data ?? []).slice(0, 5)

  return (
    <div className="section-card flex min-h-[18rem] flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <Bell className="size-4" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-extrabold text-slate-900">{t('notifications.bell', 'Bildirimler')}</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {notifQuery.isLoading ? (
          <p className="py-4 text-center text-xs text-slate-400">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">{t('notifications.empty', 'Bildirim yok')}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item: AppNotification) => (
              <li key={item.notificationId} className="py-2.5">
                <p className="text-sm font-semibold leading-snug text-slate-900 line-clamp-2">{item.title}</p>
                {item.message ? (
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{item.message}</p>
                ) : null}
                <p className="mt-1 text-[0.68rem] text-slate-400">
                  {item.sentAtUtc ? formatPreviewDate(item.sentAtUtc, locale) : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="mt-3 w-full border-t border-slate-100 pt-2.5 text-center text-xs font-bold text-[color:var(--color-primary)] transition-colors hover:text-[color:var(--color-primary)]/80"
        onClick={() => window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_MODAL_EVENT))}
      >
        {t('notifications.seeAll', 'Tüm bildirimleri gör')} →
      </button>
    </div>
  )
}
