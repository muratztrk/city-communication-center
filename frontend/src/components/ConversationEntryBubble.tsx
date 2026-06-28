import { useTranslation } from 'react-i18next'
import { ConversationSenderHeader } from './ConversationSenderHeader'
import { SocialConversationMediaBubble } from './SocialConversationMediaBubble'
import { WhatsAppDeliveryStatusIndicator } from './WhatsAppDeliveryStatusIndicator'
import { getLocale } from '../utils/localization'
import { formatConversationSenderLabel } from '../utils/formatConversationSenderLabel'
import { formatConversationDisplayContent, isPlaceholderBracketContent } from '../utils/socialConversationContent'

export interface ConversationEntryBubbleData {
  entryId: string
  direction: 'Inbound' | 'Outbound'
  content: string
  mediaId: string | null
  mediaMimeType: string | null
  sentAt: string
  socialMessageId?: string
  senderLabel?: string | null
  deliveryStatus?: 'Sent' | 'Delivered' | 'Read' | 'Failed' | string | null
  deliveryError?: string | null
}

interface ConversationEntryBubbleProps {
  entry: ConversationEntryBubbleData
  socialMessageId?: string
  citizenPhone?: string | null
  onAddMediaAsAttachment?: (file: File) => void
  theme?: 'dark' | 'light'
}

export function ConversationEntryBubble({
  entry,
  socialMessageId,
  citizenPhone,
  onAddMediaAsAttachment,
  theme = 'dark',
}: ConversationEntryBubbleProps) {
  const resolvedSocialMessageId = socialMessageId ?? entry.socialMessageId ?? ''
  const { i18n } = useTranslation()
  const isInbound = entry.direction === 'Inbound'
  const hasMedia = Boolean(entry.mediaId) && entry.entryId !== '00000000-0000-0000-0000-000000000000'
  const locale = getLocale(i18n.language)
  const senderLabel = formatConversationSenderLabel(entry.senderLabel)
  const sentTime = new Date(entry.sentAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}>
      <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'} w-full`}>
        <div
          className={`max-w-[min(72%,28rem)] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-md ${
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
          {!isInbound && senderLabel ? (
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
          {entry.content && !isPlaceholderBracketContent(entry.content) && (
            <p className="whitespace-pre-wrap break-words leading-snug">{formatConversationDisplayContent(entry.content)}</p>
          )}
          {isPlaceholderBracketContent(entry.content) && !hasMedia && (
            <p className="italic opacity-70 text-xs">{formatConversationDisplayContent(entry.content)}</p>
          )}
          <p className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${isInbound ? 'text-slate-400' : 'text-white/65'}`}>
            {!isInbound && entry.deliveryStatus ? (
              <WhatsAppDeliveryStatusIndicator
                status={entry.deliveryStatus}
                error={entry.deliveryError}
                variant="dark"
              />
            ) : null}
            {!isInbound && entry.deliveryStatus ? <span aria-hidden="true">·</span> : null}
            <span>{sentTime}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
