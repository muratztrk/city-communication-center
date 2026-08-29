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
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
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
          // Birim yöneticisi/atanan personel yazabilir ama mesaj "Beklemede" kuyruğa girer;
          // vatandaşa iletme yetkisi yalnızca operatördedir (canSendPending=false) — card #1091.
          canReply
          canSendPending={false}
          // Yazışmaya Git popup: balon + metin küçült (#2083 / #1711 kalıbı).
          compactBubbles
          compactActions
        />
      </section>
    </div>,
    document.body,
  )
}
