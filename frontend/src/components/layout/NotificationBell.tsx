import { Bell, CheckCheck, Search, X } from 'lucide-react'
import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { invalidateNotifications } from '../../api/cacheInvalidation'
import { queryKeys } from '../../api/queryKeys'
import type { AppNotification, JobDetail, TaskDetail } from '../../types/platform'
import type { NotificationPayload } from '../../hooks/useSignalR'
import { useSignalR } from '../../hooks/useSignalR'
import { getLocale } from '../../utils/localization'
import { useAuth } from '../../context/AuthContext'
import { TablePagination } from '../ui/table-pagination'
import { DateTimePicker } from '../ui/date-time-picker'
import { RichTextContent } from '../ui/RichTextContent'
import { GridExtraTimeMarkers } from '../ui/extra-time-markers'

type NotifFilter = 'all' | 'unread'
// scope: bildirim başkasına atanmış bir görevle ilgiliyse (ör. yöneticinin, personelinin ek süre
// talebini incelemesi) "department" — Birimdeki Görevler başlığıyla açılmalı; kendi görevi ise
// "mine" — Görevlerim başlığıyla (card #1394).
export type NotificationDetailTarget = { kind: 'task' | 'job'; id: string; scope?: 'mine' | 'department' }

interface NotificationBellProps {
  onOpenDetail?: (target: NotificationDetailTarget) => void
}
function localizeNotificationText(value: string): string {
  return value
    .replace(/routine[\s\u00a0]+task[\s\u00a0]+created/giu, 'Rutin görev oluşturuldu')
    .replace(/created[\s\u00a0]+(?:a[\s\u00a0]+)?task/giu, 'Görev oluşturuldu')
    .replace(/task[\s\u00a0]+(?:was[\s\u00a0]+)?created/giu, 'Görev oluşturuldu')
    .replace(/task assigned/gi, 'Görev atandı')
    .replace(/job created/gi, 'Talep oluşturuldu')
    .replace(/job updated/gi, 'Talep güncellendi')
    // Teknik/İngilizce ifadeleri temizle (card 308).
    .replace(/\s*—?\s*Created after job owner approval\.?\s*AssignedUser=[0-9a-f-]+/gi, '')
    .replace(/\s*—?\s*Created from job owner user selection\.?\s*AssignedUser=[0-9a-f-]+/gi, '')
    .replace(/\s*—?\s*Created task\b[^—]*/gi, '')
    .replace(/\s*—?\s*Created a task\b[^—]*/gi, '')
    .replace(/\s*—?\s*Task (?:was )?created\b[^—]*/gi, '')
    .replace(/\s*—?\s*Targets=\d+,?\s*OwnerUsers=\d+/gi, '')
    .replace(/\s*—?\s*Status=[^—]*/gi, '')
    .replace(/Assigned to user\s+[0-9a-f-]+/gi, 'Bir personele atandı')
    .replace(/Assigned to:/gi, 'Atanan:')
    .replace(/Unassigned \(pool\)/gi, 'Havuza eklendi')
    .replace(/\s+—\s*$/, '')
    .trim()
}

function formatNotifDate(value: string | null | undefined, locale: string) {
  if (!value) return ''
  return new Date(value).toLocaleString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function parseNotificationDetailTarget(url: string): { kind: 'task' | 'job' | 'unsupported'; id?: string; scope?: 'mine' | 'department' } {
  try {
    const parsed = new URL(url, window.location.origin)
    const taskId = parsed.searchParams.get('taskId')
    const jobId = parsed.searchParams.get('jobId')
    // actionUrl'in path'i bildirimin kimin görev listesini hedeflediğini zaten taşıyor
    // (ör. yöneticiye giden "ek süre talebi" bildirimi /department-tasks?taskId=... kullanır) —
    // önceden bu bilgi atılıp her zaman "Görevlerim" açılıyordu (card #1394).
    const scope: 'mine' | 'department' = parsed.pathname.startsWith('/department-tasks') ? 'department' : 'mine'
    if (taskId) return { kind: 'task', id: taskId, scope }
    if (jobId) return { kind: 'job', id: jobId }
  } catch {
    const taskMatch = url.match(/[?&]taskId=([^&]+)/)
    const jobMatch = url.match(/[?&]jobId=([^&]+)/)
    const scope: 'mine' | 'department' = url.startsWith('/department-tasks') ? 'department' : 'mine'
    if (taskMatch) return { kind: 'task', id: decodeURIComponent(taskMatch[1]), scope }
    if (jobMatch) return { kind: 'job', id: decodeURIComponent(jobMatch[1]) }
  }
  return { kind: 'unsupported' }
}

interface NotifItemProps {
  item: AppNotification
  onMarkRead: (id: string) => void
  onNavigate?: (url: string) => void
  locale: string
  largeDetailButton?: boolean
}

// Başlıkta durum kelimesi varsa TÜM başlık o renge boyanır; "(Vatandaş Talebi)" etiketi ayrı turuncu kalır (card #1341).
function notificationTitleTone(title: string): string | null {
  if (/(reddedildi|iptal edildi|İptal Edildi)/i.test(title)) return 'text-red-600'
  if (/(onaylandı|tamamlandı)/i.test(title)) return 'text-emerald-600'
  return null
}

function NotificationTitle({ title, isUnread }: { title: string; isUnread: boolean }) {
  const mainWeight = isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
  const tone = notificationTitleTone(title)
  const match = title.match(/^(.+?)\s(\([^)]+\))$/)
  const mainText = match ? match[1] : title
  const suffix = match ? match[2] : null
  return (
    <>
      {tone ? (
        // Renkli (onaylandı/tamamlandı/reddedildi) başlıklar okunmuş olsa da bold kalır (cards #1344/#1401).
        <span className={`font-bold ${tone}`}>{mainText}</span>
      ) : (
        <NotificationTitleStatusText value={mainText} plainClassName={mainWeight} />
      )}
      {suffix ? <span className="font-normal text-slate-600"> {suffix}</span> : null}
    </>
  )
}

function NotifItem({ item: n, onMarkRead, onNavigate, locale, largeDetailButton = false }: NotifItemProps) {
  const { t } = useTranslation()
  // Satıra tıklamak bildirimi okundu yapar; ilgili detay sadece "Detay" butonuyla açılır (card 439/445).
  // Geçmiş (AuditLog) satırlarında da çalışır: MarkNotificationRead audit id'yi okuma imlecini
  // o olayın zamanına ilerleterek işler (o olay + daha eskiler okundu olur) (card 640).
  const canMarkRead = !n.isRead
  const handleRowClick = () => {
    if (canMarkRead) onMarkRead(n.notificationId)
  }
  const handleOpenDetail = () => {
    if (canMarkRead) onMarkRead(n.notificationId)
    if (n.actionUrl && onNavigate) onNavigate(n.actionUrl)
  }

  return (
    <li
      className="group relative flex cursor-pointer gap-3 bg-white px-4 py-3 transition-colors duration-150 hover:bg-slate-50"
      onClick={handleRowClick}
    >
      {/* Unread accent bar */}
      <div className={`mt-1 w-1 shrink-0 self-stretch rounded-full transition-colors
        ${!n.isRead ? 'bg-slate-300 group-hover:bg-slate-400' : 'bg-emerald-500'}`} />

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <NotificationTitle title={n.title} isUnread={!n.isRead} />
          {n.titleTag ? <span className="font-semibold text-orange-500"> ({n.titleTag})</span> : null}
        </p>
        {n.message && (
          <p className="mt-0.5 text-xs font-normal text-slate-500 line-clamp-2">{n.message}</p>
        )}
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-[0.68rem] text-slate-400">
            {formatNotifDate(n.sentAtUtc, locale)}
          </p>
          {n.actionUrl && onNavigate && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleOpenDetail() }}
              className={`ml-auto rounded-md bg-emerald-500 font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 ${
                largeDetailButton ? 'px-4 py-2 text-sm' : 'px-2 py-1 text-[0.7rem]'
              }`}
            >
              {t('common.detail', 'Detay')}
            </button>
          )}
        </div>
      </div>
    </li>
  )
}

function NotificationEntityLabelText({ value, plainClassName }: { value: string; plainClassName: string }) {
  return value.split(/(Görev|Talep)/g).map((segment, index) => {
    if (!segment) return null
    if (segment === 'Görev' || segment === 'Talep') {
      return <span key={index} className="font-bold text-slate-900">{segment}</span>
    }
    return <span key={index} className={plainClassName}>{segment}</span>
  })
}

function NotificationTitleStatusText({ value, plainClassName }: { value: string; plainClassName: string }) {
  return value.split(/(onaylandı|reddedildi|tamamlandı|Tamamlandı|İptal Edildi|güncellendi|oluşturuldu|atandı|yönlendirildi|Yönetici notu atandı|Ek süre talebi)/gi).map((part, index) => {
    if (!part) return null
    if (/^onaylandı$/i.test(part)) return <span key={index} className="font-bold text-emerald-600">{part}</span>
    if (/^tamamlandı$/i.test(part)) return <span key={index} className="font-bold text-emerald-600">{part}</span>
    if (/^reddedildi$/i.test(part)) return <span key={index} className="font-bold text-red-600">{part}</span>
    if (/^İptal Edildi$/i.test(part)) return <span key={index} className="font-bold text-red-600">{part}</span>
    if (/^(güncellendi|oluşturuldu|atandı|yönlendirildi|Yönetici notu atandı|Ek süre talebi)$/i.test(part)) {
      return <span key={index} className="font-bold">{part}</span>
    }
    return <NotificationEntityLabelText key={index} value={part} plainClassName={plainClassName} />
  })
}

function hasExtraTimeMarker(source: Pick<TaskDetail, 'hasPendingExtraTimeRequest' | 'lastExtraTimeRequestDecision'> | Pick<TaskDetail, 'hasPendingExtraTimeRequest' | 'lastExtraTimeRequestDecision'>[]): boolean {
  const items = Array.isArray(source) ? source : [source]
  return items.some(item => item.hasPendingExtraTimeRequest || item.lastExtraTimeRequestDecision)
}

interface NotifListProps {
  items: AppNotification[]
  onMarkRead: (id: string) => void
  onNavigate?: (url: string) => void
  locale: string
  largeDetailButton?: boolean
}

function NotifList({ items, onMarkRead, onNavigate, locale, largeDetailButton = false }: NotifListProps) {
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
          largeDetailButton={largeDetailButton}
        />
      ))}
    </ul>
  )
}

interface NotificationEntityDetailModalProps {
  detail: { kind: 'task' | 'job'; data: TaskDetail | JobDetail } | null
  loading: boolean
  error: string | null
  locale: string
  onClose: () => void
}

function NotificationEntityDetailModal({ detail, loading, error, locale, onClose }: NotificationEntityDetailModalProps) {
  const { t } = useTranslation()
  if (!loading && !detail && !error) return null

  const isTask = detail?.kind === 'task'
  const data = detail?.data
  const fields: Array<[string, ReactNode]> = isTask && data
    ? [
        ['Görev Başlığı', (data as TaskDetail).title],
        ['Durum', (data as TaskDetail).currentStatus],
        ['Öncelik', (data as TaskDetail).priority],
        ['Atanan', (data as TaskDetail).assignedUserDisplayName ?? (data as TaskDetail).assignedDepartmentName ?? '—'],
        ['Son Tarih', (data as TaskDetail).dueDateUtc ? formatNotifDate((data as TaskDetail).dueDateUtc, locale) : '—'],
        ...(hasExtraTimeMarker(data as TaskDetail)
          ? [[
              'Ek Süre',
              <GridExtraTimeMarkers
                key="task-extra-time"
                hasPending={(data as TaskDetail).hasPendingExtraTimeRequest}
                lastDecision={(data as TaskDetail).lastExtraTimeRequestDecision}
              />,
            ] as [string, ReactNode]]
          : []),
      ]
    : data
      ? [
          ['Talep Başlığı', (data as JobDetail).title],
          ['Durum', (data as JobDetail).status],
          ['Öncelik', (data as JobDetail).priority],
          ['Talep Sahibi Birim', (data as JobDetail).ownerDepartmentName ?? '—'],
          ['Son Tarih', (data as JobDetail).dueDateUtc ? formatNotifDate((data as JobDetail).dueDateUtc, locale) : '—'],
          ...(hasExtraTimeMarker((data as JobDetail).tasks)
            ? [[
                'Ek Süre',
                <GridExtraTimeMarkers
                  key="job-extra-time"
                  hasPending={(data as JobDetail).tasks.some(task => task.hasPendingExtraTimeRequest)}
                  lastDecision={(data as JobDetail).tasks.find(task => task.lastExtraTimeRequestDecision)?.lastExtraTimeRequestDecision ?? null}
                />,
              ] as [string, ReactNode]]
            : []),
        ]
      : []
  const description = data ? (data as TaskDetail | JobDetail).description : ''

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <section className="detail-modal-shell flex max-h-[min(85dvh,42rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
        <header className="detail-modal-header-mobile flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="detail-modal-header-title min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t('notifications.bell', 'Bildirimler')}</p>
            <h2 className="text-base font-extrabold text-slate-900">{isTask ? t('tasks.detail.title', 'Görev Detayları') : t('jobs.detail.title', 'Talep Detayları')}</h2>
          </div>
          <div className="detail-modal-header-actions flex shrink-0 items-center gap-2">
            <button type="button" disabled={loading} onClick={onClose} className="detail-modal-header-close flex size-9 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 disabled:opacity-50" aria-label={t('common.close', 'Kapat')}>
              <X className="size-5" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="py-12 text-center text-sm text-slate-400">{t('common.loading', 'Yükleniyor...')}</p>}
          {error && <p className="alert alert-error text-sm">{error}</p>}
          {data && <>
            <dl className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
              {fields.map(([label, value]) => <div key={label} className="bg-white px-4 py-3"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-0.5 break-words text-sm font-semibold text-slate-800">{value}</dd></div>)}
            </dl>
            <section className="mt-4"><h3 className="text-sm font-bold text-slate-700">{t('common.description', 'Açıklama')}</h3><RichTextContent value={description} className="mt-1 text-sm text-slate-600" /></section>
          </>}
        </div>
      </section>
    </div>,
    document.body,
  )
}

export function NotificationBell({ onOpenDetail }: NotificationBellProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = getLocale(i18n.language)
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filter, setFilter] = useState<NotifFilter>('all')
  const [modalFilter, setModalFilter] = useState<NotifFilter>('all')
  const [modalSearchText, setModalSearchText] = useState('')
  const [modalDateFrom, setModalDateFrom] = useState('')
  const [modalDateTo, setModalDateTo] = useState('')
  const [modalPage, setModalPage] = useState(1)
  const [modalPageSize, setModalPageSize] = useState(5)
  const [toasts, setToasts] = useState<NotificationPayload[]>([])
  const [viewedNotificationIds, setViewedNotificationIds] = useState<Set<string>>(() => new Set())
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)
  const [notificationDetail] = useState<{ kind: 'task' | 'job'; data: TaskDetail | JobDetail } | null>(null)
  const [notificationDetailLoading] = useState(false)
  const [notificationDetailError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const markingNotificationIdsRef = useRef<Set<string>>(new Set())
  const unreadQuery = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => api.getUnreadNotificationCount(),
    enabled: Boolean(user?.userId),
    refetchInterval: 30000,
    refetchOnMount: 'always',
  })

  const notifQuery = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () => api.getNotifications(),
    enabled: Boolean(user?.userId) && (isOpen || isModalOpen),
    refetchOnMount: 'always',
  })

  const notifications = notifQuery.data ?? []
  const unreadCount = unreadQuery.data ?? 0
  const displayNotifications = notifications.map(notification => ({
    ...notification,
    title: localizeNotificationText(notification.title),
    message: localizeNotificationText(notification.message),
    isRead: notification.isRead || viewedNotificationIds.has(notification.notificationId),
  }))

  const filteredDropdown = filter === 'unread' ? displayNotifications.filter(n => !n.isRead) : displayNotifications
  const modalSearchQuery = modalSearchText.trim().toLocaleLowerCase('tr')
  const filteredModal = (modalFilter === 'unread' ? displayNotifications.filter(n => !n.isRead) : displayNotifications)
    .filter(notification => {
      // Tarih aralığı filtresi — Talepler bannerındaki ile aynı mantık (gün bazında karşılaştırma).
      if (modalDateFrom || modalDateTo) {
        const day = notification.sentAtUtc?.slice(0, 10)
        if (!day) return false
        if (modalDateFrom && day < modalDateFrom.slice(0, 10)) return false
        if (modalDateTo && day > modalDateTo.slice(0, 10)) return false
      }
      if (!modalSearchQuery) return true
      return [
        notification.title,
        notification.message,
        formatNotifDate(notification.sentAtUtc, locale),
      ].some(value => value.toLocaleLowerCase('tr').includes(modalSearchQuery))
    })
  const pagedModal = filteredModal.slice((modalPage - 1) * modalPageSize, modalPage * modalPageSize)
  const previewItems = filteredDropdown.slice(0, 5)

  const resetModalPage = () => setModalPage(1)
  const handleModalFilterChange = (value: NotifFilter) => {
    setModalFilter(value)
    resetModalPage()
  }
  const handleModalSearchChange = (value: string) => {
    setModalSearchText(value)
    resetModalPage()
  }
  const handleModalDateFromChange = (value: string) => {
    setModalDateFrom(value)
    resetModalPage()
  }
  const handleModalDateToChange = (value: string) => {
    setModalDateTo(value)
    resetModalPage()
  }
  const handleModalPageSizeChange = (value: number) => {
    setModalPageSize(value)
    resetModalPage()
  }

  const handleNotification = useCallback(
    (payload: NotificationPayload) => {
      const localizedPayload = {
        ...payload,
        title: localizeNotificationText(payload.title),
        message: localizeNotificationText(payload.message),
      }
      setToasts(prev => [localizedPayload, ...prev].slice(0, 5))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.notificationId !== payload.notificationId))
      }, 5000)
      invalidateNotifications(queryClient)
      if (Notification.permission === 'granted') {
        new Notification(localizedPayload.title, { body: localizedPayload.message, icon: '/favicon.ico' })
      }
    },
    [queryClient, setToasts],
  )

  useSignalR({ onNotification: handleNotification })

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Panel (açılır liste veya modal) açıldığında rozet sayısını tazele; kullanıcı tıklamadan önce
  // sayı güncel olur, böylece her tıklama görünür biçimde tam 1 azalır (card 633).
  useEffect(() => {
    if (isOpen || isModalOpen) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() })
    }
  }, [isOpen, isModalOpen, queryClient])

  useEffect(() => {
    if (!isOpen) return
    function handler(e: MouseEvent) {
      if (!dropdownRef.current) return
      if (dropdownRef.current.contains(e.target as Node)) return
      // Bildirimden açılan detay pop-up'ı açıkken listedeki açık durumu koru (card 651).
      if (document.querySelector('.detail-modal-shell')) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const markRead = async (id: string) => {
    // Aynı bildirime ardışık tıklamalar, rozet sayısını birden fazla azaltmamalı.
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
      // Kalıcılaştırma başarısız olduysa sunucudaki gerçek sayıyı yeniden al.
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

  const markAllRead = async () => {
    if (isMarkingAllRead) return
    const unread = displayNotifications.filter(n => !n.isRead)
    if (unread.length === 0) return
    setIsMarkingAllRead(true)
    setViewedNotificationIds(prev => {
      const next = new Set(prev)
      unread.forEach(notification => next.add(notification.notificationId))
      return next
    })
    try {
      await api.markAllNotificationsRead()
      invalidateNotifications(queryClient)
    } finally {
      setIsMarkingAllRead(false)
    }
  }

  // Bildirim detayı, mevcut sayfayı değiştirmeden uygulama kabuğunda açılır.
  const handleOpenNotificationDetail = async (url: string) => {
    const target = parseNotificationDetailTarget(url)
    setIsModalOpen(false)
    if (target.kind === 'unsupported' || !target.id) return

    onOpenDetail?.({ kind: target.kind, id: target.id, scope: target.scope })
  }

  const openModal = () => {
    setIsOpen(false)
    setModalPage(1)
    setModalSearchText('')
    setModalDateFrom('')
    setModalDateTo('')
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
          <span className="relative inline-flex">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="pointer-events-none absolute -right-3.5 -top-3.5 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-red-600 px-1 text-[0.7rem] font-black leading-none tabular-nums text-white shadow-sm ring-2 ring-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="border-b border-slate-100 px-4 py-2.5">
              <div className="flex items-center justify-between">
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
                <div className="flex shrink-0 items-center gap-1.5">
                  {/* Kompakt tek satır "Tümünü Oku" butonu (card #1403). */}
                  <button
                    type="button"
                    onClick={markAllRead}
                    disabled={isMarkingAllRead || unreadCount === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500 bg-white px-2 py-1 text-[0.68rem] font-semibold leading-none text-[color:var(--color-primary)] shadow-sm transition-colors hover:bg-[color:var(--color-primary)]/8 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCheck className="size-3.5 shrink-0" />
                    {t('notifications.markAllReadShort', 'Tümünü Oku')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600 active:scale-95"
                    aria-label={t('common.close', 'Kapat')}
                  >
                    <X className="size-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto">
              {notifQuery.isLoading ? (
                <div className="py-6 text-center text-xs text-slate-400">{t('common.loading', 'Yükleniyor...')}</div>
              ) : (
                <NotifList items={previewItems} onMarkRead={markRead} onNavigate={handleOpenNotificationDetail} locale={locale} />
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
            className="notification-modal-shell flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky-page-header flex shrink-0 items-center gap-3 rounded-none border-0 px-6 py-4 shadow-none">
              <Bell className="size-5 shrink-0 text-white/80" />
              <h2 className="min-w-0 flex-1 truncate text-base font-extrabold text-white">
                {t('notifications.modalTitle', 'Bildirimler')}
              </h2>
              {/* Talepler bannerındaki ile aynı: arama + başlangıç/bitiş tarihi seçicileri (card 508). */}
              <div className="notification-modal-filters flex shrink-0 items-center gap-1.5">
                <div className="notification-modal-search scope-chip-search-wrap">
                  <Search className="scope-chip-search-icon size-3 shrink-0" aria-hidden="true" />
                  <input
                    type="text"
                    className="scope-chip-search-input"
                    placeholder={t('common.search', 'Ara...')}
                    value={modalSearchText}
                    onChange={event => handleModalSearchChange(event.target.value)}
                  />
                  {modalSearchText && (
                    <button
                      type="button"
                      onClick={() => handleModalSearchChange('')}
                      className="scope-chip-search-clear shrink-0 font-extrabold transition-colors"
                      aria-label={t('common.clear', 'Temizle')}
                    >
                      <X className="size-3.5" strokeWidth={3} />
                    </button>
                  )}
                </div>
                <DateTimePicker
                  value={modalDateFrom}
                  onChange={handleModalDateFromChange}
                  placeholder={t('filters.startDate', 'Başlangıç tarihi')}
                  className="notification-modal-date scope-chip-date"
                  forceDown
                />
                <DateTimePicker
                  value={modalDateTo}
                  onChange={handleModalDateToChange}
                  placeholder={t('filters.endDate', 'Bitiş tarihi')}
                  className="notification-modal-date scope-chip-date"
                  forceDown
                />
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
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
                  onClick={() => handleModalFilterChange('all')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${modalFilter === 'all' ? 'bg-[color:var(--color-primary)] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {t('notifications.all', 'Tümü')} ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleModalFilterChange('unread')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${modalFilter === 'unread' ? 'bg-[color:var(--color-primary)] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {t('notifications.unread', 'Okunmamış')}
                  <span className="ml-1 text-amber-400">({unreadCount})</span>
                </button>
              </div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={isMarkingAllRead || unreadCount === 0}
                /* Çift tik ikonu, dropdown butonuyla aynı görsel dil (card #1397). */
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CheckCheck className="size-3.5 shrink-0" />
                {isMarkingAllRead ? t('common.loading', 'Yükleniyor...') : t('notifications.markAllRead', 'Tümünü okundu yap')}
              </button>
            </div>

            {/* Modal list */}
            <div className="flex-1 overflow-y-auto">
              {notifQuery.isLoading ? (
                <div className="py-12 text-center text-sm text-slate-400">{t('common.loading', 'Yükleniyor...')}</div>
              ) : (
                <NotifList items={pagedModal} onMarkRead={markRead} onNavigate={handleOpenNotificationDetail} locale={locale} largeDetailButton />
              )}
            </div>
            {!notifQuery.isLoading && (
              <TablePagination
                totalCount={filteredModal.length}
                pageSize={modalPageSize}
                currentPage={modalPage}
                onPageSizeChange={handleModalPageSizeChange}
                onPageChange={setModalPage}
                pageSizeOptions={[5, 10, 25, 50]}
              />
            )}
          </div>
        </div>
      , document.body)}
      <NotificationEntityDetailModal
        detail={notificationDetail}
        loading={notificationDetailLoading}
        error={notificationDetailError}
        locale={locale}
        onClose={() => undefined}
      />
    </>
  )
}
