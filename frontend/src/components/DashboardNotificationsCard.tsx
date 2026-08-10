import { Bell } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { invalidateNotifications } from '../api/cacheInvalidation'
import { queryKeys } from '../api/queryKeys'
import { getLocale } from '../utils/localization'
import {
  OPEN_NOTIFICATION_DETAIL_EVENT,
  OPEN_NOTIFICATIONS_MODAL_EVENT,
  localizeNotificationText,
} from '../utils/notificationShared'
import { NotificationPreviewList } from './notifications/NotificationPreviewList'
import type { AppNotification } from '../types/platform'

export function DashboardNotificationsCard() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const queryClient = useQueryClient()
  const markingNotificationIdsRef = useRef<Set<string>>(new Set())
  const [viewedNotificationIds, setViewedNotificationIds] = useState<Set<string>>(() => new Set())

  const notifQuery = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => api.getNotifications(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const displayNotifications = (notifQuery.data ?? []).map(notification => ({
    ...notification,
    title: localizeNotificationText(notification.title),
    message: localizeNotificationText(notification.message),
    isRead: notification.isRead || viewedNotificationIds.has(notification.notificationId),
  }))

  const items = displayNotifications.slice(0, 3)

  const markRead = async (id: string) => {
    if (markingNotificationIdsRef.current.has(id)) return
    markingNotificationIdsRef.current.add(id)

    setViewedNotificationIds(prev => new Set(prev).add(id))
    queryClient.setQueryData<number>(queryKeys.notifications.unreadCount(), current => Math.max(0, (current ?? 0) - 1))
    queryClient.setQueryData<AppNotification[]>(queryKeys.notifications.list(), current =>
      current?.map(notification => notification.notificationId === id ? { ...notification, isRead: true } : notification),
    )

    try {
      await api.markNotificationRead(id)
      invalidateNotifications(queryClient)
    } catch {
      setViewedNotificationIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      invalidateNotifications(queryClient)
    } finally {
      markingNotificationIdsRef.current.delete(id)
    }
  }

  const handleNavigate = (url: string, title?: string) => {
    window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATION_DETAIL_EVENT, { detail: { url, title } }))
  }

  return (
    <div className="section-card flex min-h-[18rem] flex-col overflow-hidden p-0">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <Bell className="size-4" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-extrabold text-slate-900">{t('notifications.bell', 'Bildirimler')}</h2>
          </div>
          <button
            type="button"
            className="shrink-0 text-xs font-bold text-[color:var(--color-primary)] transition-colors hover:text-[color:var(--color-primary)]/80"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_NOTIFICATIONS_MODAL_EVENT))}
          >
            {t('notifications.seeAll', 'Tüm bildirimleri gör')} →
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {notifQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">{t('common.loading')}</p>
        ) : (
          <NotificationPreviewList
            items={items}
            onMarkRead={markRead}
            onNavigate={handleNavigate}
            locale={locale}
          />
        )}
      </div>
    </div>
  )
}
