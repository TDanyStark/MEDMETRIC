<?php

declare(strict_types=1);

namespace App\Infrastructure\Support;

/**
 * Caps an ordered list of per-day trend buckets (as produced by
 * DbMetricsRepository::bucketByLocalDay()) to the N most-recent DISTINCT
 * calendar dates — NOT the N most-recent buckets/rows.
 *
 * A single calendar day can yield more than one bucket (one per
 * viewer_type: 'rep' and 'doctor'), so naively slicing the first N array
 * entries silently drops calendar days whenever more than one series has
 * activity on the same day. This class exists as a small, pure, DB-free
 * unit specifically so that mistake can be unit-tested in isolation and
 * can't be quietly reintroduced — always cap via capToMostRecentDays(),
 * never via array_slice() directly on bucket rows.
 *
 * Pure / stateless / static — no PDO dependency, safe to call from any
 * layer and trivial to unit test without a database.
 */
final class TrendBucketCap
{
    /**
     * Keep only the buckets whose 'date' is among the $maxDays most-recent
     * DISTINCT dates present in $buckets. Never synthesizes buckets for
     * dates that aren't present in the input (days with zero activity stay
     * absent, matching bucketByLocalDay()'s existing "no rows -> no
     * bucket" behavior).
     *
     * @param array<int, array{date: string}&array<string, mixed>> $buckets Assumed already ordered by 'date' DESC.
     * @param int $maxDays Max number of DISTINCT dates to keep.
     * @return array<int, array<string, mixed>> $buckets filtered to the kept dates, relative order preserved.
     */
    public static function capToMostRecentDays(array $buckets, int $maxDays): array
    {
        // array_unique() over an already date-DESC-ordered column keeps
        // the first (most recent) occurrence of each date and preserves
        // that DESC order — no extra sort needed.
        $uniqueDatesDesc = array_values(array_unique(array_column($buckets, 'date')));
        $keepDates = array_slice($uniqueDatesDesc, 0, $maxDays);
        $keepDatesSet = array_flip($keepDates);

        return array_values(array_filter(
            $buckets,
            static fn(array $bucket) => isset($keepDatesSet[$bucket['date']])
        ));
    }
}
