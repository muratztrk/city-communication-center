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
      className="inline-flex cursor-not-allowed"
    >
      <Button
        {...props}
        className={`button-placeholder ${className ?? ''}`.trim()}
        disabled
        style={{ pointerEvents: 'none' }}
      >
        {children}
      </Button>
    </span>
  )
}
