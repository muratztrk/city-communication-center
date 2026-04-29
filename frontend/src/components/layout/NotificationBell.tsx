import { Bell } from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import type { NotificationPayload } from '../../hooks/useSignalR'
import { useSignalR } from '../../hooks/useSignalR'

export function NotificationBell() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [toasts, setToasts] = useState<NotificationPayload[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadQuery = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => api.getUnreadNotificationCount(),
    refetchInterval: 30000,
  })

  const handleNotification = useCallback(
    (payload: NotificationPayload) => {
      // Show toast
      setToasts(prev => [payload, ...prev].slice(0, 5))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.notificationId !== payload.notificationId))
      }, 5000)

      // Refresh unread count
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })

      // Browser notification if permitted
      if (Notification.permission === 'granted') {
        new Notification(payload.title, {
          body: payload.message,
          icon: '/favicon.svg',
        })
      }
    },
    [queryClient],
  )

  useSignalR(handleNotification)

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = unreadQuery.data ?? 0

  return (
    <>
      {/* Toast notifications */}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.notificationId}
            className="animate-in slide-in-from-right rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 shadow-lg"
          >
            <div className="text-sm font-semibold text-slate-950">{toast.title}</div>
            <div className="mt-0.5 text-xs text-[color:var(--color-muted-foreground)]">{toast.message}</div>
          </div>
        ))}
      </div>

      {/* Bell icon with badge */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          className="relative flex items-center justify-center rounded-lg p-1.5 text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--color-muted)] hover:text-slate-900"
          onClick={() => setIsOpen(prev => !prev)}
          aria-label={t('notifications.bell', 'Notifications')}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-red-500 text-[0.6rem] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-[var(--color-border)] bg-white shadow-xl">
            <div className="border-b border-[var(--color-border)] px-4 py-3">
              <span className="text-sm font-semibold text-slate-950">
                {t('notifications.title', 'Bildirimler')}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {unreadCount === 0 ? (
                <div className="px-2 py-4 text-center text-xs text-[color:var(--color-muted-foreground)]">
                  {t('notifications.empty', 'Yeni bildirim yok')}
                </div>
              ) : (
                <div className="px-2 py-4 text-center text-xs text-[color:var(--color-muted-foreground)]">
                  {unreadCount} {t('notifications.unreadCount', 'okunmamış bildirim')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
