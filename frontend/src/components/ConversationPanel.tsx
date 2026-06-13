import { useEffect, useRef, useState } from 'react'
import { Send, X, Loader2, FileText, Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SocialConversationEntry } from '../types/platform'
import { api } from '../api/client'
import { Button } from './ui/button'
import { getLocale } from '../utils/localization'

interface ConversationPanelProps {
  socialMessageId: string
  citizenHandle: string
  onClose: () => void
  canReply?: boolean
  onReplySent?: () => void
}

function MediaBubble({ entry, socialMessageId }: { entry: SocialConversationEntry; socialMessageId: string }) {
  const mime = entry.mediaMimeType ?? ''
  const mediaUrl = api.getSocialMediaUrl(socialMessageId, entry.entryId)

  if (mime.startsWith('image/')) {
    return (
      <img
        src={mediaUrl}
        alt="media"
        className="max-w-[16rem] max-h-48 rounded-xl object-cover border border-white/20 cursor-pointer"
        onClick={() => window.open(mediaUrl, '_blank')}
      />
    )
  }

  if (mime.startsWith('video/')) {
    return (
      <video
        src={mediaUrl}
        controls
        className="max-w-[16rem] max-h-48 rounded-xl border border-white/20"
      />
    )
  }

  if (mime.startsWith('audio/')) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-xl">
        <Volume2 className="size-4 shrink-0" />
        <audio src={mediaUrl} controls className="h-7" />
      </div>
    )
  }

  // document / other
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-xl text-sm font-semibold underline-offset-2 hover:underline"
    >
      <FileText className="size-4 shrink-0" />
      {mime || 'Dosya'}
    </a>
  )
}

function EntryBubble({ entry, socialMessageId }: { entry: SocialConversationEntry; socialMessageId: string }) {
  const { i18n } = useTranslation()
  const isInbound = entry.direction === 'Inbound'
  const hasMedia = Boolean(entry.mediaId) && entry.entryId !== '00000000-0000-0000-0000-000000000000'

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
          isInbound
            ? 'bg-white/90 text-slate-800 rounded-tl-sm'
            : 'bg-[color:var(--color-primary)] text-white rounded-tr-sm'
        }`}
      >
        {hasMedia && (
          <div className="mb-1.5">
            <MediaBubble entry={entry} socialMessageId={socialMessageId} />
          </div>
        )}
        {entry.content && !entry.content.startsWith('[') && (
          <p className="whitespace-pre-wrap break-words leading-snug">{entry.content}</p>
        )}
        {entry.content.startsWith('[') && !hasMedia && (
          <p className="italic opacity-70 text-xs">{entry.content}</p>
        )}
        <p className={`mt-1 text-[10px] ${isInbound ? 'text-slate-400' : 'text-white/60'} text-right`}>
          {new Date(entry.sentAt).toLocaleString(getLocale(i18n.language), { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

export function ConversationPanel({ socialMessageId, citizenHandle, onClose, canReply = true, onReplySent }: ConversationPanelProps) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<SocialConversationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    api.getSocialConversation(socialMessageId)
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [socialMessageId])

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
      const updated = await api.getSocialConversation(socialMessageId)
      setEntries(updated)
      onReplySent?.()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
            {t('social.conversation', 'Konuşma')}
          </p>
          <p className="font-bold text-sm text-slate-800 truncate">{citizenHandle}</p>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
        style={{ background: 'linear-gradient(180deg, #e5ffe8 0%, #f0f9ff 100%)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-5 animate-spin text-[color:var(--color-primary)]" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-sm text-slate-400 mt-8">{t('social.noMessages', 'Henüz mesaj yok')}</p>
        ) : (
          entries.map((entry, i) => (
            <EntryBubble key={entry.entryId || i} entry={entry} socialMessageId={socialMessageId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      {canReply && (
        <div className="flex items-end gap-2 px-3 py-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] shrink-0">
          <textarea
            rows={1}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
            placeholder={t('social.replyPlaceholder', 'Yanıt yaz…')}
            className="field-input flex-1 resize-none min-h-[2.4rem] max-h-28 py-2 text-sm"
            style={{ height: 'auto' }}
          />
          <Button size="sm" onClick={() => void handleSend()} disabled={!replyText.trim() || sending} className="shrink-0 self-end">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      )}
    </div>
  )
}
