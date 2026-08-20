<?php

declare(strict_types=1);

namespace App\Domain\RepMetrics;

use App\Infrastructure\Config\TimezoneConfig;

/**
 * Rep-scoped metrics: every method takes `int $repId` as a NON-NULLABLE
 * first parameter and MUST apply it as the query's non-negotiable base
 * predicate (a rep's own `visit_sessions.rep_id`), mirroring
 * App\Domain\VisitSessionComment\VisitSessionCommentRepositoryInterface::listForScope()'s
 * "role scope from identity, filters only narrow" invariant (design
 * "Scope enforcement"). $repId is ALWAYS derived server-side from the JWT
 * (see App\Application\Actions\Rep\Metrics\RepMetricsAction::resolveRepId())
 * — it is never accepted as a request parameter anywhere in this module.
 *
 * All metrics are derived exclusively from `viewer_type = 'doctor'` rows
 * in `material_views` (spec "Metrics Catalog Semantics" — every metric is
 * filtered to the doctor's own consumption, not the rep's own preview
 * opens) plus `visit_sessions` / `visit_session_materials` /
 * `visit_session_comments`. No new instrumentation is introduced by this
 * module.
 *
 * Day/hour bucketing is done in PHP against the caller's organization
 * timezone (via App\Infrastructure\Support\OrgDateRange) — never
 * `CONVERT_TZ()` / SQL `DATE()` / `HOUR()` — because `CONVERT_TZ()` is
 * unavailable on Hostinger (see DbMetricsRepository::boundTrendDateRange()
 * docblock).
 */
interface RepMetricsRepositoryInterface
{
    /**
     * Headline counters for the rep's own visit sessions.
     *
     * @param array{start_date?: string, end_date?: string} $filters Org-local
     *   calendar-date bounds (inclusive), applied to `visit_sessions.created_at`.
     * @return array{
     *     sessions_total: int,
     *     sessions_viewed: int,
     *     open_rate: float,
     *     doctors_never_opened: int,
     *     first_open_median_hours: ?float,
     *     materials_opened: int,
     *     materials_unopened: int
     * }
     */
    public function summary(int $repId, array $filters, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Daily trend: of the sessions CREATED on each org-local day, how many
     * were EVER opened by a doctor (irrespective of which day the open
     * itself happened) — two independent counts, NEVER meant to be
     * stacked, see spec "Chart Data Correctness". Both counts are bucketed
     * by `visit_sessions.created_at` (the SAME population/definition
     * `summary()` uses for its `sessions_total`/`sessions_viewed` over the
     * identical [start_date, end_date] window), which is what guarantees
     * sum(sessions_created) === summary().sessions_total and
     * sum(sessions_viewed) === summary().sessions_viewed for that range —
     * required by spec "Chart Data Correctness" ("Total en tooltip MUST
     * igualar tarjetas/listas del mismo rango").
     *
     * Deliberately NOT "sessions with an open event that day" (bucketing by
     * `opened_at` instead of `created_at`): a session opened on 3 different
     * days would be counted 3 times in that alternative, so its daily sum
     * would overshoot the actual distinct "sessions viewed" total whenever
     * any doctor revisits — verified against seeded data during sdd-verify
     * and corrected (see verify-report).
     *
     * Every org-local calendar day in the effective [start_date, end_date]
     * window is present (0-filled), never omitted, per spec "Empty
     * States"/"Chart Data Correctness". Capped at
     * MetricsTrendConfig::MAX_TREND_DAYS distinct days, mirroring
     * DbMetricsRepository::boundTrendDateRange().
     *
     * @param array{start_date?: string, end_date?: string} $filters
     * @return array<int, array{date: string, sessions_created: int, sessions_viewed: int}>
     *   Ordered by date ASC.
     */
    public function openTrend(int $repId, array $filters, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Hour-of-day histogram (org-local hour, 0-23) of doctor material
     * opens. All 24 hours are always present (0-filled) — see spec "Chart
     * Data Correctness".
     *
     * @param array{start_date?: string, end_date?: string} $filters
     * @return array<int, array{hour: int, opens: int}> Exactly 24 entries,
     *   ordered by hour ASC.
     */
    public function hourHistogram(int $repId, array $filters, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Device split of doctor material opens, classified server-side via
     * App\Infrastructure\Support\DeviceClassifier. The raw `user_agent`
     * value is NEVER read into the returned array — see spec "Doctor
     * Privacy".
     *
     * @param array{start_date?: string, end_date?: string} $filters
     * @return array{mobile: int, desktop: int}
     */
    public function deviceSplit(int $repId, array $filters, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Paginated "materials the rep has included in their sessions", most
     * doctor-opened first. Materials with 0 opens in scope still appear
     * (LEFT JOIN semantics), mirroring
     * DbMetricsRepository::getTopMaterialsList()'s "0-view rows survive"
     * pattern.
     *
     * @param array{q?: string, start_date?: string, end_date?: string} $filters
     * @return array{items: array<int, array{id: int, title: string, type: string, opens: int, distinct_sessions: int}>, total: int, page: int, per_page: int, last_page: int}
     */
    public function topMaterials(int $repId, array $filters, int $page, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Paginated list of the rep's own visit sessions with view/comment
     * metrics attached, most recent first. Pages at
     * MetricsPaginationConfig::PAGE_SIZE (10) — this is the dedicated
     * metrics-dashboard page size, not the generic
     * PaginationConfig::PAGE_SIZE (20) used elsewhere; it backs the
     * "never opened" follow-up table on `/rep/metrics`.
     * `$filters['session_id']` /
     * `$filters['material_id']` (if supplied) can ONLY narrow the result —
     * a session_id belonging to another rep silently yields an empty page,
     * never another rep's data (spec "Rep Data Isolation" scenario
     * "Manipulación de query param").
     *
     * @param array{
     *     q?: string,
     *     status?: 'all'|'viewed'|'never',
     *     session_id?: int,
     *     material_id?: int,
     *     start_date?: string,
     *     end_date?: string
     * } $filters
     * @return array{items: array<int, array{
     *     id: int,
     *     doctor_name: ?string,
     *     created_at: string,
     *     viewed: bool,
     *     open_count: int,
     *     first_open_at: ?string,
     *     last_open_at: ?string,
     *     revisit_days: int,
     *     comment_count: int
     * }>, total: int, page: int, per_page: int, last_page: int}
     */
    public function sessions(int $repId, array $filters, int $page, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Paginated per-(session, material) breakdown of `summary()`'s
     * `materials_unopened` counter — every (session, material) pair the
     * rep sent that a doctor has NEVER opened. Uses the EXACT SAME base
     * predicate as summary()'s Query C (`vs.rep_id = :rep` + the date
     * range applied to `vs.created_at`, the session's own creation date —
     * NOT `visit_session_materials.created_at`), so
     * `unopenedMaterials($repId, $filters, ...)['total']` MUST equal
     * `summary($repId, $filters)['materials_unopened']` for the identical
     * filters (spec "Materiales sin abrir cuadra con la tarjeta" — the
     * card and this table are two views of the same underlying count,
     * never allowed to disagree).
     *
     * Deliberately a NEW endpoint rather than an extension of sessions():
     * a single visit_sessions row cannot represent "this session had 2
     * materials opened and 1 not" — the useful grain here is the
     * (session, material) PAIR, not the session. This is ALSO why this is
     * NOT a subset of sessions(?status=never) ("médicos que nunca
     * abrieron" — session-level: did the doctor open ANYTHING in the
     * session, ever): most rows returned here belong to sessions where the
     * doctor DID open some other material — see design "Materiales sin
     * abrir vs. médicos que nunca abrieron" for the verified 22-of-23
     * overlap ratio. These are two different, mostly-disjoint questions
     * and must stay two separate lists.
     *
     * Pages at MetricsPaginationConfig::PAGE_SIZE (10), same convention as
     * sessions() — NOT the generic PaginationConfig::PAGE_SIZE (20).
     *
     * @param array{start_date?: string, end_date?: string} $filters
     * @return array{items: array<int, array{
     *     session_id: int,
     *     doctor_name: ?string,
     *     material_id: int,
     *     material_title: string,
     *     material_type: string,
     *     sent_at: string,
     *     days_elapsed: int
     * }>, total: int, page: int, per_page: int, last_page: int}
     */
    public function unopenedMaterials(int $repId, array $filters, int $page, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;
}
