import { Bell, CheckCheck, Search, X } from 'lucide-react'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import type { AppNotification, JobDetail, TaskDetail } from '../../types/platform'
import type { NotificationPayload } from '../../hooks/useSignalR'
import { useSignalR } from '../../hooks/useSignalR'
import { getLocale } from '../../utils/localization'
import { useAuth } from '../../context/AuthContext'
import { TablePagination } from '../ui/table-pagination'
import { DateTimePicker } from '../ui/date-time-picker'

type NotifFilter = 'all' | 'unread'
type NotificationDetailTarget =
  | { kind: 'task'; id: string }
  | { kind: 'job'; id: string }
  | { kind: 'unsupported'; url: string }

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

function stripHtmlTags(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseNotificationDetailTarget(url: string): NotificationDetailTarget {
  try {
    const parsed = new URL(url, window.location.origin)
    const taskId = parsed.searchParams.get('taskId')
    const jobId = parsed.searchParams.get('jobId')
    if (taskId) return { kind: 'task', id: taskId }
    if (jobId) return { kind: 'job', id: jobId }
  } catch {
    const taskMatch = url.match(/[?&]taskId=([^&]+)/)
    const jobMatch = url.match(/[?&]jobId=([^&]+)/)
    if (taskMatch) return { kind: 'task', id: decodeURIComponent(taskMatch[1]) }
    if (jobMatch) return { kind: 'job', id: decodeURIComponent(jobMatch[1]) }
  }
  return { kind: 'unsupported', url }
}

function formatJobNumber(job: JobDetail): string {
  if (job.jobNumber != null && job.jobNumberYear != null) return `T-${job.jobNumberYear}-${job.jobNumber}`
  return `T-${job.jobNumberYear ?? new Date().getFullYear()}`
}

function formatTaskNumber(task: TaskDetail): string {
  return task.taskId.slice(0, 8).toUpperCase()
}

function formatJobDestinations(job: JobDetail): string {
  const destinationNames = job.departments
    .filter(department => department.role === 'Target' || department.role === 'Coordinating')
    .map(department => department.departmentName)
    .filter((name): name is string => Boolean(name))
  if (destinationNames.length > 0) return destinationNames.join(', ')
  return job.departments
    .filter(department => department.departmentId !== job.ownerDepartmentId)
    .map(department => department.departmentName)
    .filter((name): name is string => Boolean(name))
    .join(', ') || '—'
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0">
      <span className="w-36 shrink-0 pt-0.5 text-xs font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-sm text-slate-900">{value || '—'}</span>
    </div>
  )
}

interface NotifItemProps {
  item: AppNotification
  onMarkRead: (id: string) => void
  onNavigate?: (url: string) => void
  locale: string
  largeDetailButton?: boolean
}

function NotifItem({ item: n, onMarkRead, onNavigate, locale, largeDetailButton = false }: NotifItemProps) {
  const { t } = useTranslation()
  // Satıra tıklamak bildirimi yalnızca okundu yapar; ilgili detay sadece "Detay" butonuyla açılır (card 439/445).
  const handleRowClick = () => {
    if (!n.isRead) onMarkRead(n.notificationId)
  }
  const handleOpenDetail = () => {
    if (!n.isRead) onMarkRead(n.notificationId)
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
        <p className={`text-sm leading-snug ${!n.isRead ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
          {n.title}
        </p>
        {n.message && (
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.message}</p>
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

export function NotificationBell() {
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
  const [detailTarget, setDetailTarget] = useState<NotificationDetailTarget | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null)
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null)
  const [taskParentJob, setTaskParentJob] = useState<JobDetail | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const detailModalRef = useRef<HTMLDivElement>(null)
  const unreadQueryKey = useMemo(
    () => ['notifications-unread-count', user?.tenantId, user?.userId] as const,
    [user?.tenantId, user?.userId],
  )
  const notificationsQueryKey = useMemo(
    () => ['notifications-list', user?.tenantId, user?.userId] as const,
    [user?.tenantId, user?.userId],
  )

  const unreadQuery = useQuery({
    queryKey: unreadQueryKey,
    queryFn: () => api.getUnreadNotificationCount(),
    enabled: Boolean(user?.userId),
    refetchInterval: 30000,
    refetchOnMount: 'always',
  })

  const notifQuery = useQuery({
    queryKey: notificationsQueryKey,
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

  useEffect(() => {
    setModalPage(1)
  }, [modalFilter, modalPageSize, modalSearchText, modalDateFrom, modalDateTo, displayNotifications.length])

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
      queryClient.invalidateQueries({ queryKey: unreadQueryKey })
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
      if (Notification.permission === 'granted') {
        new Notification(localizedPayload.title, { body: localizedPayload.message, icon: '/favicon.ico' })
      }
    },
    [notificationsQueryKey, queryClient, unreadQueryKey],
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
      if (detailModalRef.current?.contains(e.target as Node)) return
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const markRead = async (id: string) => {
    setViewedNotificationIds(prev => new Set(prev).add(id))
    await api.markNotificationRead(id)
    queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
    queryClient.invalidateQueries({ queryKey: unreadQueryKey })
  }

  const markAllRead = async () => {
    const unread = displayNotifications.filter(n => !n.isRead)
    if (unread.length === 0) return
    setViewedNotificationIds(prev => {
      const next = new Set(prev)
      unread.forEach(notification => next.add(notification.notificationId))
      return next
    })
    await api.markAllNotificationsRead()
    queryClient.invalidateQueries({ queryKey: notificationsQueryKey })
    queryClient.invalidateQueries({ queryKey: unreadQueryKey })
  }

  useEffect(() => {
    let cancelled = false
    setTaskDetail(null)
    setJobDetail(null)
    setTaskParentJob(null)
    setDetailError(null)
    setDetailLoading(false)
    if (!detailTarget) return
    if (detailTarget.kind === 'unsupported') {
      setDetailError(t('notifications.unsupportedDetail', 'Bu bildirimin detayı mevcut sayfada açılamıyor.'))
      return
    }
    setDetailLoading(true)
    const load = async () => {
      try {
        if (detailTarget.kind === 'task') {
          const task = await api.getTaskById(detailTarget.id)
          if (cancelled) return
          setTaskDetail(task)
          if (task.jobId) {
            const parent = await api.getJobById(task.jobId).catch(() => null)
            if (!cancelled) setTaskParentJob(parent)
          }
          return
        }
        const job = await api.getJobById(detailTarget.id)
        if (!cancelled) setJobDetail(job)
      } catch (err) {
        if (!cancelled) setDetailError(err instanceof Error ? err.message : t('common.error', 'Hata oluştu'))
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [detailTarget, t])

  const handleNavigate = (url: string) => {
    setDetailTarget(parseNotificationDetailTarget(url))
  }

  const openModal = () => {
    setIsOpen(false)
    setModalPage(1)
    setModalSearchText('')
    setModalDateFrom('')
    setModalDateTo('')
    setIsModalOpen(true)
  }

  const closeNotificationDetail = () => {
    setDetailTarget(null)
    setDetailError(null)
    setTaskDetail(null)
    setJobDetail(null)
    setTaskParentJob(null)
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

      {detailTarget && createPortal(
        <div
          ref={detailModalRef}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
          onClick={closeNotificationDetail}
          onKeyDown={e => { if (e.key === 'Escape') closeNotificationDetail() }}
          role="dialog"
          aria-modal="true"
        >
          <section
            className="detail-modal-shell detail-modal-shell--notification flex max-h-[72dvh] flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
              <div className="min-w-0">
                <div className="text-[0.72rem] font-extrabold uppercase tracking-[0.18em] text-slate-600">
                  {detailTarget.kind === 'task'
                    ? t('tasks.detail.title', 'Görev Detayları')
                    : t('jobs.detail.requestInfo', 'Talep Detayları')}
                </div>
              </div>
              <button
                type="button"
                onClick={closeNotificationDetail}
                className="flex size-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600 active:scale-95"
                aria-label={t('common.close', 'Kapat')}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading && (
                <div className="py-10 text-center text-sm text-slate-400">{t('common.loading', 'Yükleniyor...')}</div>
              )}
              {!detailLoading && detailError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {detailError}
                </div>
              )}
              {!detailLoading && taskDetail && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <DetailRow label="Görev No" value={formatTaskNumber(taskDetail)} />
                    <DetailRow label="Görev Başlığı" value={taskDetail.title} />
                    <DetailRow label="İlgili Talep" value={taskParentJob?.title ?? taskDetail.jobTitle ?? '—'} />
                    <DetailRow label="Görev Sahibi" value={taskDetail.ownerDisplayName} />
                    <DetailRow label="Atanan" value={taskDetail.assignedUserId ?? taskDetail.assignedDepartmentId ?? '—'} />
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <DetailRow label="Öncelik" value={t(`enum.priority.${taskDetail.priority}`, { defaultValue: taskDetail.priority })} />
                    <DetailRow label="Durum" value={t(`enum.taskStatus.${taskDetail.currentStatus}`, { defaultValue: taskDetail.currentStatus })} />
                    <DetailRow label="Görev Tarihi" value={formatNotifDate(taskDetail.createdAtUtc, locale)} />
                    <DetailRow label="Son Tarih" value={formatNotifDate(taskDetail.dueDateUtc, locale)} />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t('tasks.detail.description', 'Açıklama')}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                      {stripHtmlTags(taskDetail.description) || t('tasks.detail.noDescription', 'Açıklama yok')}
                    </p>
                  </div>
                </div>
              )}
              {!detailLoading && jobDetail && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <DetailRow label="Talep No" value={formatJobNumber(jobDetail)} />
                    <DetailRow label="Talep Başlığı" value={jobDetail.title} />
                    <DetailRow label="Talep Yeri / Oluşturan" value={[jobDetail.ownerDepartmentName, jobDetail.createdByDisplayName].filter(Boolean).join(' / ')} />
                    <DetailRow label="Gittiği Yer" value={formatJobDestinations(jobDetail)} />
                    <DetailRow label="Proje mi" value={jobDetail.isProject ? t('common.yes', 'Evet') : t('common.no', 'Hayır')} />
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <DetailRow label="Öncelik" value={t(`enum.priority.${jobDetail.priority}`, { defaultValue: jobDetail.priority })} />
                    <DetailRow label="Durum" value={t(`enum.jobStatus.${jobDetail.status}`, { defaultValue: jobDetail.status })} />
                    <DetailRow label="Talep Tarihi" value={formatNotifDate(jobDetail.createdAtUtc, locale)} />
                    <DetailRow label="Son Tarih" value={formatNotifDate(jobDetail.dueDateUtc, locale)} />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t('jobs.form.description', 'Açıklama')}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-900">
                      {stripHtmlTags(jobDetail.description) || t('common.none', 'Yok')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}

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
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600 active:scale-95"
                  aria-label={t('common.close', 'Kapat')}
                >
                  <X className="size-3.5" strokeWidth={2.5} />
                </button>
              </div>
              {/* "Hepsini okundu yap" ayrı satırda, "Tümü" butonunun altına hizalı. */}
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                title={t('notifications.markAllRead', 'Hepsini okundu yap')}
                className="mt-1.5 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[0.7rem] font-semibold text-[color:var(--color-primary)] transition-colors hover:bg-[color:var(--color-primary)]/8 disabled:cursor-not-allowed disabled:opacity-35"
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
            className="notification-modal-shell flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-secondary,var(--color-primary))] px-6 py-4">
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
                    onChange={event => setModalSearchText(event.target.value)}
                  />
                  {modalSearchText && (
                    <button
                      type="button"
                      onClick={() => setModalSearchText('')}
                      className="scope-chip-search-clear shrink-0 font-extrabold transition-colors"
                      aria-label={t('common.clear', 'Temizle')}
                    >
                      <X className="size-3.5" strokeWidth={3} />
                    </button>
                  )}
                </div>
                <DateTimePicker
                  value={modalDateFrom}
                  onChange={setModalDateFrom}
                  placeholder={t('filters.startDate', 'Başlangıç tarihi')}
                  className="notification-modal-date scope-chip-date"
                  forceDown
                />
                <span className="text-xs text-white/50">–</span>
                <DateTimePicker
                  value={modalDateTo}
                  onChange={setModalDateTo}
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
                  <span className="ml-1 text-amber-400">({unreadCount})</span>
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
                <NotifList items={pagedModal} onMarkRead={markRead} onNavigate={handleNavigate} locale={locale} largeDetailButton />
              )}
            </div>
            {!notifQuery.isLoading && (
              <TablePagination
                totalCount={filteredModal.length}
                pageSize={modalPageSize}
                currentPage={modalPage}
                onPageSizeChange={setModalPageSize}
                onPageChange={setModalPage}
                pageSizeOptions={[5, 10, 25, 50]}
              />
            )}
          </div>
        </div>
      , document.body)}
    </>
  )
}
