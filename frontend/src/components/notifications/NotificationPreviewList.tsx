import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppNotification } from '../../types/platform'
import { ChannelIcon } from '../ui/channel-icon'
import { formatNotifDate } from '../../utils/notificationShared'

interface NotifItemProps {
  item: AppNotification
  onMarkRead: (id: string) => void
  onNavigate?: (url: string, title?: string) => void
  locale: string
  largeDetailButton?: boolean
  listIndex?: number
}

function notificationTitleTone(title: string): string | null {
  if (/(reddedildi|iptal edildi|İptal Edildi)/i.test(title)) return 'text-red-600'
  if (/(onaylandı|tamamlandı)/i.test(title)) return 'text-emerald-600'
  return null
}

function NotificationEntityLabelText({
  value,
  plainClassName,
  isUnread,
}: {
  value: string
  plainClassName: string
  isUnread: boolean
}) {
  const entityWeight = isUnread ? 'font-bold text-slate-900' : plainClassName
  return value.split(/(Görev|Talep)/g).map((segment, index) => {
    if (!segment) return null
    if (segment === 'Görev' || segment === 'Talep') {
      return <span key={index} className={entityWeight}>{segment}</span>
    }
    return <span key={index} className={plainClassName}>{segment}</span>
  })
}

function NotificationTitleStatusText({
  value,
  plainClassName,
  isUnread,
}: {
  value: string
  plainClassName: string
  isUnread: boolean
}) {
  const emphasis = isUnread ? 'font-bold' : 'font-medium'
  return value.split(/(onaylandı|reddedildi|tamamlandı|Tamamlandı|İptal Edildi|güncellendi|oluşturuldu|atandı|yönlendirildi|Yönetici notu atandı|Ek süre talebi)/gi).map((part, index) => {
    if (!part) return null
    if (/^onaylandı$/i.test(part)) return <span key={index} className={`${emphasis} text-emerald-600`}>{part}</span>
    if (/^tamamlandı$/i.test(part)) return <span key={index} className={`${emphasis} text-emerald-600`}>{part}</span>
    if (/^reddedildi$/i.test(part)) return <span key={index} className={`${emphasis} text-red-600`}>{part}</span>
    if (/^İptal Edildi$/i.test(part)) return <span key={index} className={`${emphasis} text-red-600`}>{part}</span>
    if (/^(güncellendi|oluşturuldu|atandı|yönlendirildi|Yönetici notu atandı|Ek süre talebi)$/i.test(part)) {
      return <span key={index} className={emphasis}>{part}</span>
    }
    return <NotificationEntityLabelText key={index} value={part} plainClassName={plainClassName} isUnread={isUnread} />
  })
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
        <span className={`${isUnread ? 'font-bold' : 'font-medium'} ${tone}`}>{mainText}</span>
      ) : (
        <NotificationTitleStatusText value={mainText} isUnread={isUnread} plainClassName={mainWeight} />
      )}
      {suffix ? <span className="font-normal text-slate-600"> {suffix}</span> : null}
    </>
  )
}

function NotifItem({ item: n, onMarkRead, onNavigate, locale, largeDetailButton = false, listIndex }: NotifItemProps) {
  const { t } = useTranslation()
  const canMarkRead = !n.isRead
  const handleRowClick = () => {
    if (canMarkRead) onMarkRead(n.notificationId)
  }
  const handleOpenDetail = () => {
    if (canMarkRead) onMarkRead(n.notificationId)
    if (n.actionUrl && onNavigate) onNavigate(n.actionUrl, n.title)
  }

  return (
    <li
      className="group relative flex cursor-pointer gap-3 bg-white px-4 py-3 transition-colors duration-150 hover:bg-slate-50"
      onClick={handleRowClick}
    >
      <div className={`mt-1 w-1 shrink-0 self-stretch rounded-full transition-colors
        ${!n.isRead ? 'bg-slate-300 group-hover:bg-slate-400' : 'bg-emerald-500'}`} />

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {listIndex != null ? (
            <span className="mr-1.5 text-slate-500">{listIndex + 1}.</span>
          ) : null}
          <NotificationTitle title={n.title} isUnread={!n.isRead} />
          {n.titleTag ? (
            <span className={`ml-1 inline-flex items-center gap-0.5 text-[0.7rem] leading-none text-emerald-600 ${n.isRead ? 'font-medium' : 'font-semibold'}`}>
              (
              {n.titleTagChannel ? <ChannelIcon channel={n.titleTagChannel} className="size-2.5 shrink-0" /> : null}
              {n.titleTag})
            </span>
          ) : null}
        </p>
        {n.message && (
          <p className="mt-0.5 text-xs font-normal text-slate-500 line-clamp-2">
            {n.message.split(' — ').map((part, index) => (
              <Fragment key={`${index}-${part.slice(0, 20)}`}>
                {index > 0 ? <span className="text-emerald-600"> — </span> : null}
                {part}
              </Fragment>
            ))}
          </p>
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

interface NotificationPreviewListProps {
  items: AppNotification[]
  onMarkRead: (id: string) => void
  onNavigate?: (url: string, title?: string) => void
  locale: string
  largeDetailButton?: boolean
  indexOffset?: number
}

export function NotificationPreviewList({
  items,
  onMarkRead,
  onNavigate,
  locale,
  largeDetailButton = false,
  indexOffset = 0,
}: NotificationPreviewListProps) {
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
      {items.map((n, index) => (
        <NotifItem
          key={n.notificationId}
          item={n}
          onMarkRead={onMarkRead}
          onNavigate={onNavigate}
          locale={locale}
          largeDetailButton={largeDetailButton}
          listIndex={indexOffset + index}
        />
      ))}
    </ul>
  )
}
