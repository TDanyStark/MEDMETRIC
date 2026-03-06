import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, className, ...props }, ref) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'flex h-12 w-full rounded-[20px] border border-input bg-background px-4 text-sm text-foreground shadow-sm transition outline-none placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive/40 focus-visible:ring-destructive/20',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
})
