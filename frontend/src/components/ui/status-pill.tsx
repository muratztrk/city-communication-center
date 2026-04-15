import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const statusPillVariants = cva('inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-semibold ring-1', {
  variants: {
    tone: {
      neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
      info: 'bg-[color:var(--color-primary)]/8 text-[color:var(--color-primary)] ring-[color:var(--color-primary)]/18',
      success: 'bg-[color:var(--color-success)]/10 text-[color:var(--color-success)] ring-[color:var(--color-success)]/18',
      warning: 'bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)] ring-[color:var(--color-warning)]/18',
      danger: 'bg-[color:var(--color-destructive)]/10 text-[color:var(--color-destructive)] ring-[color:var(--color-destructive)]/18',
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
})

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusPillVariants> {}

export function StatusPill({ className, tone, ...props }: StatusPillProps) {
  return <span className={cn(statusPillVariants({ tone, className }))} {...props} />
}