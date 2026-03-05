import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  default:  'bg-slate-100 text-slate-700',
  active:   'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  inactive: 'bg-slate-100 text-slate-500',
  admin:    'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  manager:  'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  rep:      'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
}

interface BadgeProps {
  variant?: keyof typeof variants;
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
      variants[variant],
      className,
    )}>
      {children}
    </span>
  )
}
