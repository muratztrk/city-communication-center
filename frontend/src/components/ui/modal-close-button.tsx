import { X } from 'lucide-react'

export const modalCloseButtonClassName =
  'flex size-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600'

interface ModalCloseButtonProps {
  onClick: () => void
  label: string
  className?: string
}

export function ModalCloseButton({ onClick, label, className }: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={className ? `${modalCloseButtonClassName} ${className}` : modalCloseButtonClassName}
    >
      <X className="size-4" />
    </button>
  )
}
