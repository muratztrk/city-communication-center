import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Paperclip, PenLine, Send } from 'lucide-react'
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
import {
  ATTACHMENT_FILE_ACCEPT,
  isAllowedAttachmentFileName,
} from '../utils/attachmentAccept'
import { ATTACHMENT_MAX_TOTAL_BYTES } from '../utils/attachmentLimits'
import { formatDisplayPhone } from '../utils/phoneNormalization'
import { WhatsAppOutboundAttachmentChip } from './WhatsAppOutboundAttachmentChip'
import { ConversationSenderHeader } from './ConversationSenderHeader'
import { DeferredComposerTextarea } from './ui/DeferredComposerTextarea'
import { useAuth } from '../context/AuthContext'
import { formatStaffSenderLabel } from '../utils/formatConversationSenderLabel'

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
  /** Üst başlık satırını gizle (vatandaş bilgisi modal başlığında gösterilir — card #2390). */
  hideHeader?: boolean
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

export function ConversationPanel({ socialMessageId, citizenHandle, citizenPhone, citizenName, onClose, canReply = true, canSendPending = false, onReplySent, onAddMediaAsAttachment, enableWhatsAppFileAttachment = false, headerMode = 'default', showCloseButton = true, internalDepartmentOptions, internalDepartmentId = '', onInternalDepartmentIdChange, onSendInternal, sendingInternal = false, compactActions = false, compactBubbles = false, hideHeader = false }: ConversationPanelProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const locale = getLocale(i18n.language)
  const dayLabel = (iso: string) => formatConversationDayDivider(iso, locale, t)
  const [replyText, setReplyText] = useState('')
  const [selectedMetaTemplate, setSelectedMetaTemplate] = useState<{ name: string; language: string; templateId?: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [sendingPendingId, setSendingPendingId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingFileEditing, setPendingFileEditing] = useState(false)
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
  const pendingSenderLabel = formatStaffSenderLabel(user?.departmentName, user?.displayName)
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
    if (!isAllowedAttachmentFileName(file.name)) {
      setFileError(t('attachments.errorType', 'Yalnızca resim (JPG, PNG), PDF ve Office dosyaları yüklenebilir.'))
      return
    }
    if (file.size > ATTACHMENT_MAX_TOTAL_BYTES) {
      setFileError(t('attachments.errorSize', 'Dosya boyutu 5 MB\'ı aşamaz.'))
      return
    }
    setFileError(null)
    setPendingFile(file)
    setPendingFileEditing(false)
  }

  const handleSend = async () => {
    const text = replyText.trim()
    if ((!text && !pendingFile) || sending) return
    setSending(true)
    try {
      if (pendingFile) {
        await api.replySocialMessageAttachment(socialMessageId, pendingFile, text, true)
        setPendingFile(null)
        setPendingFileEditing(false)
      } else {
        await api.replySocialMessage(
          socialMessageId,
          text,
          true,
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
    ? formatDisplayPhone(citizenPhone!)
    : (citizenHandle.replace(/\D/g, '').length >= 10 ? formatDisplayPhone(citizenHandle) : citizenHandle)
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

  const sendButtonSpacerClass = compactActions ? 'h-8 w-10 shrink-0' : 'size-11 shrink-0'

  return (
    <div className="flex flex-col h-full">
      {!hideHeader ? (
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
      ) : null}

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
            <div
              className={`rounded-xl rounded-tr-sm text-white shadow-md ring-1 ring-white/10 ${
                compactBubbles
                  ? 'max-w-[min(68%,22rem)] px-3 py-1.5 text-xs'
                  : 'max-w-[min(70%,26rem)] px-3 py-2 text-[13px]'
              }`}
              style={{ background: 'var(--color-header-from)' }}
            >
              {pendingSenderLabel ? (
                <ConversationSenderHeader label={pendingSenderLabel} variant="inline" tone="outbound" />
              ) : null}
              <WhatsAppOutboundAttachmentChip
                fileName={pendingFile.name}
                isImage={pendingFile.type.startsWith('image/')}
                previewUrl={pendingFilePreviewUrl}
                compact={compactActions}
                onDismiss={() => {
                  setPendingFile(null)
                  setPendingFileEditing(false)
                }}
                dismissDisabled={sending}
                dismissLabel={t('common.dismiss', 'Vazgeç')}
                caption={pendingFileEditing ? undefined : replyText}
              />
              {pendingFileEditing ? (
                <textarea
                  rows={2}
                  value={replyText}
                  onChange={event => setReplyText(event.target.value)}
                  placeholder={t('whatsapp.attachmentCaptionPlaceholder', 'Ek açıklaması yaz...')}
                  className="mt-2 w-full min-w-[14rem] resize-none rounded-lg bg-white/95 px-2 py-1.5 text-sm leading-snug text-slate-900 outline-none ring-1 ring-white/40"
                />
              ) : null}
              <p className={`mt-1.5 flex items-baseline justify-end gap-1 text-[10px] text-white/65 ${compactBubbles ? 'text-[9px]' : ''}`}>
                <span className="font-semibold tracking-wide">{t('whatsapp.pendingBadge', 'Beklemede')}</span>
              </p>
            </div>
            <div className={`mt-1 flex items-center gap-1.5 ${compactActions ? '' : ''}`}>
              <button
                type="button"
                onClick={() => setPendingFileEditing(current => !current)}
                disabled={sending}
                className={`inline-flex items-center gap-1 rounded-full bg-orange-500 font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 ${
                  compactActions ? 'px-2 py-1 text-[10px]' : 'gap-1.5 px-3 py-1.5 text-xs'
                }`}
              >
                <PenLine className={compactActions ? 'size-3' : 'size-3.5'} strokeWidth={1.75} aria-hidden="true" />
                {t('common.edit', 'Düzenle')}
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending}
                className={`inline-flex items-center gap-1 rounded-full bg-emerald-600 font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 ${
                  compactActions ? 'px-2 py-1 text-[10px]' : 'gap-1.5 px-3 py-1.5 text-xs'
                }`}
              >
                {sending ? (
                  <Loader2 className={`animate-spin ${compactActions ? 'size-3' : 'size-3.5'}`} />
                ) : (
                  <Send className={compactActions ? 'size-3' : 'size-3.5'} />
                )}
                {t('whatsapp.sendPendingMessage', 'Mesajı Gönder')}
              </button>
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
              accept={ATTACHMENT_FILE_ACCEPT}
              className="hidden"
              onChange={event => {
                handleWhatsAppFileSelected(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          ) : null}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto] items-center gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                disabled={sending}
                className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${compactActions ? 'h-7 px-2.5 text-[11px]' : 'h-9 px-4 text-xs'}`}
              >
                <Paperclip className={`shrink-0 text-emerald-600 ${compactActions ? 'size-3' : 'size-3.5'}`} aria-hidden="true" />
                {t('attachments.addFile', 'Dosya ekle')}
              </button>
            ) : null}
                {internalDepartmentOptions ? (
                  <div className="ml-auto flex items-center gap-2">
                    <SingleSelectDropdown
                      options={internalDepartmentOptions.map(department => ({ value: department.departmentId, label: department.name }))}
                      value={internalDepartmentId}
                      onChange={value => onInternalDepartmentIdChange?.(value)}
                      placeholder={t('departments.selectDepartment', 'Birim seçiniz...')}
                      emptyText={t('departments.noDepartments', 'Birim bulunamadı.')}
                      searchPlaceholder={t('departments.search', 'Birim ara...')}
                      openUp={internalDepartmentOptions.length >= 2}
                      clearable
                      className={`min-w-0 max-w-[10rem] shrink-0 ${compactActions ? 'w-[8.75rem]' : 'w-[10rem]'}`}
                      triggerClassName={`w-full rounded-full font-semibold ${compactActions ? 'min-h-7 h-7 px-2 text-[11px]' : 'h-9 px-2.5 text-xs'}`}
                      menuWidth={compactActions ? 168 : 184}
                      menuScrollClassName="whatsapp-department-menu-scroll"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSendInternalClick()}
                      disabled={!replyText.trim() || !internalDepartmentId || sendingInternal}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 ${compactActions ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-xs'}`}
                    >
                      {sendingInternal ? <Loader2 className={`animate-spin ${compactActions ? 'size-3' : 'size-3.5'}`} /> : <Send className={compactActions ? 'size-3' : 'size-3.5'} />}
                      {t('whatsapp.sendInternalMessage', 'Sadece Kurum İçi İlet')}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className={`${sendButtonSpacerClass} invisible pointer-events-none`} aria-hidden="true" />
            </div>
            {fileError ? <p className="text-xs font-semibold text-red-600">{fileError}</p> : null}
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <DeferredComposerTextarea
              rows={3}
              value={replyText}
              onChange={value => {
                setReplyText(value)
                setSelectedMetaTemplate(null)
              }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
              placeholder={t('social.replyPlaceholder', 'Yanıt yaz…')}
              className="field-input min-w-0 resize-none min-h-[4.5rem] max-h-28 py-2 text-sm"
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
