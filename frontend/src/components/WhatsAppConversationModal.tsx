import { createPortal } from 'react-dom'
import { ConversationPanel } from './ConversationPanel'

interface WhatsAppConversationModalProps {
  socialMessageId: string
  citizenHandle: string
  citizenPhone?: string | null
  onClose: () => void
}

export function WhatsAppConversationModal({
  socialMessageId,
  citizenHandle,
  citizenPhone,
  onClose,
}: WhatsAppConversationModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <section
        className="flex h-[min(85dvh,40rem)] w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <ConversationPanel
          socialMessageId={socialMessageId}
          citizenHandle={citizenHandle}
          citizenPhone={citizenPhone}
          headerMode="phone"
          onClose={onClose}
          // Birim yöneticisi/atanan personel yazabilir ama mesaj "Beklemede" kuyruğa girer;
          // vatandaşa iletme yetkisi yalnızca operatördedir (canSendPending=false) — card #1091.
          canReply
          canSendPending={false}
        />
      </section>
    </div>,
    document.body,
  )
}
