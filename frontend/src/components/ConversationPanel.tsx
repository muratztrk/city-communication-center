import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, Loader2, Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { SocialConversationEntry } from '../types/platform'
import { api } from '../api/client'
import { invalidateSocialMessages } from '../api/cacheInvalidation'
import { queryKeys } from '../api/queryKeys'
import { Button } from './ui/button'
import { SocialConversationMediaBubble } from './SocialConversationMediaBubble'
import { WhatsAppTemplatePicker } from './WhatsAppTemplatePicker'
import { getLocale } from '../utils/localization'
import { ConversationSenderHeader } from './ConversationSenderHeader'
import { formatBracketContent, isPlaceholderBracketContent } from '../utils/socialConversationContent'

interface ConversationPanelProps {
  socialMessageId: string
  citizenHandle: string
  citizenPhone?: string | null
  onClose: () => void
  canReply?: boolean
  onReplySent?: () => void
  onAddMediaAsAttachment?: (file: File) => void
  /** Popup'ta telefon numarası başlığı göster (card 6a3f8858). */
  headerMode?: 'default' | 'phone'
}

function EntryBubble({
  entry,
  socialMessageId,
  citizenPhone,
  onAddMediaAsAttachment,
}: {
  entry: SocialConversationEntry
  socialMessageId: string
  citizenPhone?: string | null
  onAddMediaAsAttachment?: (file: File) => void
}) {
  const { i18n } = useTranslation()
  const isInbound = entry.direction === 'Inbound'
  const hasMedia = Boolean(entry.mediaId) && entry.entryId !== '00000000-0000-0000-0000-000000000000'
  const senderLabel = entry.senderLabel?.trim()

  return (
    <div className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}>
      {senderLabel ? (
        <ConversationSenderHeader label={senderLabel} align={isInbound ? 'start' : 'end'} />
      ) : null}
      <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'} w-full`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
          isInbound
            ? 'bg-white/90 text-slate-800 rounded-tl-sm'
            : 'bg-[color:var(--color-primary)] text-white rounded-tr-sm'
        }`}
      >
        {hasMedia && (
          <div className="mb-1.5">
            <SocialConversationMediaBubble
              key={`${socialMessageId}-${entry.entryId}`}
              socialMessageId={socialMessageId}
              entryId={entry.entryId}
              mediaMimeType={entry.mediaMimeType}
              direction={entry.direction}
              citizenPhone={citizenPhone}
              onAddAsAttachment={onAddMediaAsAttachment}
            />
          </div>
        )}
        {entry.content && !isPlaceholderBracketContent(entry.content) && (
          <p className="whitespace-pre-wrap break-words leading-snug">{entry.content}</p>
        )}
        {isPlaceholderBracketContent(entry.content) && !hasMedia && (
          <p className="italic opacity-70 text-xs">{formatBracketContent(entry.content)}</p>
        )}
        <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isInbound ? 'text-slate-400' : 'text-white/60'}`}>
          <CalendarClock className="size-3 shrink-0" />
          {new Date(entry.sentAt).toLocaleString(getLocale(i18n.language), { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
        </p>
      </div>
      </div>
    </div>
  )
}

export function ConversationPanel({ socialMessageId, citizenHandle, citizenPhone, onClose, canReply = true, onReplySent, onAddMediaAsAttachment, headerMode = 'default' }: ConversationPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const conversationQuery = useQuery({
    queryKey: queryKeys.socialMessages.conversation(socialMessageId),
    queryFn: () => api.getSocialConversation(socialMessageId),
  })
  const templatesQuery = useQuery({
    queryKey: queryKeys.whatsappTemplates.list(),
    queryFn: () => api.getWhatsAppTemplates(),
  })
  const entries = useMemo(() => conversationQuery.data ?? [], [conversationQuery.data])
  const templates = templatesQuery.data ?? []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  const handleSend = async () => {
    const text = replyText.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await api.replySocialMessage(socialMessageId, text)
      setReplyText('')
      invalidateSocialMessages(queryClient, socialMessageId)
      onReplySent?.()
    } finally {
      setSending(false)
    }
  }

  const headerSubtitle = headerMode === 'phone'
    ? (citizenPhone?.replace(/\D/g, '').replace(/^90(?=\d{10}$)/, '') || citizenHandle)
    : citizenHandle

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
            {headerMode === 'phone'
              ? t('whatsapp.phoneNoHeader', 'Whatsapp Telefon No')
              : t('social.conversation', 'Konuşma')}
          </p>
          <p className="font-bold text-sm text-slate-800 truncate">{headerSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 shrink-0"
          aria-label={t('common.close', 'Kapat')}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
        style={{ background: 'linear-gradient(145deg, var(--color-header-from), var(--color-header-to))' }}
      >
        {conversationQuery.isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-5 animate-spin text-[color:var(--color-primary)]" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-sm text-slate-400 mt-8">{t('social.noMessages', 'Henüz mesaj yok')}</p>
        ) : (
          entries.map((entry, i) => (
            <EntryBubble
              key={entry.entryId || i}
              entry={entry}
              socialMessageId={socialMessageId}
              citizenPhone={citizenPhone}
              onAddMediaAsAttachment={onAddMediaAsAttachment}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      {canReply && (
        <div className="flex items-end gap-2 px-3 py-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] shrink-0">
          <textarea
            rows={3}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
            placeholder={t('social.replyPlaceholder', 'Yanıt yaz…')}
            className="field-input min-w-0 flex-1 resize-none min-h-[4.5rem] max-h-28 py-2 text-sm"
            style={{ height: 'auto' }}
          />
          <div className="flex shrink-0 flex-col items-stretch gap-1.5 self-end">
            <WhatsAppTemplatePicker
              templates={templates}
              onSelect={content => setReplyText(content)}
            />
            <Button size="sm" onClick={() => void handleSend()} disabled={!replyText.trim() || sending} className="self-stretch">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
