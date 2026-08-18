import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, MapPin, Send, PenLine, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConversationSenderHeader } from './ConversationSenderHeader'
import { SocialConversationMediaBubble } from './SocialConversationMediaBubble'
import { WhatsAppDeliveryStatusIndicator } from './WhatsAppDeliveryStatusIndicator'
import { getLocale } from '../utils/localization'
import { formatConversationSenderLabel } from '../utils/formatConversationSenderLabel'
import {
  buildGoogleMapsOpenUrl,
  formatContactDisplayContent,
  formatConversationDisplayContent,
  getLocationPlaceDescription,
  isContactConversationContent,
  isLocationConversationContent,
  isPlaceholderBracketContent,
  parseAttachmentFilenameFromContent,
  parseConversationLocationCoords,
} from '../utils/socialConversationContent'
import { formatWhatsAppDeliveryError, isWhatsAppReEngagementError } from '../utils/formatWhatsAppDeliveryError'
import { formatConversationMessageTime } from '../utils/conversationListTime'

export interface ConversationEntryBubbleData {
  entryId: string
  direction: 'Inbound' | 'Outbound'
  content: string
  mediaId: string | null
  mediaMimeType: string | null
  sentAt: string
  socialMessageId?: string | null
  senderLabel?: string | null
  deliveryStatus?: 'Pending' | 'Sent' | 'Delivered' | 'Read' | 'Failed' | string | null
  deliveryError?: string | null
  editedAtUtc?: string | null
  editedByDisplayName?: string | null
  relatedJobTerminalStatus?: 'Completed' | 'Cancelled' | string | null
  relatedJobTerminalNote?: string | null
  relatedJobMessageApproverDisplayName?: string | null
  latitude?: number | null
  longitude?: number | null
  isAutomaticMessage?: boolean
}

interface ConversationEntryBubbleProps {
  entry: ConversationEntryBubbleData
  socialMessageId?: string
  citizenPhone?: string | null
  onAddMediaAsAttachment?: (file: File) => void
  theme?: 'dark' | 'light'
  /** Beklemedeki giden mesajın yanında "Mesajı Gönder"/"Düzenle" butonları gösterilsin mi (yalnızca operatör) — card #1091/#1094. */
  canSendPending?: boolean
  onSendPending?: (entryId: string) => void
  sendingPending?: boolean
  /** Beklemedeki mesaj metnini düzenler (yalnızca operatör) — card #1094. */
  onEditPending?: (entryId: string, content: string) => void | Promise<void>
  /** 24 saat penceresi kapalıysa bekleyen giden mesaj düzenlemesini engelle (card #2537). */
  conversationOutside24hWindow?: boolean
  /** 24 saat re-engagement / şablon uyarısı popup (card #2537). */
  onReEngagementBlocked?: () => void
  onShowTerminalNote?: (entry: ConversationEntryBubbleData) => void
  inboundSenderLabel?: string | null
  /** Vatandaş Talebi Oluştur modalında balonları biraz küçült (card #1711). */
  compact?: boolean
}

/** Hover 250ms sonra yönetici adını gösterir (card #2092). */
function DelayedHoverTooltip({
  label,
  tooltip,
  className,
  icon,
}: {
  label: string
  tooltip: string
  className: string
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
  }, [])

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => {
        timerRef.current = window.setTimeout(() => setOpen(true), 250)
      }}
      onMouseLeave={() => {
        if (timerRef.current != null) window.clearTimeout(timerRef.current)
        timerRef.current = null
        setOpen(false)
      }}
    >
      <span className={className} role="button" tabIndex={0}>
        {icon}
        {label}
      </span>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-[calc(100%+0.35rem)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg"
        >
          {tooltip}
        </span>
      ) : null}
    </span>
  )
}

export function ConversationEntryBubble({
  entry,
  socialMessageId,
  citizenPhone,
  onAddMediaAsAttachment,
  theme = 'dark',
  canSendPending = false,
  onSendPending,
  sendingPending = false,
  onEditPending,
  onReEngagementBlocked,
  conversationOutside24hWindow = false,
  onShowTerminalNote: _onShowTerminalNote,
  inboundSenderLabel,
  compact = false,
}: ConversationEntryBubbleProps) {
  const resolvedSocialMessageId = socialMessageId ?? entry.socialMessageId ?? ''
  const { t, i18n } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(entry.content)
  const [savingEdit, setSavingEdit] = useState(false)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [lockedBubbleSize, setLockedBubbleSize] = useState<{ width: number; height: number } | null>(null)
  const isInbound = entry.direction === 'Inbound'
  const isPending = !isInbound && entry.deliveryStatus === 'Pending'
  const messageApproverName = entry.relatedJobMessageApproverDisplayName?.trim() || null
  const editedByName = entry.editedByDisplayName?.trim() || null
  const deliveryErrorMessage = formatWhatsAppDeliveryError(entry.deliveryError)
  const isReEngagementFailure = !isInbound
    && entry.deliveryStatus === 'Failed'
    && isWhatsAppReEngagementError(entry.deliveryError)
  // Onaylayan Yönetici yalnız bekleyen terminal / re-engagement hatalarında — otomatik
  // zamanlı şablon yanıtları (Sent) dahil değil (card #2545).
  const showMessageApprover = !isInbound && Boolean(messageApproverName)
    && (isPending || isReEngagementFailure)
  const hasMedia = Boolean(entry.mediaId) && entry.entryId !== '00000000-0000-0000-0000-000000000000'
  const isOutboundImage = !isInbound && hasMedia && Boolean(entry.mediaMimeType?.startsWith('image/'))
  const bubbleMaxWidth = isOutboundImage
    ? compact
      ? 'max-w-[min(54%,15.5rem)]'
      : 'max-w-[min(58%,15.5rem)]'
    : compact
      ? 'max-w-[min(68%,22rem)]'
      : 'max-w-[min(70%,26rem)]'
  const isContactMessage = !hasMedia && isContactConversationContent(entry.content)
  const locationCoords = parseConversationLocationCoords(entry.content, entry.latitude, entry.longitude)
  const locationDescription = getLocationPlaceDescription(entry.content)
  // Konum UI yalnız gerçek konum verisi varken (#2834 / #2838).
  const isLocationMessage = !isContactMessage
    && Boolean(locationCoords)
    && (isLocationConversationContent(entry.content) || entry.latitude != null || entry.longitude != null)
  const locale = getLocale(i18n.language)
  const senderLabel = formatConversationSenderLabel(entry.senderLabel)
  const sentTime = formatConversationMessageTime(entry.sentAt, locale, t)
  const showPendingActions = (isPending || isReEngagementFailure) && canSendPending

  const syncTextareaHeight = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  useLayoutEffect(() => {
    if (isEditing) {
      syncTextareaHeight()
    }
  }, [isEditing, draft])

  const beginEdit = () => {
    if ((isReEngagementFailure && conversationOutside24hWindow) || (conversationOutside24hWindow && isPending)) {
      onReEngagementBlocked?.()
      return
    }
    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect()
      setLockedBubbleSize({ width: rect.width, height: rect.height })
    }
    setDraft(entry.content)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setDraft(entry.content)
    setLockedBubbleSize(null)
  }
  // Kart #2109: Mesajı Onaylayan Yönetici — turkuaz arka plan; Not butonu kaldırıldı.
  const actionBtnClass = compact
    ? 'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60'
    : 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60'
  const actionIconClass = compact ? 'size-3' : 'size-3.5'
  const approverChipClassName = compact
    ? 'inline-flex items-center gap-1 rounded-full bg-teal-600 px-2 py-1 text-[10px] font-semibold text-white shadow-sm'
    : 'inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm'
  const automaticMessageChipClassName = compact
    ? `inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow-sm ${
        theme === 'light' ? 'bg-[color:var(--color-primary)]' : 'bg-sky-600'
      }`
    : `inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm ${
        theme === 'light' ? 'bg-[color:var(--color-primary)]' : 'bg-sky-600'
      }`

  const messageApproverButton = (
    <DelayedHoverTooltip
      label={t('whatsapp.messageApproverButton', 'Onaylayan Yönetici')}
      tooltip={messageApproverName ?? ''}
      className={`${approverChipClassName} cursor-default`}
      icon={<User className={actionIconClass} strokeWidth={1.75} aria-hidden="true" />}
    />
  )

  return (
    <div className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}>
      <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'} w-full`}>
        <div
          ref={bubbleRef}
          className={`${bubbleMaxWidth} ${
            isOutboundImage
              ? compact ? 'rounded-xl px-1.5 py-1.5 text-[11px]' : 'rounded-xl px-1.5 py-1.5 text-[13px]'
              : compact ? 'rounded-xl px-3 py-1.5 text-[11px]' : 'rounded-xl px-3 py-2 text-[13px]'
          } leading-relaxed shadow-md ${
            isInbound
              ? 'bg-white text-slate-800 rounded-tl-sm ring-1 ring-black/[0.04]'
              : 'rounded-tr-sm text-white ring-1 ring-white/10'
          }`}
          style={
            isInbound
              ? lockedBubbleSize != null
                ? { minHeight: lockedBubbleSize.height, minWidth: lockedBubbleSize.width }
                : undefined
              : {
                  ...(theme === 'light'
                    ? { background: 'var(--color-header-from)' }
                    : { background: 'color-mix(in srgb, var(--color-header-from) 55%, #000)' }),
                  ...(lockedBubbleSize != null
                    ? { minHeight: lockedBubbleSize.height, minWidth: lockedBubbleSize.width }
                    : {}),
                }
          }
        >
          {isInbound && inboundSenderLabel ? (
            <ConversationSenderHeader label={inboundSenderLabel} variant="inline" tone="inbound" compact={compact} />
          ) : !isInbound && senderLabel ? (
            <ConversationSenderHeader label={senderLabel} variant="inline" tone="outbound" compact={compact} />
          ) : null}
          {hasMedia && (
            <div className="mb-1.5">
              <SocialConversationMediaBubble
                key={`${resolvedSocialMessageId}-${entry.entryId}`}
                socialMessageId={resolvedSocialMessageId}
                entryId={entry.entryId}
                mediaMimeType={entry.mediaMimeType}
                direction={entry.direction}
                citizenPhone={citizenPhone}
                onAddAsAttachment={onAddMediaAsAttachment}
                sentChip={entry.direction === 'Outbound' && entry.deliveryStatus === 'Pending'}
                requestAttachmentLayout={Boolean(onAddMediaAsAttachment)}
                displayFilename={parseAttachmentFilenameFromContent(entry.content)}
                compactChip={compact}
              />
            </div>
          )}
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={event => {
                setDraft(event.target.value)
                syncTextareaHeight()
              }}
              autoFocus
              className={`block w-full resize-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 ${
                compact ? 'text-[11px] leading-relaxed' : 'text-[13px] leading-snug'
              } ${
                isInbound ? 'text-slate-800 caret-slate-900' : 'text-white caret-white'
              }`}
            />
          ) : isContactMessage ? (
            <p className="inline-flex items-start gap-1.5 text-xs font-semibold leading-snug">
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
                  isInbound
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    : 'border-white/25 bg-white/15 text-white'
                }`}
              >
                <User className="size-3" aria-hidden="true" />
              </span>
              <span className="min-w-0 whitespace-pre-wrap break-words">
                {formatContactDisplayContent(entry.content)}
              </span>
            </p>
          ) : isLocationMessage ? (
            <div className="grid gap-1.5">
              <p className={`inline-flex items-start gap-1.5 leading-snug ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
                    isInbound
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                      : 'border-white/25 bg-white/15 text-white'
                  }`}
                >
                  <MapPin className="size-3" aria-hidden="true" />
                </span>
                <span className="min-w-0 whitespace-pre-wrap break-words">
                  {locationDescription || t('whatsapp.locationMessage', 'Konum')}
                </span>
              </p>
              {locationCoords ? (
                <a
                  href={buildGoogleMapsOpenUrl(locationCoords.latitude, locationCoords.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={event => {
                    event.preventDefault()
                    window.open(
                      buildGoogleMapsOpenUrl(locationCoords.latitude, locationCoords.longitude),
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }}
                  className={`inline-flex w-fit items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold underline-offset-2 hover:underline ${
                    isInbound
                      ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                      : 'bg-white/15 text-white ring-1 ring-white/25'
                  }`}
                >
                  {t('whatsapp.openLocation', 'Haritada Göster')}
                </a>
              ) : (
                <p className={`text-xs italic ${isInbound ? 'text-slate-500' : 'text-white/70'}`}>
                  {t('whatsapp.locationUnavailable', 'Konum koordinatı alınamadı.')}
                </p>
              )}
            </div>
          ) : (
            <>
              {entry.content && !isPlaceholderBracketContent(entry.content) && (
                <p className="whitespace-pre-wrap break-words leading-snug">{formatConversationDisplayContent(entry.content)}</p>
              )}
              {isPlaceholderBracketContent(entry.content) && !hasMedia && (
                <p className="italic opacity-70 text-xs">{formatConversationDisplayContent(entry.content)}</p>
              )}
            </>
          )}
          <p className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] leading-none ${isInbound ? 'text-slate-400' : 'text-white/65'}`}>
            {entry.editedAtUtc ? (
              editedByName ? (
                <DelayedHoverTooltip
                  label={t('whatsapp.editedBadge', 'Düzenlendi')}
                  tooltip={editedByName}
                  className="text-[11px] font-bold leading-none tracking-wide text-orange-400 cursor-default"
                />
              ) : (
                <span className="text-[11px] font-bold leading-none tracking-wide text-orange-400">{t('whatsapp.editedBadge', 'Düzenlendi')}</span>
              )
            ) : null}
            {isPending ? (
              <span className="font-semibold tracking-wide">{t('whatsapp.pendingBadge', 'Beklemede')}</span>
            ) : !isInbound && entry.deliveryStatus ? (
              <WhatsAppDeliveryStatusIndicator
                status={entry.deliveryStatus}
                error={entry.deliveryError}
                variant="dark"
              />
            ) : null}
            {!isInbound && entry.deliveryStatus ? <span aria-hidden="true">·</span> : null}
            <span>{sentTime}</span>
          </p>
          {!isInbound && entry.deliveryStatus === 'Failed' && deliveryErrorMessage ? (
            <p className={`mt-1 text-[10px] leading-snug ${theme === 'light' ? 'text-red-100' : 'text-red-200'}`}>
              {deliveryErrorMessage}
            </p>
          ) : null}
        </div>
      </div>
      {!isInbound && entry.isAutomaticMessage ? (
        <span className={`mt-1 ${automaticMessageChipClassName}`}>
          {t('whatsapp.automaticMessage', 'Otomatik Mesaj')}
        </span>
      ) : null}
      {showPendingActions ? (
        isEditing ? (
          <div className={`mt-1 flex items-center gap-1.5 ${compact ? 'min-h-[1.75rem]' : 'min-h-[2.125rem]'}`}>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={savingEdit}
              className={`inline-flex items-center rounded-full bg-slate-200 font-semibold text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-60 ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1 text-xs'}`}
            >
              {t('common.dismiss', 'Vazgeç')}
            </button>
            <button
              type="button"
              onClick={async () => {
                const text = draft.trim()
                if (!text || savingEdit) return
                setSavingEdit(true)
                try {
                  await onEditPending?.(entry.entryId, text)
                  cancelEdit()
                } finally {
                  setSavingEdit(false)
                }
              }}
              disabled={savingEdit || !draft.trim()}
              className={`${actionBtnClass} bg-emerald-600 hover:bg-emerald-700`}
            >
              {savingEdit ? <Loader2 className={`${actionIconClass} animate-spin`} /> : null}
              {t('common.save', 'Kaydet')}
            </button>
          </div>
        ) : (
          <div className={`mt-1 flex flex-wrap items-center justify-end gap-1.5 ${compact ? 'min-h-[1.75rem]' : 'min-h-[2.125rem]'}`}>
            <button
              type="button"
              onClick={beginEdit}
              disabled={sendingPending}
              className={`${actionBtnClass} bg-orange-500 hover:bg-orange-600`}
            >
              <PenLine className={actionIconClass} strokeWidth={1.75} aria-hidden="true" />
              {t('common.edit', 'Düzenle')}
            </button>
            {showMessageApprover ? messageApproverButton : null}
            <button
              type="button"
              onClick={() => onSendPending?.(entry.entryId)}
              disabled={sendingPending}
              className={`${actionBtnClass} bg-emerald-600 hover:bg-emerald-700`}
            >
              {sendingPending ? <Loader2 className={`${actionIconClass} animate-spin`} /> : <Send className={actionIconClass} />}
              {t('whatsapp.sendPendingMessage', 'Mesajı Gönder')}
            </button>
          </div>
        )
      ) : showMessageApprover ? (
        <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
          {messageApproverButton}
        </div>
      ) : null}
    </div>
  )
}
