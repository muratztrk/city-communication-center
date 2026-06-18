import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from './button'

export interface ConfirmDialogState {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'primary'
  hideCancel?: boolean
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

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-sm rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close', 'Kapat')}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <X className="size-4" />
        </button>
        {state.title && <h2 className="mb-2 text-lg font-bold text-slate-950">{state.title}</h2>}
        <p className="mb-6 mt-2 text-sm text-slate-700">{state.message}</p>
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
    </div>
  )
}
