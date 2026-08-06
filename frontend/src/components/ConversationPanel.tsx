import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, Send, X } from 'lucide-react'
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
import { ATTACHMENT_MAX_TOTAL_BYTES } from '../utils/attachmentLimits'

const CONVERSATION_FILE_ACCEPT = '.jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
  /** Gelen medyayı talep eklerine ekler (balon aksiyonu). */
  onAddMediaAsAttachment?: (file: File) => void
  /** Dosya ekle butonu WhatsApp konuşmasına ek gönderir (talep eklerine değil) — card #2375. */
  enableWhatsAppFileAttachment?: boolean
  /** Popup'ta telefon numarası başlığı göster (card 6a3f8858). */
  headerMode?: 'default' | 'phone'
  showCloseButton?: boolean
  /** Verilirse "Birim Seçin" + "Kurum İçi İlet" satırı gösterilir (card #1512). */
  internalDepartmentOptions?: { departmentId: string; name: string }[]
  internalDepartmentId?: string
  onInternalDepartmentIdChange?: (departmentId: string) => void
  onSendInternal?: (text: string) => void | Promise<void>
  sendingInternal?: boolean
  /** Talep Oluştur popup'ındaki yardımcı aksiyonları daha kompakt göster. */
  compactActions?: boolean
  /** Vatandaş Talebi Oluştur modalında konuşma balonlarını küçült (card #1711). */
  compactBubbles?: boolean
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

export function ConversationPanel({ socialMessageId, citizenHandle, citizenPhone, citizenName, onClose, canReply = true, canSendPending = false, onReplySent, onAddMediaAsAttachment, enableWhatsAppFileAttachment = false, headerMode = 'default', showCloseButton = true, internalDepartmentOptions, internalDepartmentId = '', onInternalDepartmentIdChange, onSendInternal, sendingInternal = false, compactActions = false, compactBubbles = false }: ConversationPanelProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const locale = getLocale(i18n.language)
  const dayLabel = (iso: string) => formatConversationDayDivider(iso, locale, t)
  const [replyText, setReplyText] = useState('')
  const [selectedMetaTemplate, setSelectedMetaTemplate] = useState<{ name: string; language: string; templateId?: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [sendingPendingId, setSendingPendingId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingFilePreviewUrl, setPendingFilePreviewUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  }, [lastEntryKey, scrollConversationToBottom, socialMessageId, pendingFile])

  useEffect(() => {
    if (!pendingFile) {
      setPendingFilePreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(pendingFile)
    setPendingFilePreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [pendingFile])

  const handleWhatsAppFileSelected = (file: File | undefined) => {
    if (!file) return
    if (file.size > ATTACHMENT_MAX_TOTAL_BYTES) {
      setFileError(t('attachments.errorSize', 'Dosya boyutu 5 MB\'ı aşamaz.'))
      return
    }
    setFileError(null)
    setPendingFile(file)
  }

  const handleSend = async () => {
    const text = replyText.trim()
    if ((!text && !pendingFile) || sending) return
    setSending(true)
    try {
      if (pendingFile) {
        await api.replySocialMessageAttachment(socialMessageId, pendingFile, text, true)
        setPendingFile(null)
      } else {
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
      }
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
      title: t('whatsapp.terminalNote.label', 'Not'),
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
  // Gelen balonda üst satır: isim varsa isim (+telefon), yoksa telefon (card #1716).
  const inboundSenderLabel = registeredCitizenName
    ? `${registeredCitizenName}${phoneForDisplay ? ` ${phoneForDisplay}` : ''}`
    : (phoneForDisplay || null)

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

      <div className="whatsapp-chat-bg min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
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
                  compact={compactBubbles}
                  inboundSenderLabel={inboundSenderLabel}
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
        {enableWhatsAppFileAttachment && pendingFile ? (
          <div className="flex flex-col items-end">
            <div className="max-w-[min(72%,28rem)] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white shadow-md ring-1 ring-white/10" style={{ background: 'var(--color-header-from)' }}>
              <div className="flex items-center gap-2">
                <FileText className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate font-semibold">{pendingFile.name}</span>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  disabled={sending}
                  className="ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:opacity-60"
                  aria-label={t('common.dismiss', 'Vazgeç')}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              {pendingFile.type.startsWith('image/') && pendingFilePreviewUrl ? (
                <img
                  src={pendingFilePreviewUrl}
                  alt={pendingFile.name}
                  className="mt-2 max-h-56 w-full rounded-xl border border-white/20 object-contain bg-white/95"
                />
              ) : (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-xs font-semibold text-white/90">
                  <FileText className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{pendingFile.type || t('attachments.file', 'Dosya')}</span>
                  <span className="shrink-0 text-white/65">{formatFileSize(pendingFile.size)}</span>
                </div>
              )}
              {replyText.trim() ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{replyText.trim()}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {canReply && (
        <div className="shrink-0 space-y-3 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-3">
          {enableWhatsAppFileAttachment ? (
            <input
              ref={fileInputRef}
              type="file"
              accept={CONVERSATION_FILE_ACCEPT}
              className="hidden"
              onChange={event => {
                handleWhatsAppFileSelected(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          ) : null}
          <div className="space-y-2">
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
              compact={compactActions}
            />
            <UserQuickReplyAddButton compact={compactActions} onChanged={() => { void userQuickRepliesQuery.refetch() }} />
            {enableWhatsAppFileAttachment ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white font-semibold text-slate-700 transition-colors hover:bg-slate-50 ${compactActions ? 'h-7 px-2.5 text-[11px]' : 'h-9 px-4 text-xs'}`}
              >
                <Paperclip className={`shrink-0 text-emerald-600 ${compactActions ? 'size-3' : 'size-3.5'}`} aria-hidden="true" />
                {t('attachments.addFile', 'Dosya ekle')}
              </button>
            ) : null}
            </div>
            {internalDepartmentOptions ? (
              <div className="flex flex-wrap items-center gap-2">
                <SingleSelectDropdown
                  options={internalDepartmentOptions.map(department => ({ value: department.departmentId, label: department.name }))}
                  value={internalDepartmentId}
                  onChange={value => onInternalDepartmentIdChange?.(value)}
                  placeholder={t('departments.selectDepartment', 'Birim seçiniz...')}
                  emptyText={t('departments.noDepartments', 'Birim bulunamadı.')}
                  searchPlaceholder={t('departments.search', 'Birim ara...')}
                  openUp={internalDepartmentOptions.length >= 2}
                  clearable
                  className="w-[8.75rem] min-w-0 max-w-[8.75rem]"
                  triggerClassName={`${compactActions ? 'min-h-7 h-7 px-2 text-[11px]' : 'h-9 px-2.5 text-xs'} w-full rounded-full font-semibold`}
                  menuWidth={168}
                  menuScrollClassName="whatsapp-department-menu-scroll"
                />
                <button
                  type="button"
                  onClick={() => void handleSendInternalClick()}
                  disabled={!replyText.trim() || !internalDepartmentId || sendingInternal}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 ${compactActions ? 'h-7 px-2.5 text-[11px]' : 'h-9 px-4 text-sm'}`}
                >
                  {sendingInternal ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  {t('whatsapp.sendInternalMessage', 'Sadece Kurum İçi İlet')}
                </button>
              </div>
            ) : null}
            {fileError ? <p className="text-xs font-semibold text-red-600">{fileError}</p> : null}
          </div>
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
            <Button size="sm" onClick={() => void handleSend()} disabled={(!replyText.trim() && !pendingFile) || sending} className="self-end shrink-0">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  )
}
