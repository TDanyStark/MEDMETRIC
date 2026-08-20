import { CalendarRange } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

interface EffectiveRangeNoticeProps {
  /** True while the range shown is still the untouched rolling default
   * (no explicit filter set by the user) — see
   * `lib/dateRangeCap.ts::computeDefaultDateRange()`. */
  isDefaultRange: boolean;
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
 * only renders when `wasCapped===true`).
 *
 * Originally closed a gap where 5 of the 6 widgets applied NO date filter
 * by default (full history) while `OpenTrendChart` always capped at
 * `maxTrendDays` even with no filter set — two silently different windows
 * on the same screen (sdd/rep-metrics-module/number-semantics, Ronda 2,
 * P3). That asymmetry no longer exists: ALL 7 endpoints (including the
 * trend chart) now share the exact same default of `maxTrendDays` days
 * when no filter is set (`MetricsTrendConfig::DEFAULT_RANGE_DAYS` ===
 * `MAX_TREND_DAYS`, see that constant's docblock), so `startDate`/
 * `endDate` here are ALWAYS a concrete, populated range — never an empty
 * "todo el historial" state. This notice now exists to make that
 * always-on range legible, and to distinguish "this is the rolling
 * default" from "you picked this range yourself".
 */
export function EffectiveRangeNotice({
  isDefaultRange,
  startDate,
  endDate,
  maxTrendDays,
}: EffectiveRangeNoticeProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="accent" className="normal-case tracking-normal font-medium">
        <CalendarRange className="mr-1 h-3 w-3" />
        {formatCalendarDate(startDate, "el inicio")} – {formatCalendarDate(endDate, "hoy")}
      </Badge>
      <span>
        {isDefaultRange
          ? `Rango por defecto: últimos ${maxTrendDays} días (3 meses). Podés ajustarlo con los selectores de fecha — el máximo permitido es de ${maxTrendDays} días.`
          : `Rango que elegiste. Tarjetas, listas y el gráfico de evolución usan este mismo rango — el máximo permitido es de ${maxTrendDays} días.`}
      </span>
    </div>
  );
}
