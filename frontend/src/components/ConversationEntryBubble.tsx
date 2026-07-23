import { useState } from 'react'
import { Loader2, Send, PenLine, CheckCheck, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConversationSenderHeader } from './ConversationSenderHeader'
import { SocialConversationMediaBubble } from './SocialConversationMediaBubble'
import { WhatsAppDeliveryStatusIndicator } from './WhatsAppDeliveryStatusIndicator'
import { getLocale } from '../utils/localization'
import { formatConversationSenderLabel } from '../utils/formatConversationSenderLabel'
import { formatConversationDisplayContent, isPlaceholderBracketContent } from '../utils/socialConversationContent'
import { formatWhatsAppDeliveryError } from '../utils/formatWhatsAppDeliveryError'
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
  relatedJobTerminalStatus?: 'Completed' | 'Cancelled' | string | null
  relatedJobTerminalNote?: string | null
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
  onShowTerminalNote?: (entry: ConversationEntryBubbleData) => void
  inboundSenderLabel?: string | null
  /** Vatandaş Talebi Oluştur modalında balonları biraz küçült (card #1711). */
  compact?: boolean
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
  onShowTerminalNote,
  inboundSenderLabel,
  compact = false,
}: ConversationEntryBubbleProps) {
  const resolvedSocialMessageId = socialMessageId ?? entry.socialMessageId ?? ''
  const { t, i18n } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(entry.content)
  const [savingEdit, setSavingEdit] = useState(false)
  const isInbound = entry.direction === 'Inbound'
  const isPending = !isInbound && entry.deliveryStatus === 'Pending'
  const isDeliveredOutbound = !isInbound
    && (entry.deliveryStatus === 'Sent'
      || entry.deliveryStatus === 'Delivered'
      || entry.deliveryStatus === 'Read')
  const terminalNoteKind = entry.relatedJobTerminalStatus === 'Cancelled'
    ? 'cancelled'
    : entry.relatedJobTerminalStatus === 'Completed'
      ? 'completed'
      : null
  const normalizedContent = entry.content.toLocaleLowerCase('tr')
  const entryMatchesTerminalStatus = terminalNoteKind === 'cancelled'
    ? normalizedContent.includes('iptal')
    : terminalNoteKind === 'completed'
      ? normalizedContent.includes('tamamlandı') || normalizedContent.includes('tamamlanmış')
      : false
  const hasTerminalNote = terminalNoteKind != null
    && entryMatchesTerminalStatus
    && Boolean(entry.relatedJobTerminalNote?.trim())
  // Beklemede: operatör aksiyon satırında; iletildikten sonra bilgi amaçlı (card #1861).
  const showTerminalNotePending = isPending && canSendPending && hasTerminalNote
  const showTerminalNoteInfo = isDeliveredOutbound && hasTerminalNote
  const terminalNoteLabel = terminalNoteKind === 'cancelled'
    ? t('whatsapp.terminalNote.cancel', 'Talep İptal Notu')
    : t('whatsapp.terminalNote.completion', 'Talep Tamamlanma Notu')
  const terminalNoteButtonClass = terminalNoteKind === 'cancelled'
    ? 'bg-[color:var(--color-destructive)] hover:brightness-95'
    : 'bg-teal-600 hover:bg-teal-700'
  const hasMedia = Boolean(entry.mediaId) && entry.entryId !== '00000000-0000-0000-0000-000000000000'
  const locale = getLocale(i18n.language)
  const senderLabel = formatConversationSenderLabel(entry.senderLabel)
  const sentTime = formatConversationMessageTime(entry.sentAt, locale, t)
  const deliveryErrorMessage = formatWhatsAppDeliveryError(entry.deliveryError)

  return (
    <div className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}>
      <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'} w-full`}>
        <div
          className={`${compact ? 'max-w-[min(68%,22rem)] rounded-xl px-3 py-1.5 text-xs' : 'max-w-[min(72%,28rem)] rounded-2xl px-4 py-2.5 text-sm'} leading-relaxed shadow-md ${
            isInbound
              ? 'bg-white text-slate-800 rounded-tl-sm ring-1 ring-black/[0.04]'
              : 'rounded-tr-sm text-white ring-1 ring-white/10'
          }`}
          style={
            isInbound
              ? undefined
              : theme === 'light'
                ? { background: 'var(--color-header-from)' }
                : { background: 'color-mix(in srgb, var(--color-header-from) 55%, #000)' }
          }
        >
          {isInbound && inboundSenderLabel ? (
            <ConversationSenderHeader label={inboundSenderLabel} variant="inline" tone="inbound" />
          ) : !isInbound && senderLabel ? (
            <ConversationSenderHeader label={senderLabel} variant="inline" tone="outbound" />
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
              />
            </div>
          )}
          {isEditing ? (
            // Mesaj metni aynı balon üzerinde düzenlenir (card #1094).
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={3}
              autoFocus
              className="w-full min-w-[14rem] resize-none rounded-lg bg-white/95 px-2 py-1.5 text-sm leading-snug text-slate-900 outline-none ring-1 ring-white/40"
            />
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
          <p className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${isInbound ? 'text-slate-400' : 'text-white/65'}`}>
            {isPending ? (
              <>
                {entry.editedAtUtc ? (
                  <span className="font-semibold uppercase tracking-wide text-orange-400">{t('whatsapp.editedBadge', 'Düzenlendi')}</span>
                ) : null}
                <span className="font-semibold uppercase tracking-wide">{t('whatsapp.pendingBadge', 'Beklemede')}</span>
              </>
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
      {isPending && canSendPending ? (
        isEditing ? (
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setIsEditing(false); setDraft(entry.content) }}
              disabled={savingEdit}
              className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-60"
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
                  setIsEditing(false)
                } finally {
                  setSavingEdit(false)
                }
              }}
              disabled={savingEdit || !draft.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {savingEdit ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t('common.save', 'Kaydet')}
            </button>
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setDraft(entry.content); setIsEditing(true) }}
              disabled={sendingPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PenLine className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {t('common.edit', 'Düzenle')}
            </button>
            {showTerminalNotePending ? (
              <button
                type="button"
                onClick={() => onShowTerminalNote?.(entry)}
                disabled={sendingPending}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${terminalNoteButtonClass}`}
              >
                {terminalNoteKind === 'cancelled'
                  ? <XCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  : <CheckCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />}
                {terminalNoteLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onSendPending?.(entry.entryId)}
              disabled={sendingPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendingPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              {t('whatsapp.sendPendingMessage', 'Mesajı Gönder')}
            </button>
          </div>
        )
      ) : showTerminalNoteInfo ? (
        <div className="mt-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onShowTerminalNote?.(entry)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors ${terminalNoteButtonClass}`}
          >
            {terminalNoteKind === 'cancelled'
              ? <XCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              : <CheckCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />}
            {terminalNoteLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
