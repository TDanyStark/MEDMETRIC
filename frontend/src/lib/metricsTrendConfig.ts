/**
 * Maximum number of org-local calendar DAYS the metrics trend endpoints
 * (`GET /api/v1/metrics/material-views`, `GET /api/v1/metrics/study-views`)
 * will actually return, no matter how wide a `start_date`/`end_date` range
 * is requested.
 *
 * MUST stay in sync with `MetricsTrendConfig::MAX_TREND_DAYS` in
 * `backend/src/Infrastructure/Config/MetricsTrendConfig.php`. The backend
 * caps the effective range SILENTLY (no error) via
 * `OrgDateRange::capRangeToMaxDays()` / `DbMetricsRepository::boundTrendDateRange()`,
 * truncating `start_date` forward and always keeping the requested
 * `end_date`. This constant is duplicated here (not fetched over the wire)
 * on purpose: it only drives client-side UX (disabling unreachable
 * date-picker days, sanitizing shared URLs, showing the "capped" hint) and
 * the backend remains the sole source of truth/enforcement regardless of
 * what this value is set to — a mismatch here can only make the UI hint
 * slightly wrong, never make the app show untruncated data it doesn't have.
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
 * DELIBERATELY an alias for MAX_METRICS_TREND_DAYS, not a separate
 * literal — mirrors `MetricsTrendConfig::DEFAULT_RANGE_DAYS` on the
 * backend (see that constant's docblock for the full "default === cap"
 * rationale): reusing the exact same 90-day value that already caps the
 * trend chart means all 7 rep-metrics endpoints are GUARANTEED to agree
 * on the same window whenever no filter is set, with no risk of the
 * trend chart silently showing fewer days than the rest of the page (the
 * bug this default unifies away). If you ever change this value, update
 * `MetricsTrendConfig::DEFAULT_RANGE_DAYS` in the same PR.
 */
export const DEFAULT_METRICS_RANGE_DAYS = MAX_METRICS_TREND_DAYS
