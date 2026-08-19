import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

interface DateRangeCapNoticeProps {
  maxDays: number
}

/**
 * Discrete, non-blocking notice shown when the effective metrics date
 * range was adjusted to fit the backend's trend window cap (see
 * `MetricsTrendConfig::MAX_TREND_DAYS` / `MAX_METRICS_TREND_DAYS`).
 *
 * Rendered only by the caller when the requested range was wider than the
 * allowed window — e.g. a shared URL with an old, uncapped `start_date` —
 * so the user never assumes they are looking at more data than is
 * actually being shown.
 */
export function DateRangeCapNotice({ maxDays }: DateRangeCapNoticeProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="warm" className="normal-case tracking-normal font-medium">
        <Info className="mr-1 h-3 w-3" />
        Mostrando los últimos {maxDays} días
      </Badge>
      <span>El rango solicitado era más amplio; se ajustó automáticamente.</span>
    </div>
  )
}
