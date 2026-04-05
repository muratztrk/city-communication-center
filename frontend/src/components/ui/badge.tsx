import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-primary)] ring-1 ring-[color:var(--color-primary)]/12',
        className,
      )}
      {...props}
    />
  )
}
