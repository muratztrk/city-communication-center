import type { ReactNode } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'

/** Modal overlay — backdrop clicks do not dismiss (card #1052). ESC → onEscapeClose (#2816). */
export function ModalBackdrop({
  children,
  className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4',
  onEscapeClose,
}: {
  children: ReactNode
  className?: string
  /** ESC ile kapat (X ile aynı — card #2816). */
  onEscapeClose?: () => void
}) {
  useEscapeKey(() => onEscapeClose?.(), Boolean(onEscapeClose), 'high')

  return (
    <div
      className={className}
      role="presentation"
      data-escape-overlay={onEscapeClose ? 'high' : undefined}
    >
      {children}
    </div>
  )
}
