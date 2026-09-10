import { createPortal } from 'react-dom'
import { ConversationPanel } from './ConversationPanel'

interface WhatsAppConversationModalProps {
  socialMessageId: string
  citizenHandle: string
  citizenPhone?: string | null
  citizenName?: string | null
  onClose: () => void
}

export function WhatsAppConversationModal({
  socialMessageId,
  citizenHandle,
  citizenPhone,
  citizenName,
  onClose,
}: WhatsAppConversationModalProps) {
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
          // Yazışmaya Git popup salt okunur — mesaj gönderimi yalnız /whatsapp operatör ekranında.
          canReply={false}
          canSendPending={false}
          // Yazışmaya Git popup: balon + metin küçült (#2083 / #1711 kalıbı).
          compactBubbles
          compactActions
          enableConversationPrint
          enableConversationSearch
        />
      </section>
    </div>,
    document.body,
  )
}
