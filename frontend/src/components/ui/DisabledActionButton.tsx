import { Ban } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, type ButtonProps } from './button'

interface DisabledActionButtonProps extends Omit<ButtonProps, 'disabled'> {
  hoverTitle?: string
  children: ReactNode
}

export function DisabledActionButton({
  hoverTitle,
  children,
  className,
  ...props
}: DisabledActionButtonProps) {
  return (
    <span
      title={hoverTitle}
      className="group relative inline-flex cursor-not-allowed"
    >
      <Button
        {...props}
        className={`button-placeholder pr-8 ${className ?? ''}`.trim()}
        disabled
        style={{ pointerEvents: 'none' }}
      >
        {children}
      </Button>
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white opacity-0 transition-opacity group-hover:opacity-100">
        <Ban className="size-3.5" aria-hidden="true" />
      </span>
    </span>
  )
}
