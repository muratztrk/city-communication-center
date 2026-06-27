import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateSocialMessages } from '../api/cacheInvalidation'
import { queryKeys } from '../api/queryKeys'
import { Button } from './ui/button'
import { ConversationEntryBubble } from './ConversationEntryBubble'
import { WhatsAppTemplatePicker } from './WhatsAppTemplatePicker'
import { getLocale } from '../utils/localization'
import { conversationSameDay, formatConversationDayDivider } from '../utils/conversationDayLabel'

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

/** İsimden baş harfleri çıkarır (en fazla 2). Harf yoksa null döner. */
function getInitials(value: string): string | null {
  const words = value.trim().split(/\s+/).filter(w => /\p{L}/u.test(w))
  if (words.length === 0) return null
  return words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full bg-black/25 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
        {label}
      </span>
    </div>
  )
}

export function ConversationPanel({ socialMessageId, citizenHandle, citizenPhone, onClose, canReply = true, onReplySent, onAddMediaAsAttachment, headerMode = 'default' }: ConversationPanelProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const locale = getLocale(i18n.language)
  const dayLabel = (iso: string) => formatConversationDayDivider(iso, locale, t)
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

  const headerKicker = headerMode === 'phone'
    ? t('whatsapp.phoneNoHeader', 'Whatsapp Telefon No')
    : t('social.conversation', 'Konuşma')

  const initials = getInitials(citizenHandle)

  return (
    <div className="flex flex-col h-full">
      {/* Header — markaya göre temalanır (yeşil/mavi) */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0 text-white"
        style={{ backgroundColor: 'var(--color-header-from)' }}
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold" style={{ color: 'var(--color-header-from)' }}>
          {initials ?? <MessageCircle className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">{headerKicker}</p>
          <p className="truncate text-[15px] font-semibold leading-tight">{headerSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          aria-label={t('common.close', 'Kapat')}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 min-h-0"
        style={{ background: 'linear-gradient(165deg, var(--color-header-from), var(--color-header-to))' }}
      >
        {conversationQuery.isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-5 animate-spin text-white/80" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-sm text-white/70 mt-8">{t('social.noMessages', 'Henüz mesaj yok')}</p>
        ) : (
          entries.map((entry, i) => {
            const showDivider = i === 0 || !conversationSameDay(entry.sentAt, entries[i - 1].sentAt)
            return (
              <Fragment key={entry.entryId || i}>
                {showDivider && <DateDivider label={dayLabel(entry.sentAt)} />}
                <ConversationEntryBubble
                  entry={entry}
                  socialMessageId={socialMessageId}
                  citizenPhone={citizenPhone}
                  onAddMediaAsAttachment={onAddMediaAsAttachment}
                />
              </Fragment>
            )
          })
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
