import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, className, ...props }, ref) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={cn(
          'h-8 w-full rounded-md border bg-slate-50 px-3 text-sm text-slate-900',
          'placeholder:text-slate-400',
          'border-slate-200 focus:border-teal-500 focus:bg-white',
          'focus:outline-none focus:ring-2 focus:ring-teal-500/20',
          'transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
})
