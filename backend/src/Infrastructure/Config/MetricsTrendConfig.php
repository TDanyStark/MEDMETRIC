<?php

declare(strict_types=1);

namespace App\Infrastructure\Config;

class MetricsTrendConfig
{
    /**
     * Maximum number of DISTINCT org-local calendar DAYS returned/fetched
     * for trend-style metrics (material views / study views daily charts
     * in DbMetricsRepository, and the rep-metrics `openTrend()` chart).
     *
     * This is a RENDERING limit, not a query-range limit — see
     * `MAX_RANGE_DAYS` below for the (larger, independent) limit on how
     * far back a user may filter the rest of the page. Kept small on
     * purpose so a daily line chart never has to draw hundreds/thousands
     * of points, which becomes illegible well before it becomes a
     * performance problem.
     *
     * This is a DAY count, not a row/bucket count. bucketByLocalDay() can
     * produce up to 2 buckets per calendar day (one per viewer_type: 'rep'
     * and 'doctor'), so a naive `array_slice()` on the raw bucket list
     * would silently return as few as HALF the intended days whenever both
     * series have activity on the same days (e.g. 90 requested days x 2
     * series = up to 180 buckets, and slicing to 90 buckets could leave as
     * little as ~45 real days on screen). Always cap by DISTINCT date
     * (see App\Infrastructure\Support\TrendBucketCap), never by
     * array_slice() directly on bucket rows.
     *
     * SHARED by DbMetricsRepository (org_admin `/metrics`) AND
     * DbRepMetricsRepository (`/rep/metrics`) — do not change this value
     * without checking both consumers; it is the trend chart's own
     * render cap in BOTH modules, independent of DEFAULT_RANGE_DAYS /
     * MAX_RANGE_DAYS below (those two are rep-metrics-only).
     */
    public const MAX_TREND_DAYS = 90;

    /**
     * Default org-local window (in DAYS) applied by
     * `DbRepMetricsRepository` to EVERY `/v1/rep/metrics/*` endpoint when
     * the caller supplies neither `start_date` nor `end_date` (sdd/
     * rep-metrics-module, "unificación del rango por defecto a 3 meses").
     *
     * INDEPENDENT literal, not an alias of MAX_TREND_DAYS or
     * MAX_RANGE_DAYS. It USED to be a deliberate alias of MAX_TREND_DAYS
     * so "default === ceiling" (see git history / prior revision of this
     * docblock) — that guaranteed all 7 rep-metrics endpoints agreed on
     * the same window when unfiltered, but had the unintended side effect
     * of making 90 days an UNMOVABLE hard ceiling for the entire page: a
     * user could never look further back than the default view, because
     * "default" and "max" were the same number by construction
     * (sdd/rep-metrics-module, "separar rango por defecto del tope
     * máximo" — the user explicitly asked to widen past 3 months). The
     * "all endpoints agree when unfiltered" guarantee still holds — every
     * public method here routes through the single `dateRangeFragments()`
     * choke point, which is the only place DEFAULT_RANGE_DAYS is read —
     * it just no longer forces default and max to be the same number.
     * See MAX_RANGE_DAYS below for the (now independent, larger) ceiling.
     */
    public const DEFAULT_RANGE_DAYS = 90;

    /**
     * Maximum org-local calendar-day span an EXPLICIT `start_date`/
     * `end_date` filter may request on `/v1/rep/metrics/*` (every
     * endpoint except `openTrend()`, which always re-bounds itself to the
     * smaller MAX_TREND_DAYS regardless of this value — a chart-rendering
     * concern, not a query-range one; see that method and
     * `DbRepMetricsRepository::dateRangeFragments()`).
     *
     * Enforced server-side via `OrgDateRange::capRangeToMaxDays()` — a
     * hand-crafted or stale/shared URL can never pull an unbounded
     * history, even though prior to this constant existing, explicit
     * filters on 6 of 7 endpoints were passed through completely
     * UNCAPPED (only openTrend() self-capped). The frontend mirrors this
     * exact value as `MAX_METRICS_RANGE_DAYS` in
     * `frontend/src/lib/metricsTrendConfig.ts` to keep the date pickers'
     * selectable range in sync with what the API will actually honor.
     *
     * Value justified against local dev data (measured 2026-08-20, DB
     * with ~2,998 seeded visit_sessions / ~18,037 material_views spanning
     * ~5.5 months): every method in this repository scopes its query to
     * a SINGLE rep (`WHERE vs.rep_id = :rep`, indexed via
     * `idx_visit_sessions_rep`), so widening the requested date range
     * does NOT add more reps/rows to scan — it only reveals more of that
     * SAME already-indexed rep's own history. Cost scales with one rep's
     * visit volume, never the organization's. Measured: the heaviest
     * seeded rep (515 sessions total) executes the `openTrend()`-shaped
     * query across a full 365-day window in ~2-3ms locally (MySQL
     * EXPLAIN confirms `type: ref` on `idx_visit_sessions_rep`, not a
     * table scan). 365 days (12 months) comfortably covers a "look back
     * a full year" use case with no measurable performance risk at this
     * scale. Going wider (multi-year) was not requested and was not
     * measured — revisit once real production per-rep volumes are known.
     */
    public const MAX_RANGE_DAYS = 365;
}
