import type { ElementType, MouseEvent } from 'react'
import { cn } from '../../lib/cn'

type TruncatedTextProps = {
  text: string
  className?: string
  as?: 'span' | 'div'
}

/**
 * Truncated / line-clamped grid text: native tooltip with the full value
 * only when the content actually overflows (#r474).
 */
export function TruncatedText({ text, className, as = 'span' }: TruncatedTextProps) {
  const Comp = as as ElementType

  const syncTitle = (event: MouseEvent<HTMLElement>) => {
    const el = event.currentTarget
    const truncated =
      el.scrollWidth > el.clientWidth + 1
      || el.scrollHeight > el.clientHeight + 1
    if (truncated && text.trim()) el.setAttribute('title', text)
    else el.removeAttribute('title')
  }

  return (
    <Comp className={cn(className)} onMouseEnter={syncTitle}>
      {text}
    </Comp>
  )
}
