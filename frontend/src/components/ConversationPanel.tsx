import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { invalidateSocialMessages } from '../api/cacheInvalidation'
import { queryKeys } from '../api/queryKeys'
import { Button } from './ui/button'
import { ConfirmDialog, type ConfirmDialogState } from './ui/confirm-dialog'
import { ConversationEntryBubble } from './ConversationEntryBubble'
import type { ConversationEntryBubbleData } from './ConversationEntryBubble'
import { UserQuickReplyAddButton } from './UserQuickReplyDialog'
import { WhatsAppTemplatePicker } from './WhatsAppTemplatePicker'
import { ModalCloseButton } from './ui/modal-close-button'
import { getLocale } from '../utils/localization'
import { conversationSameDay, formatConversationDayDivider } from '../utils/conversationDayLabel'
import { SingleSelectDropdown } from './ui/single-select-dropdown'

interface ConversationPanelProps {
  socialMessageId: string
  citizenHandle: string
  citizenPhone?: string | null
  /** Kayıtlı vatandaş adı — phone header'da numaranın önüne yazılır (card #1555). */
  citizenName?: string | null
  onClose: () => void
  canReply?: boolean
  /** Beklemedeki giden mesajların yanında "Mesajı Gönder" butonu göster (yalnızca operatör) — card #1091. */
  canSendPending?: boolean
  onReplySent?: () => void
  onAddMediaAsAttachment?: (file: File) => void
  /** Popup'ta telefon numarası başlığı göster (card 6a3f8858). */
  headerMode?: 'default' | 'phone'
  showCloseButton?: boolean
  /** Verilirse "Birim Seçin" + "Kurum İçi İlet" satırı gösterilir (card #1512). */
  internalDepartmentOptions?: { departmentId: string; name: string }[]
  internalDepartmentId?: string
  onInternalDepartmentIdChange?: (departmentId: string) => void
  onSendInternal?: (text: string) => void | Promise<void>
  sendingInternal?: boolean
}

/** İsimden baş harfleri çıkarır (en fazla 2). Harf yoksa null döner. */
function getInitials(value: string): string | null {
  const words = value.trim().split(/\s+/).filter(w => /\p{L}/u.test(w))
  if (words.length === 0) return null
  return words.slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

/** Phone-header satırı: +90 önekli okunabilir numara (card #1555). */
function formatConversationPanelPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('90')
    ? digits.slice(2)
    : digits.length === 11 && digits.startsWith('0')
      ? digits.slice(1)
      : digits
  if (local.length === 10) {
    return `+90 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8)}`
  }
  if (digits.length === 0) return phone
  return digits.startsWith('90') ? `+${digits}` : `+90 ${digits}`
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

export function ConversationPanel({ socialMessageId, citizenHandle, citizenPhone, citizenName, onClose, canReply = true, canSendPending = false, onReplySent, onAddMediaAsAttachment, headerMode = 'default', showCloseButton = true, internalDepartmentOptions, internalDepartmentId = '', onInternalDepartmentIdChange, onSendInternal, sendingInternal = false }: ConversationPanelProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const locale = getLocale(i18n.language)
  const dayLabel = (iso: string) => formatConversationDayDivider(iso, locale, t)
  const [replyText, setReplyText] = useState('')
  const [selectedMetaTemplate, setSelectedMetaTemplate] = useState<{ name: string; language: string; templateId?: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [sendingPendingId, setSendingPendingId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const conversationQuery = useQuery({
    queryKey: queryKeys.socialMessages.conversation(socialMessageId),
    queryFn: () => api.getSocialConversation(socialMessageId),
  })
  const userQuickRepliesQuery = useQuery({
    queryKey: queryKeys.userQuickReplies.list(),
    queryFn: () => api.getUserQuickReplies(),
  })
  const whatsAppTemplatesQuery = useQuery({
    queryKey: queryKeys.whatsappTemplates.list(),
    queryFn: () => api.getWhatsAppTemplates(),
  })
  const entries = useMemo(() => conversationQuery.data ?? [], [conversationQuery.data])
  const userQuickReplies = useMemo(() => {
    const metaTemplates = (whatsAppTemplatesQuery.data ?? [])
      .filter(template => template.isActive && template.channel === 'WhatsApp Meta')
      .map(template => ({
        templateId: template.templateId,
        name: template.name,
        content: template.content,
        source: 'meta' as const,
        metaLanguageCode: template.metaLanguageCode ?? 'tr',
      }))
    const personal = (userQuickRepliesQuery.data ?? []).map(template => ({ ...template, source: 'user' as const }))
    return [...metaTemplates, ...personal]
  }, [userQuickRepliesQuery.data, whatsAppTemplatesQuery.data])
  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null
  const lastEntryKey = lastEntry
    ? `${lastEntry.entryId}-${lastEntry.sentAt}-${lastEntry.deliveryStatus ?? ''}`
    : 'empty'

  const scrollConversationToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(scrollConversationToBottom)
    const timeoutId = window.setTimeout(scrollConversationToBottom, 50)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [lastEntryKey, scrollConversationToBottom, socialMessageId])

  const handleSend = async () => {
    const text = replyText.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await api.replySocialMessage(
        socialMessageId,
        text,
        false,
        selectedMetaTemplate
          ? {
              whatsAppTemplateId: selectedMetaTemplate.templateId,
              whatsAppTemplateName: selectedMetaTemplate.name,
              whatsAppTemplateLanguage: selectedMetaTemplate.language,
            }
          : undefined,
      )
      setReplyText('')
      setSelectedMetaTemplate(null)
      invalidateSocialMessages(queryClient, socialMessageId)
      onReplySent?.()
    } finally {
      setSending(false)
    }
  }

  const handleSendInternalClick = async () => {
    const text = replyText.trim()
    if (!text || !internalDepartmentId || sendingInternal || !onSendInternal) return
    await onSendInternal(text)
    setReplyText('')
  }

  const doSendPending = async (entry: ConversationEntryBubbleData) => {
    if (sendingPendingId) return
    const targetSocialMessageId = entry.socialMessageId ?? socialMessageId
    setSendingPendingId(entry.entryId)
    try {
      await api.sendPendingConversationEntry(targetSocialMessageId, entry.entryId)
      invalidateSocialMessages(queryClient, targetSocialMessageId)
      if (targetSocialMessageId !== socialMessageId) {
        invalidateSocialMessages(queryClient, socialMessageId)
      }
    } finally {
      setSendingPendingId(null)
    }
  }

  const handleSendPending = (entry: ConversationEntryBubbleData) => {
    setConfirmDialog({
      title: t('whatsapp.sendPendingConfirmTitle', 'Mesajı Gönder'),
      titleDivider: true,
      message: t('whatsapp.sendPendingConfirmMessage', 'Bu mesaj vatandaşa WhatsApp üzerinden iletilecek. Onaylıyor musunuz?'),
      confirmLabel: t('whatsapp.sendPendingMessage', 'Mesajı Gönder'),
      variant: 'success',
      onConfirm: () => doSendPending(entry),
    })
  }

  const handleEditPending = async (entry: ConversationEntryBubbleData, content: string) => {
    const targetSocialMessageId = entry.socialMessageId ?? socialMessageId
    await api.editPendingConversationEntry(targetSocialMessageId, entry.entryId, content)
    invalidateSocialMessages(queryClient, targetSocialMessageId)
    if (targetSocialMessageId !== socialMessageId) {
      invalidateSocialMessages(queryClient, socialMessageId)
    }
  }

  const handleShowTerminalNote = (entry: ConversationEntryBubbleData) => {
    const isCancelled = entry.relatedJobTerminalStatus === 'Cancelled'
    setConfirmDialog({
      title: isCancelled
        ? t('tasks.detail.cancelNote', 'İptal Notu')
        : t('jobs.detail.completionResultNote', 'Tamamlanma Notu'),
      titleDivider: true,
      titleTone: isCancelled ? 'danger' : 'success',
      message: entry.relatedJobTerminalNote ?? '',
      hideCancel: true,
      confirmLabel: t('common.close', 'Kapat'),
      variant: isCancelled ? 'destructive' : 'success',
      onConfirm: () => {},
    })
  }

  const registeredCitizenName = citizenName?.trim() || null
  const phoneDigitsRaw = citizenPhone?.replace(/\D/g, '') || ''
  const phoneForDisplay = phoneDigitsRaw
    ? formatConversationPanelPhone(citizenPhone!)
    : (citizenHandle.replace(/\D/g, '').length >= 10 ? formatConversationPanelPhone(citizenHandle) : citizenHandle)
  const headerSubtitle = headerMode === 'phone'
    ? (registeredCitizenName ? `${registeredCitizenName} ${phoneForDisplay}` : phoneForDisplay)
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
        {headerMode === 'phone' ? (
          // Ortak WhatsApp asset; beyaz dış çerçeve yok (card #1555).
          <img src="/icons/whatsapp.webp" alt="" className="size-6 shrink-0" aria-hidden="true" />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold" style={{ color: 'var(--color-header-from)' }}>
            {initials ?? <img src="/icons/whatsapp.webp" alt="" className="size-6" aria-hidden="true" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/65">{headerKicker}</p>
          <p className={`truncate font-semibold leading-tight ${headerMode === 'phone' ? 'text-xs' : 'text-[15px]'}`}>{headerSubtitle}</p>
        </div>
        {showCloseButton ? (
          <ModalCloseButton
            onClick={onClose}
            label={t('common.close', 'Kapat')}
            className="size-8 shrink-0 text-white/80 hover:bg-white/15 hover:text-white"
          />
        ) : null}
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
                  socialMessageId={entry.socialMessageId ?? socialMessageId}
                  citizenPhone={citizenPhone}
                  theme="light"
                  onAddMediaAsAttachment={onAddMediaAsAttachment}
                  canSendPending={canSendPending}
                  onSendPending={() => handleSendPending(entry)}
                  sendingPending={sendingPendingId === entry.entryId}
                  onEditPending={(_, content) => handleEditPending(entry, content)}
                  onShowTerminalNote={handleShowTerminalNote}
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
              userQuickReplies={userQuickReplies}
              onSelect={template => {
                setReplyText(template.content)
                if (template.source === 'meta') {
                  setSelectedMetaTemplate({
                    name: template.name,
                    language: template.metaLanguageCode ?? 'tr',
                    templateId: template.templateId,
                  })
                } else {
                  setSelectedMetaTemplate(null)
                }
              }}
              menuAlign="start"
            />
            <UserQuickReplyAddButton onChanged={() => { void userQuickRepliesQuery.refetch() }} />
          </div>
          {internalDepartmentOptions ? (
            <div className="flex flex-wrap items-center gap-2">
              <SingleSelectDropdown
                options={internalDepartmentOptions.map(department => ({ value: department.departmentId, label: department.name }))}
                value={internalDepartmentId}
                onChange={value => onInternalDepartmentIdChange?.(value)}
                placeholder={t('departments.selectDepartment', 'Birim seçin')}
                emptyText={t('departments.noDepartments', 'Birim bulunamadı.')}
                searchable
                searchPlaceholder={t('departments.search', 'Birim ara...')}
                openUp
                className="min-w-44"
                triggerClassName="h-9 rounded-full px-3 text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => void handleSendInternalClick()}
                disabled={!replyText.trim() || !internalDepartmentId || sendingInternal}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingInternal ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                {t('whatsapp.sendInternalMessage', 'Kurum İçi İlet')}
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <textarea
              rows={3}
              value={replyText}
              onChange={e => {
                setReplyText(e.target.value)
                setSelectedMetaTemplate(null)
              }}
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
