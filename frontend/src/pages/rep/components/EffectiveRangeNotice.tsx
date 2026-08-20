import { CalendarRange } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

interface EffectiveRangeNoticeProps {
  hasFilters: boolean;
  startDate: string;
  endDate: string;
  maxTrendDays: number;
}

/**
 * Formats a plain "YYYY-MM-DD" org-local calendar-date string WITHOUT
 * going through `formatDate`/`parseUTCDate` — those helpers assume a
 * UTC timestamp and apply a timezone conversion on top, which shifts a
 * bare calendar date (no time component) back a day whenever the org
 * timezone is behind UTC (e.g. "2026-07-01" + America/Santiago renders as
 * "30 jun"). `start_date`/`end_date` here are ALREADY org-local calendar
 * dates (that's the whole point of `OrgDateRange` server-side) — no
 * further timezone conversion belongs on top of them.
 */
function formatCalendarDate(dateStr: string, fallback: string): string {
  if (!dateStr) return fallback;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Always-visible statement of the date range actually being applied on
 * this page — NOT conditional on a cap (unlike `DateRangeCapNotice`, which
 * only renders when `wasCapped===true`). Verified gap this closes
 * (sdd/rep-metrics-module/number-semantics, Ronda 2, P3): 5 of the 6
 * widgets apply NO date filter by default (full history) while
 * `OpenTrendChart` always caps at `maxTrendDays` even with no filter set —
 * two silently different windows on the same screen. This notice is the
 * ONLY change here: no aggregation logic touched, purely a visibility fix
 * per the user-approved scope ("mostrá el rango efectivo... NO unifiques
 * el rango por defecto en este lote").
 */
export function EffectiveRangeNotice({
  hasFilters,
  startDate,
  endDate,
  maxTrendDays,
}: EffectiveRangeNoticeProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="accent" className="normal-case tracking-normal font-medium">
        <CalendarRange className="mr-1 h-3 w-3" />
        {hasFilters
          ? `${formatCalendarDate(startDate, "el inicio")} – ${formatCalendarDate(endDate, "hoy")}`
          : "Todo el historial"}
      </Badge>
      <span>
        {hasFilters
          ? `Tarjetas y listas usan este rango. El gráfico de evolución respeta el mismo rango, con un máximo de ${maxTrendDays} días.`
          : `Sin filtro de fecha: tarjetas y listas muestran todo tu historial. El gráfico de evolución siempre muestra, como máximo, los últimos ${maxTrendDays} días.`}
      </span>
    </div>
  );
}
