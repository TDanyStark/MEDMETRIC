import { CalendarRange } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

interface EffectiveRangeNoticeProps {
  /** True while the range shown is still the untouched rolling default
   * (no explicit filter set by the user) — see
   * `lib/dateRangeCap.ts::computeDefaultDateRange()`. */
  isDefaultRange: boolean;
  startDate: string;
  endDate: string;
  /** `DEFAULT_METRICS_RANGE_DAYS` — the rolling window pre-filled when no
   * explicit filter is set. Independent of `maxRangeDays` (see that
   * prop's docblock) — this is intentionally the SMALLER of the two. */
  defaultRangeDays: number;
  /** `MAX_METRICS_RANGE_DAYS` — the widest span the date pickers/URL will
   * accept before the backend silently truncates it. Independent of
   * `defaultRangeDays`: a user CAN select a range up to this size, even
   * though the page opens with the smaller default. */
  maxRangeDays: number;
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
 * by default (full history) while `OpenTrendChart` always capped at 90
 * days even with no filter set — two silently different windows on the
 * same screen (sdd/rep-metrics-module/number-semantics, Ronda 2, P3).
 * ALL widgets (including the trend chart's underlying query) now share
 * the exact same `defaultRangeDays`-day default when no filter is set,
 * so `startDate`/`endDate` here are ALWAYS a concrete, populated range —
 * never an empty "todo el historial" state.
 *
 * `defaultRangeDays` and `maxRangeDays` are DELIBERATELY two different
 * numbers (sdd/rep-metrics-module, "separar rango por defecto del tope
 * máximo") — this notice's whole job is to make that distinction legible:
 * the page opens with a short default, but the user CAN widen the range
 * (via the date pickers) all the way up to `maxRangeDays` without ever
 * being told the two are the same when they're not. The trend chart has
 * its OWN, smaller rendering cap independent of both these numbers — see
 * `OpenTrendChart`'s own inline caption for that.
 */
export function EffectiveRangeNotice({
  isDefaultRange,
  startDate,
  endDate,
  defaultRangeDays,
  maxRangeDays,
}: EffectiveRangeNoticeProps) {
  const defaultRangeMonths = Math.round(defaultRangeDays / 30);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="accent" className="normal-case tracking-normal font-medium">
        <CalendarRange className="mr-1 h-3 w-3" />
        {formatCalendarDate(startDate, "el inicio")} – {formatCalendarDate(endDate, "hoy")}
      </Badge>
      <span>
        {isDefaultRange
          ? `Rango por defecto: últimos ${defaultRangeDays} días (~${defaultRangeMonths} meses). Podés ampliarlo hasta ${maxRangeDays} días con los selectores de fecha.`
          : `Rango que elegiste. Tarjetas y listas usan este mismo rango — el máximo permitido es de ${maxRangeDays} días.`}
      </span>
    </div>
  );
}
