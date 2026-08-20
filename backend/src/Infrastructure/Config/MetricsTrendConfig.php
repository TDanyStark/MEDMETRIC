<?php

declare(strict_types=1);

namespace App\Infrastructure\Config;

class MetricsTrendConfig
{
    /**
     * Maximum number of DISTINCT org-local calendar DAYS returned/fetched
     * for trend-style metrics (material views / study views daily charts
     * in DbMetricsRepository).
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
     */
    public const MAX_TREND_DAYS = 90;

    /**
     * Default org-local window (in DAYS) applied by
     * `DbRepMetricsRepository` to EVERY `/v1/rep/metrics/*` endpoint when
     * the caller supplies neither `start_date` nor `end_date` (sdd/
     * rep-metrics-module, "unificación del rango por defecto a 3 meses").
     *
     * DELIBERATELY an alias for MAX_TREND_DAYS, not a separate literal:
     * the product decision ("last 3 months") is expressed as the SAME 90
     * days already used as `openTrend()`'s hard cap, so this repository
     * can NEVER end up with two different numbers to keep in sync by
     * hand. This also means the default IS the ceiling here — by design,
     * not an accident: prior to this change, 5 of 6 rep-metrics endpoints
     * had NO date restriction at all while `openTrend()` alone silently
     * capped at 90 days, so the same screen could show two different
     * "effective" windows with no visual indication. Decoupling "default"
     * from "max" again (e.g. letting the other 5 endpoints be widened
     * past 90 days while the trend chart keeps silently re-capping to 90)
     * would reintroduce exactly that class of bug. Keeping default ===
     * max here guarantees all 7 endpoints ALWAYS agree on the exact same
     * window, with zero risk of silent divergence. See
     * `OrgDateRange::capRangeToMaxDays()` / `lastNLocalDays()` for the
     * shared implementation and `frontend/src/lib/metricsTrendConfig.ts`
     * for the mirrored frontend constant.
     */
    public const DEFAULT_RANGE_DAYS = self::MAX_TREND_DAYS;
}
