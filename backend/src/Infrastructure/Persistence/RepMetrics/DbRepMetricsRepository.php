<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\RepMetrics;

use App\Domain\RepMetrics\RepMetricsRepositoryInterface;
use App\Infrastructure\Config\MetricsPaginationConfig;
use App\Infrastructure\Config\MetricsTrendConfig;
use App\Infrastructure\Config\PaginationConfig;
use App\Infrastructure\Config\TimezoneConfig;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Support\DeviceClassifier;
use App\Infrastructure\Support\OrgDateRange;
use DateTimeImmutable;
use PDO;

/**
 * Every public method here takes `int $repId` as its non-nullable first
 * parameter and applies `vs.rep_id = :rep` (or an EXISTS against
 * visit_sessions carrying that predicate) as the query's non-negotiable
 * BASE clause — mirroring
 * App\Infrastructure\Persistence\VisitSessionComment\DbVisitSessionCommentRepository::buildScopeClause()'s
 * 'rep' branch. $filters are ANDed on top and can only narrow, never
 * widen (design "Scope enforcement" / spec "Rep Data Isolation").
 *
 * Every metric is filtered to `viewer_type = 'doctor'` rows only (spec
 * "Metrics Catalog Semantics") — rep's own preview opens never count.
 *
 * When $filters carries neither `start_date` nor `end_date`, every method
 * defaults to the last MetricsTrendConfig::DEFAULT_RANGE_DAYS org-local
 * calendar days (see dateRangeFragments()) — this is the server-side half
 * of the "unificación del rango por defecto a 3 meses" fix: a direct API
 * call with no date params must NEVER return an org's entire unbounded
 * history, even though the frontend always sends explicit dates in
 * practice.
 *
 * Day/hour bucketing always happens in PHP via
 * App\Infrastructure\Support\OrgDateRange (never SQL DATE()/HOUR()/
 * CONVERT_TZ — see that class' docblock for why CONVERT_TZ is unavailable
 * on Hostinger).
 */
class DbRepMetricsRepository implements RepMetricsRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    /**
     * {@inheritDoc}
     */
    public function summary(int $repId, array $filters, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $params = [':rep' => $repId];
        $where = ['vs.rep_id = :rep'];
        foreach ($this->dateRangeFragments($filters, 'vs.created_at', $timezone, $params) as $fragment) {
            $where[] = $fragment;
        }
        $whereSql = implode(' AND ', $where);

        // Query A — sessions_total + sessions_viewed in one row via an
        // EXISTS-per-row SUM (MySQL evaluates a boolean EXISTS as 0/1).
        $countsSql = "SELECT
                        COUNT(*) AS sessions_total,
                        SUM(EXISTS(
                            SELECT 1 FROM material_views mv
                            WHERE mv.visit_session_id = vs.id AND mv.viewer_type = 'doctor'
                        )) AS sessions_viewed
                      FROM visit_sessions vs
                      WHERE {$whereSql}";
        $countsStmt = $this->pdo->prepare($countsSql);
        $this->bindParams($countsStmt, $params);
        $countsStmt->execute();
        $countsRow = $countsStmt->fetch(PDO::FETCH_ASSOC) ?: ['sessions_total' => 0, 'sessions_viewed' => 0];
        $sessionsTotal = (int) $countsRow['sessions_total'];
        $sessionsViewed = (int) ($countsRow['sessions_viewed'] ?? 0);

        // Query B — per-session (created_at, first doctor open) pairs, used
        // only to compute the first-open latency median in PHP.
        $latencySql = "SELECT vs.created_at AS created_at, MIN(mv.opened_at) AS first_open
                        FROM visit_sessions vs
                        JOIN material_views mv ON mv.visit_session_id = vs.id AND mv.viewer_type = 'doctor'
                        WHERE {$whereSql}
                        GROUP BY vs.id, vs.created_at";
        $latencyStmt = $this->pdo->prepare($latencySql);
        $this->bindParams($latencyStmt, $params);
        $latencyStmt->execute();
        $firstOpenMedianHours = $this->medianLatencyHours($latencyStmt->fetchAll(PDO::FETCH_ASSOC));

        // Query C — materials the rep included in sessions vs. how many of
        // those (session, material) pairs got at least one doctor open.
        $materialsSql = "SELECT
                            COUNT(*) AS total_materials,
                            SUM(EXISTS(
                                SELECT 1 FROM material_views mv
                                WHERE mv.visit_session_id = vsm.visit_session_id
                                  AND mv.material_id = vsm.material_id
                                  AND mv.viewer_type = 'doctor'
                            )) AS materials_opened
                          FROM visit_session_materials vsm
                          JOIN visit_sessions vs ON vs.id = vsm.visit_session_id
                          WHERE {$whereSql}";
        $materialsStmt = $this->pdo->prepare($materialsSql);
        $this->bindParams($materialsStmt, $params);
        $materialsStmt->execute();
        $materialsRow = $materialsStmt->fetch(PDO::FETCH_ASSOC) ?: ['total_materials' => 0, 'materials_opened' => 0];
        $totalMaterials = (int) $materialsRow['total_materials'];
        $materialsOpened = (int) ($materialsRow['materials_opened'] ?? 0);

        return [
            'sessions_total' => $sessionsTotal,
            'sessions_viewed' => $sessionsViewed,
            'open_rate' => $sessionsTotal > 0 ? round($sessionsViewed / $sessionsTotal, 4) : 0.0,
            'doctors_never_opened' => $sessionsTotal - $sessionsViewed,
            'first_open_median_hours' => $firstOpenMedianHours,
            'materials_opened' => $materialsOpened,
            'materials_unopened' => $totalMaterials - $materialsOpened,
        ];
    }

    /**
     * {@inheritDoc}
     */
    public function openTrend(int $repId, array $filters, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        // Bound the row fetch at the DB level — mirrors
        // DbMetricsRepository::boundTrendDateRange() (this repository's own
        // copy: the source method is private to that class).
        [$startLocal, $endLocal] = OrgDateRange::capRangeToMaxDays(
            !empty($filters['start_date']) ? $filters['start_date'] : null,
            !empty($filters['end_date']) ? $filters['end_date'] : null,
            MetricsTrendConfig::MAX_TREND_DAYS,
            $timezone
        );
        $boundedFilters = ['start_date' => $startLocal, 'end_date' => $endLocal];

        // Sessions CREATED per org-local day, together with whether each
        // one was EVER opened by a doctor (unconditional of when that open
        // happened). Bucketing "viewed" by the session's `created_at` (not
        // by `mv.opened_at`) makes this the SAME population + SAME
        // "viewed" definition `summary()` uses for the identical date
        // range — the invariant that guarantees
        // sum(sessions_viewed) === summary().sessions_viewed (spec "Chart
        // Data Correctness"). Bucketing by open-day instead would let a
        // multi-day revisit inflate the daily sum past the true distinct
        // total (verified against seeded data — see verify-report).
        $createdParams = [':rep' => $repId];
        $createdWhere = ['vs.rep_id = :rep'];
        foreach ($this->dateRangeFragments($boundedFilters, 'vs.created_at', $timezone, $createdParams) as $fragment) {
            $createdWhere[] = $fragment;
        }
        $createdSql = "SELECT vs.created_at, EXISTS(
                            SELECT 1 FROM material_views mv
                            WHERE mv.visit_session_id = vs.id AND mv.viewer_type = 'doctor'
                        ) AS was_viewed
                        FROM visit_sessions vs
                        WHERE " . implode(' AND ', $createdWhere);
        $createdStmt = $this->pdo->prepare($createdSql);
        $this->bindParams($createdStmt, $createdParams);
        $createdStmt->execute();

        $createdByDay = [];
        $viewedByDay = [];
        foreach ($createdStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $day = OrgDateRange::localDateBucket((string) $row['created_at'], $timezone);
            $createdByDay[$day] = ($createdByDay[$day] ?? 0) + 1;
            if ((bool) $row['was_viewed']) {
                $viewedByDay[$day] = ($viewedByDay[$day] ?? 0) + 1;
            }
        }

        // 0-fill every org-local calendar day across [startLocal, endLocal]
        // — spec "Chart Data Correctness": empty days MUST be a 0 point,
        // never a gap.
        $result = [];
        $cursor = new DateTimeImmutable((string) $startLocal);
        $end = new DateTimeImmutable((string) $endLocal);
        while ($cursor <= $end) {
            $day = $cursor->format('Y-m-d');
            $result[] = [
                'date' => $day,
                'sessions_created' => $createdByDay[$day] ?? 0,
                'sessions_viewed' => $viewedByDay[$day] ?? 0,
            ];
            $cursor = $cursor->modify('+1 day');
        }

        return $result;
    }

    /**
     * {@inheritDoc}
     */
    public function hourHistogram(int $repId, array $filters, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $params = [':rep' => $repId];
        $where = ['vs.rep_id = :rep', "mv.viewer_type = 'doctor'"];
        foreach ($this->dateRangeFragments($filters, 'mv.opened_at', $timezone, $params) as $fragment) {
            $where[] = $fragment;
        }

        $sql = 'SELECT mv.opened_at
                FROM material_views mv
                JOIN visit_sessions vs ON vs.id = mv.visit_session_id
                WHERE ' . implode(' AND ', $where);
        $stmt = $this->pdo->prepare($sql);
        $this->bindParams($stmt, $params);
        $stmt->execute();

        $counts = array_fill(0, 24, 0);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $hour = OrgDateRange::localHourBucket((string) $row['opened_at'], $timezone);
            $counts[$hour]++;
        }

        $result = [];
        for ($hour = 0; $hour < 24; $hour++) {
            $result[] = ['hour' => $hour, 'opens' => $counts[$hour]];
        }

        return $result;
    }

    /**
     * {@inheritDoc}
     */
    public function deviceSplit(int $repId, array $filters, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $params = [':rep' => $repId];
        $where = ['vs.rep_id = :rep', "mv.viewer_type = 'doctor'"];
        foreach ($this->dateRangeFragments($filters, 'mv.opened_at', $timezone, $params) as $fragment) {
            $where[] = $fragment;
        }

        // mv.user_agent is read here ONLY to classify it below — it is
        // NEVER placed into the returned array (spec "Doctor Privacy").
        $sql = 'SELECT mv.user_agent
                FROM material_views mv
                JOIN visit_sessions vs ON vs.id = mv.visit_session_id
                WHERE ' . implode(' AND ', $where);
        $stmt = $this->pdo->prepare($sql);
        $this->bindParams($stmt, $params);
        $stmt->execute();

        $split = ['mobile' => 0, 'desktop' => 0];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $userAgent = $row['user_agent'] !== null ? (string) $row['user_agent'] : null;
            $split[DeviceClassifier::classify($userAgent)]++;
        }

        return $split;
    }

    /**
     * {@inheritDoc}
     */
    public function topMaterials(int $repId, array $filters, int $page, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $page = max(1, $page);
        $offset = ($page - 1) * $pageSize;

        $params = [':rep' => $repId];
        $where = ['vs.rep_id = :rep'];

        if (!empty($filters['q'])) {
            $where[] = 'm.title LIKE :q';
            $params[':q'] = '%' . $filters['q'] . '%';
        }

        // Date filter lives in the views JOIN...ON clause (not WHERE) so
        // materials with 0 opens in the selected range still appear —
        // mirrors DbMetricsRepository::getTopMaterialsList().
        $viewJoinCondition = "mv.material_id = m.id AND mv.visit_session_id = vsm.visit_session_id AND mv.viewer_type = 'doctor'";
        foreach ($this->dateRangeFragments($filters, 'mv.opened_at', $timezone, $params) as $fragment) {
            $viewJoinCondition .= " AND {$fragment}";
        }

        $whereSql = implode(' AND ', $where);

        $groupedSql = "SELECT
                            m.id,
                            m.title,
                            m.type,
                            COUNT(mv.id) AS opens,
                            COUNT(DISTINCT mv.visit_session_id) AS distinct_sessions
                        FROM visit_session_materials vsm
                        JOIN visit_sessions vs ON vs.id = vsm.visit_session_id
                        JOIN materials m ON m.id = vsm.material_id
                        LEFT JOIN material_views mv ON {$viewJoinCondition}
                        WHERE {$whereSql}
                        GROUP BY m.id, m.title, m.type";

        $countSql = "SELECT COUNT(*) FROM ({$groupedSql}) AS t";
        $countStmt = $this->pdo->prepare($countSql);
        $this->bindParams($countStmt, $params);
        $countStmt->execute();
        $total = (int) $countStmt->fetchColumn();

        $sql = "{$groupedSql}
                ORDER BY opens DESC, m.title ASC
                LIMIT :limit OFFSET :offset";
        $stmt = $this->pdo->prepare($sql);
        $this->bindParams($stmt, $params);
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = array_map(static fn(array $row) => [
            'id' => (int) $row['id'],
            'title' => (string) $row['title'],
            'type' => (string) $row['type'],
            'opens' => (int) $row['opens'],
            'distinct_sessions' => (int) $row['distinct_sessions'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $pageSize,
            'last_page' => (int) ceil($total / max(1, $pageSize)),
        ];
    }

    /**
     * {@inheritDoc}
     */
    public function sessions(int $repId, array $filters, int $page, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        // Uses MetricsPaginationConfig::PAGE_SIZE (10), NOT the generic
        // PaginationConfig::PAGE_SIZE (20) used by topMaterials() above:
        // this endpoint backs the "never opened" follow-up TABLE in the
        // rep metrics dashboard, which pages more tightly than regular CRUD
        // listings — same convention already established by the org_admin
        // MetricsDashboard's paginated tables (see DbMetricsRepository).
        $pageSize = MetricsPaginationConfig::PAGE_SIZE;
        $page = max(1, $page);
        $offset = ($page - 1) * $pageSize;

        $params = [':rep' => $repId];
        $where = ['vs.rep_id = :rep'];

        // $filters here can ONLY narrow the vs.rep_id = :rep base predicate
        // above — a session_id/material_id belonging to another rep simply
        // yields 0 rows, never that rep's data (spec "Rep Data Isolation").
        if (!empty($filters['session_id'])) {
            $where[] = 'vs.id = :session_id';
            $params[':session_id'] = (int) $filters['session_id'];
        }

        if (!empty($filters['material_id'])) {
            $where[] = 'EXISTS (
                SELECT 1 FROM visit_session_materials vsm
                WHERE vsm.visit_session_id = vs.id AND vsm.material_id = :material_id
            )';
            $params[':material_id'] = (int) $filters['material_id'];
        }

        if (!empty($filters['q'])) {
            $where[] = 'vs.doctor_name LIKE :q';
            $params[':q'] = '%' . $filters['q'] . '%';
        }

        foreach ($this->dateRangeFragments($filters, 'vs.created_at', $timezone, $params) as $fragment) {
            $where[] = $fragment;
        }

        $status = $filters['status'] ?? 'all';
        if ($status === 'viewed') {
            $where[] = "EXISTS (SELECT 1 FROM material_views mv WHERE mv.visit_session_id = vs.id AND mv.viewer_type = 'doctor')";
        } elseif ($status === 'never') {
            $where[] = "NOT EXISTS (SELECT 1 FROM material_views mv WHERE mv.visit_session_id = vs.id AND mv.viewer_type = 'doctor')";
        }

        $whereSql = implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) FROM visit_sessions vs WHERE {$whereSql}";
        $countStmt = $this->pdo->prepare($countSql);
        $this->bindParams($countStmt, $params);
        $countStmt->execute();
        $total = (int) $countStmt->fetchColumn();

        // Single batched LEFT JOIN aggregate for the whole page — zero
        // N+1, same pattern as the Phase-3 history badge fix
        // (DbVisitSessionRepository::findAllByRep-style "LEFT JOIN grouped
        // material_views"). comment_count is a correlated subquery, which
        // is still ONE round-trip query from PHP (not per-row app-level
        // queries) — same idiom already used by
        // DbVisitSessionCommentRepository's scope EXISTS clauses.
        $sql = "SELECT
                    vs.id,
                    vs.doctor_name,
                    vs.created_at,
                    dv.opens AS open_count,
                    dv.first_open AS first_open_at,
                    dv.last_open AS last_open_at,
                    (SELECT COUNT(*) FROM visit_session_comments c WHERE c.visit_session_id = vs.id) AS comment_count
                FROM visit_sessions vs
                LEFT JOIN (
                    SELECT visit_session_id, COUNT(*) AS opens, MIN(opened_at) AS first_open, MAX(opened_at) AS last_open
                    FROM material_views
                    WHERE viewer_type = 'doctor'
                    GROUP BY visit_session_id
                ) dv ON dv.visit_session_id = vs.id
                WHERE {$whereSql}
                ORDER BY vs.created_at DESC, vs.id DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        $this->bindParams($stmt, $params);
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Revisit-days needs org-local TZ bucketing, so it can't be folded
        // into the SQL aggregate above (see class docblock). Resolved with
        // ONE extra batched query over just this page's session ids —
        // never per-row (still no N+1).
        $sessionIds = array_map(static fn(array $row) => (int) $row['id'], $rows);
        $revisitDaysBySession = $this->revisitDaysForSessions($sessionIds, $timezone);

        $items = array_map(static function (array $row) use ($revisitDaysBySession) {
            $sessionId = (int) $row['id'];
            $openCount = (int) ($row['open_count'] ?? 0);

            return [
                'id' => $sessionId,
                'doctor_name' => $row['doctor_name'],
                'created_at' => $row['created_at'],
                'viewed' => $openCount > 0,
                'open_count' => $openCount,
                'first_open_at' => $row['first_open_at'],
                'last_open_at' => $row['last_open_at'],
                'revisit_days' => $revisitDaysBySession[$sessionId] ?? 0,
                'comment_count' => (int) $row['comment_count'],
            ];
        }, $rows);

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $pageSize,
            'last_page' => (int) ceil($total / max(1, $pageSize)),
        ];
    }

    /**
     * {@inheritDoc}
     */
    public function unopenedMaterials(int $repId, array $filters, int $page, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        // Same convention as sessions(): the metrics-dashboard page size
        // (10), not the generic PaginationConfig::PAGE_SIZE (20).
        $pageSize = MetricsPaginationConfig::PAGE_SIZE;
        $page = max(1, $page);
        $offset = ($page - 1) * $pageSize;

        // SAME base predicate as summary()'s Query C: vs.rep_id = :rep,
        // date range on vs.created_at (the SESSION's creation date, not
        // vsm.created_at) — this is what guarantees `total` here equals
        // summary()['materials_unopened'] for identical filters.
        $params = [':rep' => $repId];
        $where = ['vs.rep_id = :rep'];
        foreach ($this->dateRangeFragments($filters, 'vs.created_at', $timezone, $params) as $fragment) {
            $where[] = $fragment;
        }
        $where[] = "NOT EXISTS (
            SELECT 1 FROM material_views mv
            WHERE mv.visit_session_id = vsm.visit_session_id
              AND mv.material_id = vsm.material_id
              AND mv.viewer_type = 'doctor'
        )";
        $whereSql = implode(' AND ', $where);

        $fromSql = "FROM visit_session_materials vsm
                     JOIN visit_sessions vs ON vs.id = vsm.visit_session_id
                     JOIN materials m ON m.id = vsm.material_id
                     WHERE {$whereSql}";

        $countSql = "SELECT COUNT(*) {$fromSql}";
        $countStmt = $this->pdo->prepare($countSql);
        $this->bindParams($countStmt, $params);
        $countStmt->execute();
        $total = (int) $countStmt->fetchColumn();

        // Oldest-sent-first: the longer a material has sat unopened, the
        // more likely it's actionable (spec "Días transcurridos" column).
        $sql = "SELECT
                    vs.id AS session_id,
                    vs.doctor_name,
                    m.id AS material_id,
                    m.title AS material_title,
                    m.type AS material_type,
                    vsm.created_at AS sent_at,
                    DATEDIFF(NOW(), vsm.created_at) AS days_elapsed
                {$fromSql}
                ORDER BY vsm.created_at ASC, vsm.id ASC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        $this->bindParams($stmt, $params);
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = array_map(static fn(array $row) => [
            'session_id' => (int) $row['session_id'],
            'doctor_name' => $row['doctor_name'],
            'material_id' => (int) $row['material_id'],
            'material_title' => (string) $row['material_title'],
            'material_type' => (string) $row['material_type'],
            'sent_at' => $row['sent_at'],
            'days_elapsed' => (int) $row['days_elapsed'],
        ], $stmt->fetchAll(PDO::FETCH_ASSOC));

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $pageSize,
            'last_page' => (int) ceil($total / max(1, $pageSize)),
        ];
    }

    /**
     * Batched (single query, never per-row) revisit-day count: for each
     * session id, the number of DISTINCT org-local calendar days on which
     * a doctor opened >=1 material in that session (spec "Re-visita cuenta
     * días, no aperturas" — days, not raw open counts).
     *
     * @param int[] $sessionIds
     * @return array<int, int> visit_session_id => distinct day count
     */
    private function revisitDaysForSessions(array $sessionIds, string $timezone): array
    {
        if (empty($sessionIds)) {
            return [];
        }

        $params = [];
        $placeholders = [];
        foreach (array_values($sessionIds) as $index => $id) {
            $key = ':sid' . $index;
            $placeholders[] = $key;
            $params[$key] = $id;
        }

        $sql = 'SELECT visit_session_id, opened_at
                FROM material_views
                WHERE viewer_type = \'doctor\'
                  AND visit_session_id IN (' . implode(', ', $placeholders) . ')';

        $stmt = $this->pdo->prepare($sql);
        $this->bindParams($stmt, $params);
        $stmt->execute();

        $daysBySession = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $sessionId = (int) $row['visit_session_id'];
            $day = OrgDateRange::localDateBucket((string) $row['opened_at'], $timezone);
            $daysBySession[$sessionId][$day] = true;
        }

        $result = [];
        foreach ($daysBySession as $sessionId => $days) {
            $result[$sessionId] = count($days);
        }

        return $result;
    }

    /**
     * Median (in hours, 2 decimals) of first-open latency
     * (first doctor mv.opened_at - vs.created_at) across the given rows.
     * Sessions with no doctor open at all are already excluded by the
     * caller's INNER JOIN, so every row here has a non-null 'first_open'.
     *
     * @param array<int, array{created_at: string, first_open: ?string}> $rows
     */
    private function medianLatencyHours(array $rows): ?float
    {
        $hours = [];
        foreach ($rows as $row) {
            if (empty($row['first_open'])) {
                continue;
            }
            $created = new DateTimeImmutable((string) $row['created_at']);
            $firstOpen = new DateTimeImmutable((string) $row['first_open']);
            $diffSeconds = $firstOpen->getTimestamp() - $created->getTimestamp();
            $hours[] = max(0, $diffSeconds) / 3600;
        }

        if (empty($hours)) {
            return null;
        }

        sort($hours);
        $count = count($hours);
        $mid = intdiv($count, 2);

        $median = ($count % 2 === 0)
            ? (($hours[$mid - 1] + $hours[$mid]) / 2)
            : $hours[$mid];

        return round($median, 2);
    }

    /**
     * Build 0-2 half-open UTC range SQL fragments for an org-local
     * start_date/end_date calendar filter pair. Own copy of
     * DbMetricsRepository::dateRangeFragments()'s shape (that method is
     * private to that class) — both delegate the actual DST-safe
     * conversion math to the single shared
     * App\Infrastructure\Support\OrgDateRange::boundsForLocalDates().
     *
     * When the caller supplies NEITHER bound, this falls back to the last
     * MetricsTrendConfig::DEFAULT_RANGE_DAYS org-local calendar days
     * (sdd/rep-metrics-module, "unificación del rango por defecto a 3
     * meses") instead of leaving the query unbounded. This is the single
     * choke point every public method here routes through (summary,
     * hourHistogram, deviceSplit, topMaterials, sessions,
     * unopenedMaterials), so the default is applied identically
     * everywhere with zero per-widget duplication. openTrend() is the one
     * exception: it pre-bounds its OWN filters via
     * OrgDateRange::capRangeToMaxDays() before ever calling this method
     * (so it never hits the null branch below), but because that cap uses
     * the SAME DEFAULT_RANGE_DAYS constant, its default is identical to
     * every other endpoint's — see MetricsTrendConfig::DEFAULT_RANGE_DAYS
     * docblock for why default === cap is intentional here.
     *
     * Explicit filters are passed through UNCHANGED (no cap applied) — a
     * caller-supplied range, however wide, is honored as-is by every
     * method except openTrend(), which always re-bounds itself
     * regardless of what is passed in.
     *
     * @return string[] 0, 1 or 2 SQL fragments
     */
    private function dateRangeFragments(array $filters, string $column, string $timezone, array &$params, string $suffix = ''): array
    {
        $fromLocal = !empty($filters['start_date']) ? $filters['start_date'] : null;
        $toLocal   = !empty($filters['end_date']) ? $filters['end_date'] : null;

        if ($fromLocal === null && $toLocal === null) {
            [$fromLocal, $toLocal] = OrgDateRange::lastNLocalDays(MetricsTrendConfig::DEFAULT_RANGE_DAYS, $timezone);
        }

        [$fromUtc, $toUtcExclusive] = OrgDateRange::boundsForLocalDates($fromLocal, $toLocal, $timezone);

        $fragments = [];

        if ($fromUtc !== null) {
            $key = ':date_from' . $suffix;
            $fragments[] = "{$column} >= {$key}";
            $params[$key] = $fromUtc;
        }

        if ($toUtcExclusive !== null) {
            $key = ':date_to' . $suffix;
            $fragments[] = "{$column} < {$key}";
            $params[$key] = $toUtcExclusive;
        }

        return $fragments;
    }

    private function bindParams(\PDOStatement $stmt, array $params): void
    {
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
    }
}
