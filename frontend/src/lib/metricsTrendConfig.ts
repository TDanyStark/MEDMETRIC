/**
 * Maximum number of org-local calendar DAYS the metrics trend CHARTS
 * (`GET /api/v1/metrics/material-views`, `GET /api/v1/metrics/study-views`,
 * and the rep-metrics `openTrend` line chart) will ever RENDER as data
 * points, no matter how wide a `start_date`/`end_date` range is selected.
 * This is a rendering limit, not a query-range limit — see
 * `MAX_METRICS_RANGE_DAYS` below for the (larger, independent) limit on
 * how far back the rest of the rep-metrics page may be filtered.
 *
 * MUST stay in sync with `MetricsTrendConfig::MAX_TREND_DAYS` in
 * `backend/src/Infrastructure/Config/MetricsTrendConfig.php`. The backend
 * caps the effective TREND range SILENTLY (no error) via
 * `OrgDateRange::capRangeToMaxDays()` / `DbMetricsRepository::boundTrendDateRange()`
 * / `DbRepMetricsRepository::openTrend()`, truncating `start_date` forward
 * and always keeping the requested `end_date`. This constant is duplicated
 * here (not fetched over the wire) on purpose: it only drives client-side
 * UX (disabling unreachable date-picker days, sanitizing shared URLs,
 * showing the "capped" hint) and the backend remains the sole source of
 * truth/enforcement regardless of what this value is set to — a mismatch
 * here can only make the UI hint slightly wrong, never make the app show
 * untruncated data it doesn't have.
 *
 * SHARED by the admin dashboard (`MetricsDashboard.tsx`, via the default
 * parameter values of the `dateRangeCap.ts` helpers) AND the rep-metrics
 * page — do not repurpose this constant for the rep page's general
 * selectable-range cap; use `MAX_METRICS_RANGE_DAYS` for that instead, and
 * pass it explicitly wherever `RepMetricsPage.tsx` needs a wider bound, so
 * the admin dashboard's behavior (which relies on this constant's default)
 * is never silently affected.
 *
 * If you change the backend constant, update this value in the same PR.
 */
export const MAX_METRICS_TREND_DAYS = 90

/**
 * Default org-local window (in DAYS) the rep-metrics page (`/rep/metrics`)
 * pre-fills its date pickers with, and every `GET /rep/metrics/*` request
 * carries explicitly, when the user hasn't chosen a filter yet
 * (sdd/rep-metrics-module, "unificación del rango por defecto a 3 meses").
 *
 * INDEPENDENT literal — mirrors `MetricsTrendConfig::DEFAULT_RANGE_DAYS`
 * on the backend. This USED to be a deliberate alias of
 * `MAX_METRICS_TREND_DAYS` so "default === cap"; that guaranteed the
 * trend chart and the rest of the page always agreed on the same window
 * when unfiltered, but also meant the user could never widen the range
 * past the default (sdd/rep-metrics-module, "separar rango por defecto
 * del tope máximo"). See `MAX_METRICS_RANGE_DAYS` below for the new,
 * independent, larger ceiling that replaces "default" in that role. If
 * you ever change this value, update `MetricsTrendConfig::DEFAULT_RANGE_DAYS`
 * in the same PR.
 */
export const DEFAULT_METRICS_RANGE_DAYS = 90

/**
 * Maximum org-local calendar-day span the rep-metrics page (`/rep/metrics`)
 * lets the user select via the date pickers, and the largest range
 * `capDateRangeToMaxDays()` will preserve before truncating a shared/old
 * URL. Mirrors `MetricsTrendConfig::MAX_RANGE_DAYS` on the backend, which
 * enforces the same ceiling server-side on every `/v1/rep/metrics/*`
 * endpoint except `openTrend()` (see that constant's docblock for the
 * full local-data performance justification of 365).
 *
 * DELIBERATELY passed EXPLICITLY as the `maxDays` argument everywhere
 * `RepMetricsPage.tsx` calls the shared `dateRangeCap.ts` helpers
 * (`capDateRangeToMaxDays`, `computeMinStartDate`, `computeMaxEndDate`),
 * rather than changing those helpers' default parameter value — the
 * admin dashboard (`MetricsDashboard.tsx`) calls the same helpers WITHOUT
 * an explicit `maxDays`, relying on their default (`MAX_METRICS_TREND_DAYS`,
 * 90). Changing the default would have silently widened the admin
 * dashboard's selectable range too, which was never requested. If you
 * change the backend constant, update this value in the same PR.
 */
export const MAX_METRICS_RANGE_DAYS = 365
