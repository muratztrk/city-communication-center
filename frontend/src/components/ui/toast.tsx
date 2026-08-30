import { CheckCircle2, XCircle, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
  duration?: number
}

export function Toast({ message, type = 'success', onClose, duration = 5000 }: ToastProps) {
  // Parent her render'da yeni onClose verirse timer sıfırlanmasın (#2074 reopen).
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const id = window.setTimeout(() => onCloseRef.current(), duration)
    return () => window.clearTimeout(id)
  }, [message, type, duration])

  const isSuccess = type === 'success'

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed bottom-6 right-6 z-[400] flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl',
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
    </div>,
    document.body,
  )
}
