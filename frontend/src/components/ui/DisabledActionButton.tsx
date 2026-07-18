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
  // w-full yalnızca mobil header grid CSS'inde (card #1676); masaüstünde w-full
  // İptal/X hizasını bozuyordu (card #1680 reopen).
  return (
    <span
      title={hoverTitle}
      className="inline-flex min-w-0 cursor-not-allowed"
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
