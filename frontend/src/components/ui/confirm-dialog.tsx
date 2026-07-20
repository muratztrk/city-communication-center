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
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'primary' | 'success'
  hideCancel?: boolean
  banner?: ReactNode
  /** Optional content under the message (ör. eksik birimli kullanıcı listesi). */
  details?: ReactNode
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
    void Promise.resolve(state.onConfirm())
    onClose()
  }
  const titleToneClass = state.titleTone === 'danger'
    ? 'text-[color:var(--color-destructive)]'
    : state.titleTone === 'success'
      ? 'text-[color:var(--color-success)]'
      : 'text-slate-950'

  return createPortal(
    <ModalBackdrop>
      <div
        className={`relative w-full rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl ${state.details ? 'max-w-md' : 'max-w-sm'}`}
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
        <p className={`mt-2 text-sm text-slate-700 ${state.details ? 'mb-3' : 'mb-6'}`}>{state.message}</p>
        {state.details ? <div className="mb-6">{state.details}</div> : null}
        <div className="flex justify-end gap-2">
          {!state.hideCancel && (
            <Button type="button" variant="secondary" onClick={onClose}>
              {state.cancelLabel ?? t('common.cancel', 'İptal')}
            </Button>
          )}
          <Button type="button" variant={state.variant ?? 'destructive'} onClick={handleConfirm}>
            {state.confirmLabel ?? t('common.yes', 'Evet')}
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  , document.body)
}
