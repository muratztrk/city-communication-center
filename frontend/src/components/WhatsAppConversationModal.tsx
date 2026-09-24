import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { ConversationPanel } from './ConversationPanel'

interface WhatsAppConversationModalProps {
  socialMessageId: string
  citizenHandle: string
  citizenPhone?: string | null
  citizenName?: string | null
  onClose: () => void
  /** Birim inceleme FAB veya Yazışmaya Git: müdür/personel Beklemede yazar (#6ab1131 / #6aad490e). */
  allowManagerReply?: boolean
  /** Mesaj logundan açılınca işaretlenecek giden kayıt. */
  highlightEntryId?: string | null
}

export function WhatsAppConversationModal({
  socialMessageId,
  citizenHandle,
  citizenPhone,
  citizenName,
  onClose,
  allowManagerReply: allowManagerReplyOverride,
  highlightEntryId,
}: WhatsAppConversationModalProps) {
  const { user } = useAuth()
  // Yazışmaya Git: yalnız birim müdürü (ve SystemAdmin) yazar; mesajlar Beklemede kuyruğa girer (#6ab1131).
  const allowManagerReply = allowManagerReplyOverride
    ?? (user?.role === 'Manager' || user?.role === 'SystemAdmin')

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <section
        className="flex h-[min(85dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <ConversationPanel
          socialMessageId={socialMessageId}
          citizenHandle={citizenHandle}
          citizenPhone={citizenPhone}
          citizenName={citizenName}
          headerMode="phone"
          onClose={onClose}
          canReply={allowManagerReply}
          canSendPending={false}
          enableWhatsAppFileAttachment={allowManagerReply}
          // Yazışmaya Git popup: balon + metin küçült (#2083 / #1711 kalıbı).
          compactBubbles
          compactActions
          enableConversationPrint
          enableConversationSearch
          highlightEntryId={highlightEntryId}
        />
      </section>
    </div>,
    document.body,
  )
}
