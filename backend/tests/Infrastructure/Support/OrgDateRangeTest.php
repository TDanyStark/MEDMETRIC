<?php

declare(strict_types=1);

namespace Tests\Infrastructure\Support;

use App\Infrastructure\Support\OrgDateRange;
use InvalidArgumentException;
use Tests\TestCase;

/**
 * All UTC boundary values in this test were verified against PHP's actual
 * tzdata transitions for America/Santiago in 2026, not hand-computed:
 *
 *   2026-04-05T03:00:00Z  DST ends   (offset -03:00 -> -04:00, fall-back)
 *   2026-09-06T04:00:00Z  DST starts (offset -04:00 -> -03:00, spring-forward)
 *
 * (confirmed via DateTimeZone::getTransitions() during implementation).
 */
class OrgDateRangeTest extends TestCase
{
    private const SANTIAGO = 'America/Santiago';

    // -----------------------------------------------------------------
    // Normal days (no DST transition involved)
    // -----------------------------------------------------------------

    public function testSingleNormalDaySummerOffset(): void
    {
        // January = Chilean summer = DST active = UTC-03:00
        [$from, $to] = OrgDateRange::boundsForLocalDates('2026-01-15', '2026-01-15', self::SANTIAGO);

        $this->assertSame('2026-01-15 03:00:00', $from);
        $this->assertSame('2026-01-16 03:00:00', $to);
    }

    public function testSingleNormalDayWinterOffset(): void
    {
        // June = Chilean winter = standard time = UTC-04:00
        [$from, $to] = OrgDateRange::boundsForLocalDates('2026-06-15', '2026-06-15', self::SANTIAGO);

        $this->assertSame('2026-06-15 04:00:00', $from);
        $this->assertSame('2026-06-16 04:00:00', $to);
    }

    public function testMultiDayRangeWithinWinterOffset(): void
    {
        [$from, $to] = OrgDateRange::boundsForLocalDates('2026-06-10', '2026-06-12', self::SANTIAGO);

        $this->assertSame('2026-06-10 04:00:00', $from);
        // Upper bound is midnight of the day AFTER $toLocal (half-open).
        $this->assertSame('2026-06-13 04:00:00', $to);
    }

    // -----------------------------------------------------------------
    // DST: fall-back (2026-04-05, clocks move back -03:00 -> -04:00)
    // -----------------------------------------------------------------

    public function testFallBackTransitionDayIs25HoursWide(): void
    {
        // 2026-04-04 contains the repeated local hour (23:00-23:59 occurs
        // twice), so the day itself is 25 wall-clock hours wide. The
        // half-open UTC range must reflect that real 25h span.
        [$from, $to] = OrgDateRange::boundsForLocalDates('2026-04-04', '2026-04-04', self::SANTIAGO);

        $this->assertSame('2026-04-04 03:00:00', $from); // -03:00 offset still active at local midnight
        $this->assertSame('2026-04-05 04:00:00', $to);   // next midnight, now under -04:00 offset

        $spanSeconds = strtotime($to) - strtotime($from);
        $this->assertSame(25 * 3600, $spanSeconds, 'DST fall-back day must span exactly 25 hours');
    }

    public function testDayAfterFallBackTransitionIsNormal24Hours(): void
    {
        // 2026-04-05 is the first full day under the new -04:00 offset;
        // the transition itself lands inside 2026-04-04, not at this
        // day's own midnight, so this day is a normal 24h day.
        [$from, $to] = OrgDateRange::boundsForLocalDates('2026-04-05', '2026-04-05', self::SANTIAGO);

        $this->assertSame('2026-04-05 04:00:00', $from);
        $this->assertSame('2026-04-06 04:00:00', $to);

        $spanSeconds = strtotime($to) - strtotime($from);
        $this->assertSame(24 * 3600, $spanSeconds);
    }

    public function testRangeSpanningFallBackTransition(): void
    {
        [$from, $to] = OrgDateRange::boundsForLocalDates('2026-04-03', '2026-04-06', self::SANTIAGO);

        $this->assertSame('2026-04-03 03:00:00', $from);
        $this->assertSame('2026-04-07 04:00:00', $to);
    }

    // -----------------------------------------------------------------
    // DST: spring-forward (2026-09-06, clocks jump -04:00 -> -03:00,
    // local 00:00:00-00:59:59 on 2026-09-06 does not exist)
    // -----------------------------------------------------------------

    public function testSpringForwardGapDayIs23HoursWide(): void
    {
        // Local midnight 2026-09-06 00:00:00 does not exist (the clock
        // jumps straight from 23:59:59 on 09-05 -04:00 to 01:00:00 on
        // 09-06 -03:00). PHP resolves the non-existent instant using the
        // pre-transition offset, landing exactly on the transition
        // instant (2026-09-06 04:00:00 UTC) — the only sane single value.
        [$from, $to] = OrgDateRange::boundsForLocalDates('2026-09-06', '2026-09-06', self::SANTIAGO);

        $this->assertSame('2026-09-06 04:00:00', $from);
        $this->assertSame('2026-09-07 03:00:00', $to); // next day, now under -03:00 offset

        $spanSeconds = strtotime($to) - strtotime($from);
        $this->assertSame(23 * 3600, $spanSeconds, 'DST spring-forward day must span exactly 23 hours');
    }

    public function testDayBeforeSpringForwardTransition(): void
    {
        // 2026-09-05 is a normal last day under -04:00; its upper bound
        // is the (non-existent, gap-resolved) midnight of 2026-09-06,
        // still landing correctly on the transition instant.
        [$from, $to] = OrgDateRange::boundsForLocalDates('2026-09-05', '2026-09-05', self::SANTIAGO);

        $this->assertSame('2026-09-05 04:00:00', $from);
        $this->assertSame('2026-09-06 04:00:00', $to);

        $spanSeconds = strtotime($to) - strtotime($from);
        $this->assertSame(24 * 3600, $spanSeconds);
    }

    public function testRangeSpanningSpringForwardTransition(): void
    {
        [$from, $to] = OrgDateRange::boundsForLocalDates('2026-09-04', '2026-09-07', self::SANTIAGO);

        $this->assertSame('2026-09-04 04:00:00', $from);
        $this->assertSame('2026-09-08 03:00:00', $to);
    }

    // -----------------------------------------------------------------
    // Open-ended ranges / null handling
    // -----------------------------------------------------------------

    public function testNullFromAndToReturnsBothNull(): void
    {
        [$from, $to] = OrgDateRange::boundsForLocalDates(null, null, self::SANTIAGO);

        $this->assertNull($from);
        $this->assertNull($to);
    }

    public function testOnlyFromLocalSet(): void
    {
        [$from, $to] = OrgDateRange::boundsForLocalDates('2026-06-15', null, self::SANTIAGO);

        $this->assertSame('2026-06-15 04:00:00', $from);
        $this->assertNull($to);
    }

    public function testOnlyToLocalSet(): void
    {
        [$from, $to] = OrgDateRange::boundsForLocalDates(null, '2026-06-15', self::SANTIAGO);

        $this->assertNull($from);
        $this->assertSame('2026-06-16 04:00:00', $to);
    }

    // -----------------------------------------------------------------
    // isValid()
    // -----------------------------------------------------------------

    public function testIsValidAcceptsLatamZones(): void
    {
        $this->assertTrue(OrgDateRange::isValid('America/Santiago'));
        $this->assertTrue(OrgDateRange::isValid('America/Bogota'));
        $this->assertTrue(OrgDateRange::isValid('America/Sao_Paulo'));
    }

    public function testIsValidRejectsJunk(): void
    {
        $this->assertFalse(OrgDateRange::isValid('Not/AZone'));
        $this->assertFalse(OrgDateRange::isValid(''));
        $this->assertFalse(OrgDateRange::isValid('UTC+3'));
        $this->assertFalse(OrgDateRange::isValid('santiago'));
    }

    public function testBoundsForLocalDatesThrowsOnInvalidTimezone(): void
    {
        $this->expectException(InvalidArgumentException::class);

        OrgDateRange::boundsForLocalDates('2026-01-01', '2026-01-01', 'Not/AZone');
    }

    // -----------------------------------------------------------------
    // localDateBucket() — PHP-side day bucketing for trend queries
    // -----------------------------------------------------------------

    public function testLocalDateBucketMidDayUnambiguous(): void
    {
        // 2026-06-15 12:00:00 UTC, winter offset -04:00 -> 08:00 local, same day.
        $this->assertSame(
            '2026-06-15',
            OrgDateRange::localDateBucket('2026-06-15 12:00:00', self::SANTIAGO)
        );
    }

    public function testLocalDateBucketNearUtcMidnightRollsBackToPreviousLocalDay(): void
    {
        // 2026-06-15 02:00:00 UTC, winter offset -04:00 -> 2026-06-14 22:00:00 local.
        // A naive `DATE(opened_at)` on the raw UTC value would (wrongly) bucket
        // this into 2026-06-15 — this is exactly the bug this method fixes.
        $this->assertSame(
            '2026-06-14',
            OrgDateRange::localDateBucket('2026-06-15 02:00:00', self::SANTIAGO)
        );
    }

    public function testLocalDateBucketNearUtcMidnightSummerOffset(): void
    {
        // 2026-01-15 01:00:00 UTC, summer offset -03:00 -> 2026-01-14 22:00:00 local.
        $this->assertSame(
            '2026-01-14',
            OrgDateRange::localDateBucket('2026-01-15 01:00:00', self::SANTIAGO)
        );
    }

    public function testLocalDateBucketRightAtFallBackTransitionInstant(): void
    {
        // 2026-04-05 03:00:00 UTC is exactly the fall-back transition instant
        // (offset flips -03:00 -> -04:00 there). Both sides of the transition
        // still resolve to the same local calendar day (2026-04-04, per the
        // 25h-wide day established in testFallBackTransitionDayIs25HoursWide).
        $this->assertSame(
            '2026-04-04',
            OrgDateRange::localDateBucket('2026-04-05 02:59:59', self::SANTIAGO)
        );
        $this->assertSame(
            '2026-04-05',
            OrgDateRange::localDateBucket('2026-04-05 04:00:00', self::SANTIAGO)
        );
    }

    public function testLocalDateBucketThrowsOnInvalidTimezone(): void
    {
        $this->expectException(InvalidArgumentException::class);

        OrgDateRange::localDateBucket('2026-01-01 00:00:00', 'Not/AZone');
    }
}
