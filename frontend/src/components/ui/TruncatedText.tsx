import type { ElementType } from 'react'
import { cn } from '../../lib/cn'

type TruncatedTextProps = {
  text: string
  className?: string
  as?: 'span' | 'div'
}

/**
 * Truncated / line-clamped grid text. Full-value hover is handled globally by
 * `useDataTableOverflowTooltips` (modern portal tooltip) (#r474–#r478).
 */
export function TruncatedText({ text, className, as = 'span' }: TruncatedTextProps) {
  const Comp = as as ElementType
  return <Comp className={cn(className)}>{text}</Comp>
}
