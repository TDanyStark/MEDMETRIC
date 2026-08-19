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
