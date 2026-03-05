import { cn } from '../../lib/utils'

export function Table({ children, className }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  )
}

export function Thead({ children }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50">
      {children}
    </thead>
  )
}

export function Th({ children, className }) {
  return (
    <th className={cn(
      'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
      className,
    )}>
      {children}
    </th>
  )
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}

export function Tr({ children, className, ...props }) {
  return (
    <tr className={cn('hover:bg-slate-50/60 transition-colors', className)} {...props}>
      {children}
    </tr>
  )
}

export function Td({ children, className }) {
  return (
    <td className={cn('px-4 py-3 text-slate-700', className)}>
      {children}
    </td>
  )
}
