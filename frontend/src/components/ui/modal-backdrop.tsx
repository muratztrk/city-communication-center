import type { ReactNode } from 'react'

/** Modal overlay — backdrop clicks do not dismiss (card #1052). */
export function ModalBackdrop({
  children,
  className = 'fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className} role="presentation">
      {children}
    </div>
  )
}
