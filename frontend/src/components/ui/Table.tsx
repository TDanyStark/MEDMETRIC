import { ReactNode, HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface TableProps {
  children?: ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  )
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50">
      {children}
    </thead>
  )
}

export function Th({ children, className }: TableProps) {
  return (
    <th className={cn(
      'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
      className,
    )}>
      {children}
    </th>
  )
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}

interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
}

export function Tr({ children, className, ...props }: TrProps) {
  return (
    <tr className={cn('hover:bg-slate-50/60 transition-colors', className)} {...props}>
      {children}
    </tr>
  )
}

export function Td({ children, className }: TableProps) {
  return (
    <td className={cn('px-4 py-3 text-slate-700', className)}>
      {children}
    </td>
  )
}
