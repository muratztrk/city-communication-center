import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const statusPillVariants = cva('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1', {
  variants: {
    tone: {
      neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
      info: 'bg-sky-50 text-sky-700 ring-sky-200',
      success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      warning: 'bg-amber-50 text-amber-700 ring-amber-200',
      danger: 'bg-rose-50 text-rose-700 ring-rose-200',
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