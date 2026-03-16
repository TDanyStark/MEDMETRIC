import { SelectHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, className, children, ...props }, ref) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'flex h-12 w-full appearance-none rounded-[20px] border border-input bg-background px-4 text-sm text-foreground shadow-sm transition outline-none focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive/40 focus-visible:ring-destructive/20',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-muted-foreground">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
})
