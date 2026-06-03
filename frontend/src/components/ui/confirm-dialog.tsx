import { useTranslation } from 'react-i18next'
import { Button } from './button'

export interface ConfirmDialogState {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'primary'
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-[var(--radius-2xl)] bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <p className="mb-6 text-sm text-slate-700">{state.message}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {state.cancelLabel ?? t('common.cancel', 'İptal')}
          </Button>
          <Button type="button" variant={state.variant ?? 'destructive'} onClick={handleConfirm}>
            {state.confirmLabel ?? t('common.yes', 'Evet')}
          </Button>
        </div>
      </div>
    </div>
  )
}
