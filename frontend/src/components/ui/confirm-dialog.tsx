import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Button } from './button'
import { ModalBackdrop } from './modal-backdrop'

export interface ConfirmDialogState {
  title?: string
  titleDivider?: boolean
  /** Smaller title styling for compact confirmation popups. */
  titleCompact?: boolean
  titleTone?: 'danger' | 'success'
  /** Plain string or rich content (ör. turuncu "Yapılmakta" — card #2057). */
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'primary' | 'success'
  /** İptal/Çıkış butonu stili — LDAP toplu ekle Çıkış kırmızı (card #1760). */
  cancelVariant?: 'secondary' | 'destructive'
  hideCancel?: boolean
  /** false ise onay sonrası popup kapanmaz; onConfirm aynı popup state'ini güncelleyebilir (card #1862 reopen). */
  closeOnConfirm?: boolean
  banner?: ReactNode
  /** Optional content under the message (ör. eksik birimli kullanıcı listesi). */
  details?: ReactNode
  /** Biraz daha geniş dialog (ör. Mesajı Gönder confirm — card #2060). */
  wide?: boolean
  /** Aksiyon butonları küçük (Mesaj Onayı Notu Düzenle / Mesajı Onayla — #2091/#2098). */
  compactActions?: boolean
  /** compactActions iken biraz daha büyük sm (h-9) — #2098. */
  compactActionsLarge?: boolean
  onConfirm: () => void | Promise<void>
}

interface ConfirmDialogProps {
  state: ConfirmDialogState | null
  onClose: () => void
}

export function ConfirmDialog({ state, onClose }: ConfirmDialogProps) {
  const { t } = useTranslation()
  if (!state) return null

  const handleConfirm = () => {
    const shouldClose = state.closeOnConfirm !== false
    void Promise.resolve(state.onConfirm()).finally(() => {
      if (shouldClose) onClose()
    })
  }
  const titleToneClass = state.titleTone === 'danger'
    ? 'text-[color:var(--color-destructive)]'
    : state.titleTone === 'success'
      ? 'text-[color:var(--color-success)]'
      : 'text-slate-950'

  return createPortal(
    <ModalBackdrop onEscapeClose={onClose}>
      <div
        className={`relative w-full rounded-[var(--radius-2xl)] bg-white shadow-2xl ${
          state.details || state.wide
            ? 'max-w-md px-6 py-5'
            : 'max-w-sm p-6'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close', 'Kapat')}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <X className="size-4" />
        </button>
        {state.title && (
          <h2
            className={`${titleToneClass} ${state.titleCompact ? 'text-base font-semibold' : 'text-lg font-bold'} ${state.titleDivider ? 'mb-3 border-b border-slate-200 pb-2' : 'mb-2'}`}
          >
            {state.title}
          </h2>
        )}
        {state.banner ? <div className="mb-3">{state.banner}</div> : null}
        <div className={`mt-2 text-sm text-slate-700 ${state.details ? 'mb-3' : 'mb-6'}`}>{state.message}</div>
        {state.details ? <div className="mb-6">{state.details}</div> : null}
        <div className="flex justify-end gap-2">
          {!state.hideCancel && (
            <Button
              type="button"
              size={state.compactActions ? 'sm' : 'default'}
              className={state.compactActionsLarge ? 'h-9 px-3.5 text-[0.8125rem]' : undefined}
              variant={state.cancelVariant ?? 'secondary'}
              onClick={onClose}
            >
              {state.cancelLabel ?? t('common.cancel', 'İptal')}
            </Button>
          )}
          <Button
            type="button"
            size={state.compactActions ? 'sm' : 'default'}
            className={state.compactActionsLarge ? 'h-9 px-3.5 text-[0.8125rem]' : undefined}
            variant={state.variant ?? 'destructive'}
            onClick={handleConfirm}
          >
            {state.confirmLabel ?? t('common.yes', 'Evet')}
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  , document.body)
}
