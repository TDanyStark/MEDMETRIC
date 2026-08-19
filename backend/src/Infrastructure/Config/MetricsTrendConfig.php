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
}
