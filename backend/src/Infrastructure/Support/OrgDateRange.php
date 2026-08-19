<?php

declare(strict_types=1);

namespace App\Infrastructure\Support;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

/**
 * Converts an organization-local calendar date (or date range) into a UTC
 * half-open datetime range suitable for filtering `DATETIME` columns that
 * are always written in UTC:
 *
 *     col >= :from_utc AND col < :to_utc_exclusive
 *
 * Pure / stateless / static — no PDO dependency, so it is safe to call from
 * any layer (Actions, Repositories). This is the single shared conversion
 * point used by every date-filtered query in the app (metrics, comments,
 * visit sessions) to avoid re-implementing DST-aware math at each of the
 * ~21 call sites.
 *
 * DST-safety: this class NEVER hardcodes a numeric UTC offset. All
 * conversion goes through a named IANA `DateTimeZone` + `DateTimeImmutable`,
 * so the correct offset for a zone's DST transitions (e.g. Chile changes
 * twice a year) is always resolved from the system tzdata at call time.
 *
 * DST edge cases (validated against America/Santiago's 2026 transitions —
 * fall-back 2026-04-05, spring-forward 2026-09-06):
 *
 * - Spring-forward GAP: a local calendar time can be skipped entirely
 *   (e.g. 2026-09-06 00:00:00 America/Santiago does not exist — the clock
 *   jumps from 2026-09-05 23:59:59 -04:00 straight to 2026-09-06 01:00:00
 *   -03:00). PHP resolves a non-existent local time by computing it against
 *   the offset that was active immediately BEFORE the transition and then
 *   normalizing, which lands exactly on the transition instant
 *   (2026-09-06 04:00:00 UTC here). The resulting UTC boundary is still a
 *   single, well-defined instant that correctly bounds the calendar day —
 *   that day is simply ~23h wide instead of 24h, which is accurate (that's
 *   what actually happened to the clock). This is a deliberate, accepted
 *   trade-off — see sdd/org-timezone/design.
 *
 * - Fall-back OVERLAP: a local hour can occur twice (e.g. 2026-04-04
 *   23:00:00-23:59:59 America/Santiago happens once under the outgoing
 *   -03:00 offset and once again under the incoming -04:00 offset). PHP
 *   resolves an ambiguous local time to its FIRST (pre-transition, i.e.
 *   earlier-in-wall-clock-terms) occurrence. Because every boundary in this
 *   class is built at local midnight using the exact same construction
 *   rule (`DateTimeImmutable` + named `DateTimeZone`) for BOTH ends of
 *   every adjacent day pair, half-open day ranges stay contiguous and no
 *   instant is ever double-counted or dropped across a day boundary — even
 *   on the (rarer) zones where the ambiguous hour touches midnight itself.
 */
final class OrgDateRange
{
    /**
     * Convert an org-local [fromLocal, toLocal] inclusive calendar-date
     * range into a UTC half-open datetime range: `>= fromUtc` and
     * `< toUtcExclusive`.
     *
     * Pass the same value for $fromLocal and $toLocal for a single-day
     * range: [dayStartUtc, nextDayStartUtc). Either bound may be null for
     * an open-ended range; both null returns [null, null].
     *
     * @param string|null $fromLocal 'YYYY-MM-DD' or null
     * @param string|null $toLocal   'YYYY-MM-DD' or null
     * @param string      $tz        IANA timezone identifier, e.g. 'America/Santiago'
     * @return array{0: ?string, 1: ?string} [fromUtc, toUtcExclusive] as 'Y-m-d H:i:s' or null
     *
     * @throws InvalidArgumentException if $tz is not a known IANA identifier
     */
    public static function boundsForLocalDates(?string $fromLocal, ?string $toLocal, string $tz): array
    {
        if (!self::isValid($tz)) {
            throw new InvalidArgumentException("Unknown timezone identifier: {$tz}");
        }

        $zone = new DateTimeZone($tz);
        $utc  = new DateTimeZone('UTC');

        $fromUtc = $fromLocal !== null
            ? self::localMidnightToUtc($fromLocal, $zone, $utc)
            : null;

        // Half-open upper bound = midnight of the day AFTER $toLocal, so a
        // single-day query (fromLocal === toLocal) still captures the full
        // local day regardless of its actual length (23h/24h/25h under DST).
        $toUtcExclusive = $toLocal !== null
            ? self::localMidnightToUtc(self::nextCalendarDay($toLocal), $zone, $utc)
            : null;

        return [$fromUtc, $toUtcExclusive];
    }

    /**
     * Return [startLocal, endLocal] 'YYYY-MM-DD' calendar dates bounding the
     * last $days org-local calendar days, inclusive of "today" in $tz.
     *
     * Used to give trend-style queries a sane DEFAULT window (at the
     * database level, via boundsForLocalDates()) when the caller did not
     * supply an explicit start_date/end_date, so the query never fetches an
     * organization's entire unbounded history before later slicing it down
     * in PHP. Bounding is done here in org-local calendar days (not raw
     * rows) so the resulting DB filter still yields exactly the intended
     * "last 90 local days" window regardless of view volume per day.
     *
     * @return array{0: string, 1: string} [startLocal, endLocal]
     *
     * @throws InvalidArgumentException if $tz is not a known IANA identifier
     */
    public static function lastNLocalDays(int $days, string $tz): array
    {
        if (!self::isValid($tz)) {
            throw new InvalidArgumentException("Unknown timezone identifier: {$tz}");
        }

        $zone  = new DateTimeZone($tz);
        $today = new DateTimeImmutable('now', $zone);

        $end   = $today->format('Y-m-d');
        $start = $today->modify('-' . ($days - 1) . ' days')->format('Y-m-d');

        return [$start, $end];
    }

    /**
     * Bound an org-local [startLocal, endLocal] calendar-date filter pair
     * to at most $maxDays days, WITHOUT changing the caller's requested
     * end boundary. Shared by any date-filtered query that must never
     * fetch/return more than $maxDays org-local calendar days (currently
     * DbMetricsRepository's trend endpoints, which feed bucketByLocalDay()
     * / TrendBucketCap and must not pull an org's entire unbounded history
     * into PHP just because the caller supplied a wide or missing range).
     *
     * Truncation is SILENT (no exception, no 4xx): when the effective span
     * exceeds $maxDays, $startLocal is the value that gets pulled forward;
     * $endLocal is always returned exactly as passed in (including null),
     * matching the "keep the most recent days" semantics used elsewhere in
     * this codebase for the same kind of cap.
     *
     * - Both null: falls back to lastNLocalDays($maxDays, $tz) (unchanged
     *   default-window behavior for "no filter supplied at all").
     * - Only $endLocal supplied: $startLocal is computed as
     *   $endLocal - ($maxDays - 1) days.
     * - Only $startLocal supplied (open-ended-to-now): the span is
     *   measured against "today" in $tz, and $startLocal is pulled forward
     *   if that implied span exceeds $maxDays; $endLocal stays null.
     * - Both supplied and span > $maxDays: $startLocal is pulled forward
     *   to $endLocal - ($maxDays - 1) days.
     * - Both supplied and span <= $maxDays: returned unchanged.
     *
     * @param string|null $startLocal 'YYYY-MM-DD' or null
     * @param string|null $endLocal   'YYYY-MM-DD' or null
     * @param int         $maxDays    max number of calendar days to allow (must be >= 1)
     * @param string      $tz         IANA timezone identifier, e.g. 'America/Santiago'
     * @return array{0: ?string, 1: ?string} [boundedStartLocal, $endLocal] as 'YYYY-MM-DD' or null
     *
     * @throws InvalidArgumentException if $tz is not a known IANA identifier
     */
    public static function capRangeToMaxDays(?string $startLocal, ?string $endLocal, int $maxDays, string $tz): array
    {
        if (!self::isValid($tz)) {
            throw new InvalidArgumentException("Unknown timezone identifier: {$tz}");
        }

        if ($startLocal === null && $endLocal === null) {
            return self::lastNLocalDays($maxDays, $tz);
        }

        $zone = new DateTimeZone($tz);

        // Effective upper bound used only to MEASURE the span: the
        // caller's own $endLocal, or "today" org-local when only a start
        // was supplied. $endLocal itself is returned untouched below.
        $effectiveEndLocal = $endLocal ?? (new DateTimeImmutable('now', $zone))->format('Y-m-d');

        $minStartLocal = (new DateTimeImmutable($effectiveEndLocal, $zone))
            ->modify('-' . ($maxDays - 1) . ' days')
            ->format('Y-m-d');

        $boundedStartLocal = ($startLocal === null || $startLocal < $minStartLocal)
            ? $minStartLocal
            : $startLocal;

        return [$boundedStartLocal, $endLocal];
    }

    /**
     * Whether $tz is a known IANA timezone identifier.
     */
    public static function isValid(string $tz): bool
    {
        if ($tz === '') {
            return false;
        }

        return in_array($tz, timezone_identifiers_list(), true);
    }

    /**
     * Return the org-local calendar date ('YYYY-MM-DD') that a UTC
     * datetime string falls into. Used to bucket raw UTC-stored rows
     * (e.g. `material_views.opened_at`) into org-local calendar days for
     * daily trend charts — grouping by UTC day (as MySQL `GROUP BY
     * DATE(col)` does) is a separate bug from range-filtering: a view
     * opened at 23:30 America/Santiago (02:30 UTC the next day, in
     * summer) must bucket into the LOCAL day it happened on, not the UTC
     * day. `CONVERT_TZ()` is unavailable on Hostinger (empty
     * `mysql.time_zone` tables), so this bucketing is done in PHP,
     * post-fetch, using the same named-`DateTimeZone` construction rule
     * as the rest of this class (never a numeric offset).
     *
     * @param string $utcDatetime 'Y-m-d H:i:s' (or any format
     *   `DateTimeImmutable` accepts), interpreted as UTC.
     * @param string $tz IANA timezone identifier, e.g. 'America/Santiago'
     *
     * @throws InvalidArgumentException if $tz is not a known IANA identifier
     */
    public static function localDateBucket(string $utcDatetime, string $tz): string
    {
        if (!self::isValid($tz)) {
            throw new InvalidArgumentException("Unknown timezone identifier: {$tz}");
        }

        return (new DateTimeImmutable($utcDatetime, new DateTimeZone('UTC')))
            ->setTimezone(new DateTimeZone($tz))
            ->format('Y-m-d');
    }

    /**
     * Pure calendar-date arithmetic ('YYYY-MM-DD' -> next 'YYYY-MM-DD'),
     * computed in UTC so it is completely independent of any DST rule —
     * a UTC day is always exactly 24h, so "+1 day" is unambiguous here.
     * The result is only later interpreted as local midnight in the
     * target org timezone by localMidnightToUtc().
     */
    private static function nextCalendarDay(string $ymd): string
    {
        return (new DateTimeImmutable($ymd . ' 00:00:00', new DateTimeZone('UTC')))
            ->modify('+1 day')
            ->format('Y-m-d');
    }

    /**
     * Build local midnight for calendar date $ymd in $zone and return it
     * converted to UTC as 'Y-m-d H:i:s'.
     */
    private static function localMidnightToUtc(string $ymd, DateTimeZone $zone, DateTimeZone $utc): string
    {
        return (new DateTimeImmutable($ymd . ' 00:00:00', $zone))
            ->setTimezone($utc)
            ->format('Y-m-d H:i:s');
    }
}
