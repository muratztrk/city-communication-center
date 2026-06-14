import { Bell, Check, CheckCheck, ExternalLink, X } from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import type { AppNotification } from '../../types/platform'
import type { NotificationPayload } from '../../hooks/useSignalR'
import { useSignalR } from '../../hooks/useSignalR'
import { getLocale } from '../../utils/localization'

type NotifFilter = 'all' | 'unread'

function formatNotifDate(value: string | null | undefined, locale: string) {
  if (!value) return ''
  return new Date(value).toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

interface NotifItemProps {
  item: AppNotification
  onMarkRead: (id: string) => void
  onNavigate?: (url: string) => void
  locale: string
}

function NotifItem({ item: n, onMarkRead, onNavigate, locale }: NotifItemProps) {
  const { t } = useTranslation()
  const handleClick = () => {
    if (!n.isRead) onMarkRead(n.notificationId)
    if (n.actionUrl && onNavigate) onNavigate(n.actionUrl)
  }

  return (
    <li
      className={`group relative flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition-all duration-150 hover:shadow-sm
        ${!n.isRead
          ? 'border-amber-300 bg-amber-50/80 hover:bg-amber-50'
          : 'border-emerald-300 bg-emerald-50/80 hover:bg-emerald-50'}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
    >
      {/* Unread accent bar */}
      <div className={`mt-1 w-1 shrink-0 self-stretch rounded-full transition-colors
        ${!n.isRead ? 'bg-[color:var(--color-primary)]' : 'bg-transparent group-hover:bg-slate-200'}`} />

      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${!n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
          {n.title}
        </p>
        {n.message && (
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.message}</p>
        )}
        <p className="mt-1 text-[0.68rem] text-slate-400">
          {formatNotifDate(n.sentAtUtc, locale)}
        </p>
      </div>

      {/* Actions on hover */}
      <div className="flex shrink-0 flex-col items-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {!n.isRead && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onMarkRead(n.notificationId) }}
            title={t('notifications.markRead', 'Okundu işaretle')}
            className="rounded-md p-1 hover:bg-[color:var(--color-primary)]/10"
          >
            <Check className="size-3.5 text-[color:var(--color-primary)]" />
          </button>
        )}
        {n.actionUrl && (
          <span className="rounded-md p-1 text-slate-400">
            <ExternalLink className="size-3" />
          </span>
        )}
      </div>
    </li>
  )
}

interface NotifListProps {
  items: AppNotification[]
  onMarkRead: (id: string) => void
  onNavigate?: (url: string) => void
  locale: string
}

function NotifList({ items, onMarkRead, onNavigate, locale }: NotifListProps) {
  const { t } = useTranslation()
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        {t('notifications.empty', 'Bildirim yok')}
      </div>
    )
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map(n => (
        <NotifItem
          key={n.notificationId}
          item={n}
          onMarkRead={onMarkRead}
          onNavigate={onNavigate}
          locale={locale}
        />
      ))}
    </ul>
  )
}

export function NotificationBell() {
  const { t, i18n } = useTranslation()
  const locale = getLocale(i18n.language)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filter, setFilter] = useState<NotifFilter>('all')
  const [modalFilter, setModalFilter] = useState<NotifFilter>('all')
  const [toasts, setToasts] = useState<NotificationPayload[]>([])
  const [viewedNotificationIds, setViewedNotificationIds] = useState<Set<string>>(() => new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadQuery = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => api.getUnreadNotificationCount(),
    refetchInterval: 30000,
  })

  const notifQuery = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => api.getNotifications(),
    enabled: isOpen || isModalOpen,
  })

  const notifications = notifQuery.data ?? []
  const unreadCount = unreadQuery.data ?? 0
  const displayNotifications = notifications.map(notification => ({
    ...notification,
    isRead: viewedNotificationIds.has(notification.notificationId),
  }))

  const filteredDropdown = filter === 'unread' ? displayNotifications.filter(n => !n.isRead) : displayNotifications
  const filteredModal = modalFilter === 'unread' ? displayNotifications.filter(n => !n.isRead) : displayNotifications
  const previewItems = filteredDropdown.slice(0, 5)

  const handleNotification = useCallback(
    (payload: NotificationPayload) => {
      setToasts(prev => [payload, ...prev].slice(0, 5))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.notificationId !== payload.notificationId))
      }, 5000)
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
      if (Notification.permission === 'granted') {
        new Notification(payload.title, { body: payload.message, icon: '/favicon.ico' })
      }
    },
    [queryClient],
  )

  useSignalR(handleNotification)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const markRead = async (id: string) => {
    setViewedNotificationIds(prev => new Set(prev).add(id))
    await api.markNotificationRead(id)
    queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
  }

  const markAllRead = async () => {
    const unread = displayNotifications.filter(n => !n.isRead)
    if (unread.length === 0) return
    setViewedNotificationIds(prev => {
      const next = new Set(prev)
      unread.forEach(notification => next.add(notification.notificationId))
      return next
    })
    await api.markAllNotificationsRead(unread.map(n => n.notificationId))
    queryClient.invalidateQueries({ queryKey: ['notifications-list'] })
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
  }

  const handleNavigate = (url: string) => {
    setIsOpen(false)
    setIsModalOpen(false)
    navigate(url)
  }

  const openModal = () => {
    setIsOpen(false)
    setIsModalOpen(true)
  }

  return (
    <>
      {/* Toasts */}
      <div className="fixed right-4 top-4 z-[200] flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.notificationId}
            className="w-80 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 shadow-lg"
          >
            <div className="text-sm font-bold text-slate-900">{toast.title}</div>
            <div className="mt-0.5 text-xs text-slate-500">{toast.message}</div>
          </div>
        ))}
      </div>

      {/* Bell button + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          className="relative flex size-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 shadow-sm transition-colors hover:border-[color:var(--color-primary)]/40 hover:bg-[color:var(--color-primary)]/8 hover:text-[color:var(--color-primary)]"
          onClick={() => setIsOpen(prev => !prev)}
          aria-label={t('notifications.bell', 'Bildirimler')}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-2 -top-1 text-[0.65rem] font-bold text-red-500">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${filter === 'all' ? 'bg-[color:var(--color-primary)] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  {t('notifications.all', 'Tümü')}
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unread')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${filter === 'unread' ? 'bg-[color:var(--color-primary)] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  {t('notifications.unread', 'Okunmamış')}
                </button>
              </div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                title={t('notifications.markAllRead', 'Hepsini okundu yap')}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[0.7rem] font-semibold text-[color:var(--color-primary)] transition-colors hover:bg-[color:var(--color-primary)]/8 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <CheckCheck className="size-3.5" />
                {t('notifications.markAllReadShort', 'Hepsini okundu yap')}
              </button>
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto">
              {notifQuery.isLoading ? (
                <div className="py-6 text-center text-xs text-slate-400">{t('common.loading', 'Yükleniyor...')}</div>
              ) : (
                <NotifList items={previewItems} onMarkRead={markRead} onNavigate={handleNavigate} locale={locale} />
              )}
            </div>

            {/* Footer */}
            <button
              type="button"
              onClick={openModal}
              className="block w-full border-t border-slate-100 py-2.5 text-center text-xs font-bold text-[color:var(--color-primary)] transition-colors hover:bg-[color:var(--color-primary)]/6"
            >
              {t('notifications.seeAll', 'Tüm bildirimleri gör')} →
            </button>
          </div>
        )}
      </div>

      {/* Full modal — rendered via portal so it escapes zoom: 0.84 context */}
      {isModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setIsModalOpen(false)}
          onKeyDown={e => { if (e.key === 'Escape') setIsModalOpen(false) }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex max-h-[82dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-secondary,var(--color-primary))] px-6 py-4">
              <Bell className="size-5 shrink-0 text-white/80" />
              <h2 className="flex-1 text-base font-extrabold text-white">
                {t('notifications.modalTitle', 'Bildirimler')}
              </h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white">
                  {unreadCount} okunmamış
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="Kapat"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal toolbar */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-2.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setModalFilter('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${modalFilter === 'all' ? 'bg-[color:var(--color-primary)] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {t('notifications.all', 'Tümü')} ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalFilter('unread')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${modalFilter === 'unread' ? 'bg-[color:var(--color-primary)] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {t('notifications.unread', 'Okunmamış')}
                  {unreadCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-[color:var(--color-primary)]/40 hover:text-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCheck className="size-3.5" />
                {t('notifications.markAllRead', 'Hepsini okundu yap')}
              </button>
            </div>

            {/* Modal list */}
            <div className="flex-1 overflow-y-auto">
              {notifQuery.isLoading ? (
                <div className="py-12 text-center text-sm text-slate-400">{t('common.loading', 'Yükleniyor...')}</div>
              ) : (
                <NotifList items={filteredModal} onMarkRead={markRead} onNavigate={handleNavigate} locale={locale} />
              )}
            </div>
          </div>
        </div>
      , document.body)}
    </>
  )
}
