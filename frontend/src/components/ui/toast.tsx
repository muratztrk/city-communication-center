import { CheckCircle2, XCircle, X } from 'lucide-react'
import { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = 'success', onClose, duration = 3500 }: ToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(id)
  }, [onClose, duration])

  const isSuccess = type === 'success'

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl',
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-800',
      ].join(' ')}
    >
      {isSuccess
        ? <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
        : <XCircle className="size-5 shrink-0 text-rose-500" />
      }
      <span className="text-sm font-semibold">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className={`ml-1 rounded-lg p-0.5 transition-colors ${isSuccess ? 'hover:bg-emerald-100' : 'hover:bg-rose-100'}`}
        aria-label="Kapat"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
