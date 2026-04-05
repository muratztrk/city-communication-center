import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]/40 disabled:pointer-events-none disabled:opacity-60 active:translate-y-px',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--color-primary)] text-white shadow-[0_12px_30px_rgba(15,76,129,0.24)] hover:-translate-y-0.5',
        secondary: 'bg-white/80 text-slate-800 ring-1 ring-slate-200 hover:bg-white',
        ghost: 'bg-transparent text-slate-700 hover:bg-white/70',
        success: 'bg-emerald-600 text-white shadow-[0_10px_24px_rgba(5,150,105,0.24)] hover:-translate-y-0.5',
        danger: 'bg-rose-600 text-white shadow-[0_10px_24px_rgba(225,29,72,0.24)] hover:-translate-y-0.5',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        lg: 'h-13 px-6 text-base',
        sm: 'h-9 px-4 text-sm',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ asChild = false, className, size, variant, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return <Comp className={cn(buttonVariants({ size, variant, className }))} {...props} />
}
