import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-[color:var(--color-primary)]/8 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)] ring-1 ring-[color:var(--color-primary)]/12',
        className,
      )}
      {...props}
    />
  )
}
