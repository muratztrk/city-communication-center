import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateSocialMessages } from '../api/cacheInvalidation'
import { queryKeys } from '../api/queryKeys'
import { Button } from './ui/button'
import { ConfirmDialog, type ConfirmDialogState } from './ui/confirm-dialog'
import { ConversationEntryBubble } from './ConversationEntryBubble'
import { UserQuickReplyAddButton } from './UserQuickReplyDialog'
import { WhatsAppTemplatePicker } from './WhatsAppTemplatePicker'
import { ModalCloseButton } from './ui/modal-close-button'
import { getLocale } from '../utils/localization'
import { conversationSameDay, formatConversationDayDivider } from '../utils/conversationDayLabel'

interface ConversationPanelProps {
  socialMessageId: string
  citizenHandle: string
  citizenPhone?: string | null
  onClose: () => void
  canReply?: boolean
  /** Beklemedeki giden mesajların yanında "Mesajı Gönder" butonu göster (yalnızca operatör) — card #1091. */
  canSendPending?: boolean
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
    <div className="flex justify-center py-1.5">
      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/80">
        {label}
      </span>
    </div>
  )
}

export function ConversationPanel({ socialMessageId, citizenHandle, citizenPhone, onClose, canReply = true, canSendPending = false, onReplySent, onAddMediaAsAttachment, headerMode = 'default' }: ConversationPanelProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const locale = getLocale(i18n.language)
  const dayLabel = (iso: string) => formatConversationDayDivider(iso, locale, t)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendingPendingId, setSendingPendingId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const conversationQuery = useQuery({
    queryKey: queryKeys.socialMessages.conversation(socialMessageId),
    queryFn: () => api.getSocialConversation(socialMessageId),
  })
  const templatesQuery = useQuery({
    queryKey: queryKeys.whatsappTemplates.list(),
    queryFn: () => api.getWhatsAppTemplates(),
  })
  const userQuickRepliesQuery = useQuery({
    queryKey: queryKeys.userQuickReplies.list(),
    queryFn: () => api.getUserQuickReplies(),
  })
  const entries = useMemo(() => conversationQuery.data ?? [], [conversationQuery.data])
  const templates = templatesQuery.data ?? []
  const userQuickReplies = userQuickRepliesQuery.data ?? []

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

  const doSendPending = async (entryId: string) => {
    if (sendingPendingId) return
    setSendingPendingId(entryId)
    try {
      await api.sendPendingConversationEntry(socialMessageId, entryId)
      invalidateSocialMessages(queryClient, socialMessageId)
    } finally {
      setSendingPendingId(null)
    }
  }

  const handleSendPending = (entryId: string) => {
    setConfirmDialog({
      title: t('whatsapp.sendPendingConfirmTitle', 'Mesajı Gönder'),
      titleDivider: true,
      message: t('whatsapp.sendPendingConfirmMessage', 'Bu mesaj vatandaşa WhatsApp üzerinden iletilecek. Onaylıyor musunuz?'),
      confirmLabel: t('whatsapp.sendPendingMessage', 'Mesajı Gönder'),
      variant: 'success',
      onConfirm: () => doSendPending(entryId),
    })
  }

  const handleEditPending = async (entryId: string, content: string) => {
    await api.editPendingConversationEntry(socialMessageId, entryId, content)
    invalidateSocialMessages(queryClient, socialMessageId)
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
        <ModalCloseButton
          onClick={onClose}
          label={t('common.close', 'Kapat')}
          className="size-8 shrink-0 text-white/80 hover:bg-white/15 hover:text-white"
        />
      </div>

      <div className="whatsapp-chat-bg min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {conversationQuery.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : entries.length === 0 ? (
          <p className="mt-8 text-center text-sm text-slate-500">{t('social.noMessages', 'Henüz mesaj yok')}</p>
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
                  theme="light"
                  onAddMediaAsAttachment={onAddMediaAsAttachment}
                  canSendPending={canSendPending}
                  onSendPending={handleSendPending}
                  sendingPending={sendingPendingId === entry.entryId}
                  onEditPending={handleEditPending}
                />
              </Fragment>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canReply && (
        <div className="shrink-0 space-y-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <WhatsAppTemplatePicker
              templates={templates}
              userQuickReplies={userQuickReplies}
              onSelect={content => setReplyText(content)}
            />
            <UserQuickReplyAddButton onChanged={() => { void userQuickRepliesQuery.refetch() }} />
          </div>
          <div className="flex items-end gap-2">
            <textarea
              rows={3}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
              placeholder={t('social.replyPlaceholder', 'Yanıt yaz…')}
              className="field-input min-w-0 flex-1 resize-none min-h-[4.5rem] max-h-28 py-2 text-sm"
              style={{ height: 'auto' }}
            />
            <Button size="sm" onClick={() => void handleSend()} disabled={!replyText.trim() || sending} className="self-stretch shrink-0">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
