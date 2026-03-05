import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary text-primary-foreground shadow-[0_16px_35px_rgba(24,90,86,0.24)] hover:-translate-y-0.5 hover:bg-primary/92',
        secondary: 'border-border bg-card text-foreground hover:-translate-y-0.5 hover:bg-accent',
        ghost: 'border-transparent bg-transparent text-foreground hover:bg-accent/80',
        outline: 'border-border bg-background/80 text-foreground hover:border-primary/25 hover:bg-card',
      },
      size: {
        sm: 'h-9 px-4 text-xs',
        default: 'h-11 px-5',
        lg: 'h-12 px-6',
        icon: 'h-11 w-11 rounded-2xl px-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export function Button({ className, variant, size, asChild = false, loading, children, disabled, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot className={cn(buttonVariants({ variant, size, className }))} {...props}>
        {children}
      </Slot>
    )
  }

  return (
    <button className={cn(buttonVariants({ variant, size, className }))} disabled={disabled || loading} {...props}>
      {loading && (
        <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3A7 7 0 0 0 12 5z" />
        </svg>
      )}
      {children}
    </button>
  )
}
