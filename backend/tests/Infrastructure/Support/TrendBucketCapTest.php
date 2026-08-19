<?php

declare(strict_types=1);

namespace Tests\Infrastructure\Support;

use App\Infrastructure\Support\TrendBucketCap;
use DateTimeImmutable;
use Tests\TestCase;

/**
 * Regression coverage for the "cap by bucket count instead of by distinct
 * date" bug: DbMetricsRepository::bucketByLocalDay() can produce up to 2
 * buckets per calendar day (one per viewer_type: 'rep' and 'doctor'), so
 * capping via array_slice() on raw buckets used to silently drop up to
 * half of the intended day window whenever both series had activity on
 * the same days (90 requested days x 2 series = up to 180 buckets, and
 * array_slice(..., 0, 90) left as few as ~45 real days visible).
 */
class TrendBucketCapTest extends TestCase
{
    /** @return array{date: string, viewer_type: string, views: int, sessions: int} */
    private function bucket(string $date, string $viewerType): array
    {
        return ['date' => $date, 'viewer_type' => $viewerType, 'views' => 1, 'sessions' => 1];
    }

    public function testNinetyDaysWithBothSeriesReturnsNinetyDaysNotFortyFive(): void
    {
        // 100 distinct real calendar days, each with BOTH series -> 200
        // raw buckets, fed in date-DESC order (mirrors bucketByLocalDay()'s
        // own usort() before calling capToMostRecentDays()).
        $start = new DateTimeImmutable('2026-06-01');
        $datesAsc = [];
        for ($i = 0; $i < 100; $i++) {
            $datesAsc[] = $start->modify("+{$i} days")->format('Y-m-d');
        }
        $datesDesc = array_reverse($datesAsc);

        $buckets = [];
        foreach ($datesDesc as $date) {
            $buckets[] = $this->bucket($date, 'rep');
            $buckets[] = $this->bucket($date, 'doctor');
        }

        $result = TrendBucketCap::capToMostRecentDays($buckets, 90);

        $uniqueDates = array_values(array_unique(array_column($result, 'date')));

        $this->assertCount(
            90,
            $uniqueDates,
            'must keep 90 DISTINCT dates; capping by raw bucket count would have stopped at ~45 dates'
        );
        $this->assertCount(
            180,
            $result,
            'each of the 90 kept dates has both of its buckets preserved (90 x 2 series)'
        );

        // The kept dates must be exactly the 90 MOST RECENT ones.
        $expectedKeptDates = array_slice($datesDesc, 0, 90);
        sort($expectedKeptDates);
        sort($uniqueDates);
        $this->assertSame($expectedKeptDates, $uniqueDates);
    }

    public function testDaysWithSingleSeriesDoNotConsumeDoubleQuota(): void
    {
        // 5 distinct days, DESC order: day5 has only 'rep', day4 has only
        // 'doctor', day3/day2/day1 have both. Cap to 3 days.
        $buckets = [
            $this->bucket('2026-06-05', 'rep'),
            $this->bucket('2026-06-04', 'doctor'),
            $this->bucket('2026-06-03', 'rep'),
            $this->bucket('2026-06-03', 'doctor'),
            $this->bucket('2026-06-02', 'rep'),
            $this->bucket('2026-06-02', 'doctor'),
            $this->bucket('2026-06-01', 'rep'),
        ];

        $result = TrendBucketCap::capToMostRecentDays($buckets, 3);

        $keptDates = array_values(array_unique(array_column($result, 'date')));
        $this->assertSame(['2026-06-05', '2026-06-04', '2026-06-03'], $keptDates);

        // day5 (1 bucket) + day4 (1 bucket) + day3 (2 buckets) = 4 buckets.
        $this->assertCount(4, $result);
    }

    public function testMaxDaysLargerThanAvailableDataReturnsInputUnchangedWithoutSyntheticBuckets(): void
    {
        // Sparse, non-contiguous data (gaps = days with zero activity).
        // maxDays (90) is far larger than the 2 distinct dates present.
        $buckets = [
            $this->bucket('2026-06-03', 'rep'),
            $this->bucket('2026-06-01', 'doctor'),
        ];

        $result = TrendBucketCap::capToMostRecentDays($buckets, 90);

        $this->assertSame(
            $buckets,
            $result,
            'no buckets must be invented for the days between/around the sparse input dates'
        );
    }

    public function testExactlyMaxDaysKeepsEveryDate(): void
    {
        $buckets = [
            $this->bucket('2026-06-03', 'rep'),
            $this->bucket('2026-06-02', 'rep'),
            $this->bucket('2026-06-01', 'rep'),
        ];

        $result = TrendBucketCap::capToMostRecentDays($buckets, 3);

        $this->assertSame($buckets, $result);
    }

    public function testEmptyInputReturnsEmptyArray(): void
    {
        $this->assertSame([], TrendBucketCap::capToMostRecentDays([], 90));
    }
}
