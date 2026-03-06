import { Search, Sparkles } from 'lucide-react'
import { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

interface PageIntroProps {
  eyebrow: string
  title: string
  description: string
  badge?: string
  actions?: ReactNode
}

export function PageIntro({ eyebrow, title, description, badge, actions }: PageIntroProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr] lg:p-8">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-foreground lg:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>
        </div>

        <div className="rounded-[30px] border border-border/80 bg-background/85 p-5">
          {badge && <Badge variant="accent">{badge}</Badge>}
          <div className="mt-4 flex items-start gap-3 text-sm leading-6 text-muted-foreground">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <p>La interfaz reduce pasos: filtros visibles, panel operativo y acciones inmediatas dentro de la misma pantalla.</p>
          </div>

          {actions && <div className="mt-5 flex flex-wrap gap-3">{actions}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

interface MetricItem {
  label: string
  value: string | number
  detail: string
}

export function MetricGrid({ items }: { items: MetricItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map(item => (
        <Card key={item.label}>
          <CardContent className="p-5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
            <p className="mt-3 font-display text-4xl text-foreground">{item.value}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

interface WorkspaceProps {
  primary: ReactNode
  secondary: ReactNode
}

export function Workspace({ primary, secondary }: WorkspaceProps) {
  return <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">{primary}{secondary}</div>
}

interface WorkPanelProps {
  title: string
  description: string
  aside?: ReactNode
  children: ReactNode
  className?: string
}

export function WorkPanel({ title, description, aside, children, className }: WorkPanelProps) {
  return (
    <Card className={cn('h-full', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-[1.75rem]">{title}</CardTitle>
          <CardDescription className="mt-2">{description}</CardDescription>
        </div>
        {aside}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )
}

interface SearchToolbarProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  extra?: ReactNode
}

export function SearchToolbar({ value, onChange, placeholder, extra }: SearchToolbarProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="pl-11" />
      </div>
      {extra && <div className="flex flex-wrap gap-2">{extra}</div>}
    </div>
  )
}

interface SegmentedOption {
  label: string
  value: string
}

interface SegmentedControlProps {
  value: string
  onChange: (value: string) => void
  options: SegmentedOption[]
}

export function SegmentedControl({ value, onChange, options }: SegmentedControlProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const isActive = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-semibold transition',
              isActive
                ? 'border-primary bg-primary text-primary-foreground shadow-[0_16px_35px_rgba(24,90,86,0.2)]'
                : 'border-border bg-background/80 text-muted-foreground hover:border-primary/20 hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

interface ChoicePillsProps<T extends string | number> {
  value: T[]
  options: Array<{ value: T; label: string; hint?: string; disabled?: boolean }>
  onToggle: (value: T) => void
}

export function ChoicePills<T extends string | number>({ value, options, onToggle }: ChoicePillsProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const isActive = value.includes(option.value)

        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onToggle(option.value)}
            disabled={option.disabled}
            className={cn(
              'rounded-[22px] border px-4 py-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
              isActive
                ? 'border-primary/20 bg-primary text-primary-foreground shadow-[0_16px_35px_rgba(24,90,86,0.2)]'
                : 'border-border bg-background/80 text-foreground hover:border-primary/20',
            )}
          >
            <span className="block font-semibold">{option.label}</span>
            {option.hint && <span className={cn('mt-1 block text-xs leading-5', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{option.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}

interface ToggleFieldProps {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint: string
}

export function ToggleField({ checked, onChange, label, hint }: ToggleFieldProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-3xl border border-border/80 bg-background/80 px-4 py-3 text-left transition hover:border-primary/20"
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
      </div>
      <span className={cn('relative h-7 w-12 rounded-full transition', checked ? 'bg-primary' : 'bg-secondary')}>
        <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white transition', checked ? 'left-6' : 'left-1')} />
      </span>
    </button>
  )
}

interface EmptyStateProps {
  title: string
  description: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-dashed border-border bg-background/60 p-6 text-center">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

interface PaginationBarProps {
  page: number
  lastPage: number
  total: number
  onPageChange: (page: number) => void
}

export function PaginationBar({ page, lastPage, total, onPageChange }: PaginationBarProps) {
  if (lastPage <= 1) {
    return null
  }

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border/80 bg-background/75 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>{total} registros disponibles</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <span className="min-w-20 text-center font-semibold text-foreground">
          {page} / {lastPage}
        </span>
        <Button type="button" variant="outline" size="sm" disabled={page >= lastPage} onClick={() => onPageChange(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  )
}
