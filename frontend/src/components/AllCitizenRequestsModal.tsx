import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SocialMessagesPage } from '../pages/SocialMessagesPage'
import { DetailModalHeaderBrand } from './branding/DetailModalHeaderBrand'

interface AllCitizenRequestsModalProps {
  onClose: () => void
}

/** Anasayfa-Vatandaş → operatör Vatandaş Talepleri grid popup (#2644). */
export function AllCitizenRequestsModal({ onClose }: AllCitizenRequestsModalProps) {
  const { t } = useTranslation()

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="detail-modal-shell detail-modal-shell--my-request detail-modal-shell--all-requests flex flex-col overflow-hidden rounded-[var(--radius-2xl)] bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="my-request-detail-header detail-modal-header-layout detail-modal-header-mobile detail-modal-header-mobile--actions-grid shrink-0 px-5 py-3.5">
          <div className="detail-modal-header-title min-w-0">
            <h2 className="flex min-w-0 items-start gap-2 text-sm font-bold text-emerald-700">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="block truncate">{t('nav.social', 'Vatandaş Talepleri')}</span>
            </h2>
          </div>
          <DetailModalHeaderBrand />
          <div className="detail-modal-header-actions detail-modal-header-actions--mobile-grid flex shrink-0 flex-nowrap items-center justify-end gap-2">
            <button
              type="button"
              className="detail-modal-header-close flex size-9 items-center justify-center rounded-full bg-transparent text-slate-400 shadow-none transition-colors hover:bg-red-50 hover:text-red-600 active:scale-95"
              aria-label={t('common.close', 'Kapat')}
              onClick={onClose}
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <SocialMessagesPage embedded />
        </div>
      </div>
    </div>,
    document.body,
  )
}
