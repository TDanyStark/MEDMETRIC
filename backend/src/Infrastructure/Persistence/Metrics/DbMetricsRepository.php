<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Metrics;

use App\Domain\Metrics\MetricsRepositoryInterface;
use App\Infrastructure\Config\MetricsTrendConfig;
use App\Infrastructure\Config\TimezoneConfig;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Support\OrgDateRange;
use App\Infrastructure\Support\RepAttribution;
use App\Infrastructure\Support\TrendBucketCap;
use PDO;

class DbMetricsRepository implements MetricsRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    /**
     * Normalize a filter value into a list of positive integers.
     * Accepts an array of ids or a single scalar id.
     *
     * @return int[]
     */
    private function intIds($value): array
    {
        if ($value === null || $value === '') {
            return [];
        }
        $list = is_array($value) ? $value : [$value];
        $ids = [];
        foreach ($list as $item) {
            $id = (int) $item;
            if ($id > 0) {
                $ids[] = $id;
            }
        }
        return array_values(array_unique($ids));
    }

    /**
     * Build a parameterized "IN (...)" clause with uniquely named placeholders.
     * Returns the SQL fragment (e.g. "(:mat0, :mat1)") and fills $params by ref.
     * Required because native prepared statements forbid reusing placeholders.
     */
    private function buildInClause(array $ids, string $prefix, array &$params): string
    {
        $placeholders = [];
        foreach (array_values($ids) as $index => $id) {
            $key = ':' . $prefix . $index;
            $placeholders[] = $key;
            $params[$key] = $id;
        }
        return '(' . implode(', ', $placeholders) . ')';
    }

    /**
     * Build 0-2 half-open UTC range SQL fragments for an org-local
     * start_date/end_date calendar filter pair:
     *   ["$column >= :from_utc{$suffix}", "$column < :to_utc_exclusive{$suffix}"]
     * and fill $params by reference with the converted UTC bounds
     * (via OrgDateRange::boundsForLocalDates()).
     *
     * Used both to append to a WHERE-array (independent AND-ed predicates)
     * and to append to a JOIN...ON condition string (see
     * getTopMaterialsMetrics/getTopMaterialsList/getRepAdoptionMetrics,
     * where the date filter MUST stay in the ON clause — not WHERE — so
     * rows with 0 matching child rows still survive the LEFT JOIN).
     *
     * $suffix disambiguates placeholder names when a single query needs
     * more than one independent date-range fragment set (not currently the
     * case, but keeps this helper safe to reuse that way in the future).
     *
     * @return string[] 0, 1 or 2 SQL fragments
     */
    private function dateRangeFragments(array $filters, string $column, string $timezone, array &$params, string $suffix = ''): array
    {
        $fromLocal = !empty($filters['start_date']) ? $filters['start_date'] : null;
        $toLocal   = !empty($filters['end_date']) ? $filters['end_date'] : null;

        [$fromUtc, $toUtcExclusive] = OrgDateRange::boundsForLocalDates($fromLocal, $toLocal, $timezone);

        $fragments = [];

        if ($fromUtc !== null) {
            $key = ':from_utc' . $suffix;
            $fragments[] = "{$column} >= {$key}";
            $params[$key] = $fromUtc;
        }

        if ($toUtcExclusive !== null) {
            $key = ':to_utc_exclusive' . $suffix;
            $fragments[] = "{$column} < {$key}";
            $params[$key] = $toUtcExclusive;
        }

        return $fragments;
    }

    /**
     * Bucket raw (opened_at, viewer_type, session_key) rows into
     * [{date, viewer_type, views, sessions}, ...] grouped by ORG-LOCAL
     * calendar day (not UTC day — see OrgDateRange::localDateBucket()),
     * ordered by date DESC, capped at MetricsTrendConfig::MAX_TREND_DAYS
     * most-recent DISTINCT calendar dates (see TrendBucketCap — NOT capped
     * by raw bucket count: a single day can produce up to 2 buckets, one
     * per viewer_type ('rep'/'doctor'), so slicing the first N buckets
     * instead of the first N DISTINCT dates used to silently drop up to
     * half of the intended day window whenever both series had activity
     * on the same days).
     *
     * Distinct session counting MUST happen per-bucket in PHP (not via a
     * pre-aggregated-by-hour SQL step) because a session's views could
     * otherwise be double counted across day buckets if aggregated at a
     * coarser SQL grain first.
     *
     * @param array<int, array{opened_at: string, viewer_type: string, session_key: int|string}> $rows
     * @return array<int, array{date: string, viewer_type: string, views: int, sessions: int}>
     */
    private function bucketByLocalDay(array $rows, string $timezone): array
    {
        $buckets = [];

        foreach ($rows as $row) {
            $localDate = OrgDateRange::localDateBucket((string) $row['opened_at'], $timezone);
            $viewerType = (string) $row['viewer_type'];
            $bucketKey = $localDate . '|' . $viewerType;

            if (!isset($buckets[$bucketKey])) {
                $buckets[$bucketKey] = [
                    'date' => $localDate,
                    'viewer_type' => $viewerType,
                    'views' => 0,
                    'sessions' => [],
                ];
            }

            $buckets[$bucketKey]['views']++;
            $buckets[$bucketKey]['sessions'][$row['session_key']] = true;
        }

        $result = [];
        foreach ($buckets as $bucket) {
            $result[] = [
                'date' => $bucket['date'],
                'viewer_type' => $bucket['viewer_type'],
                'views' => $bucket['views'],
                'sessions' => count($bucket['sessions']),
            ];
        }

        usort($result, static fn(array $a, array $b) => strcmp($b['date'], $a['date']));

        return TrendBucketCap::capToMostRecentDays($result, MetricsTrendConfig::MAX_TREND_DAYS);
    }

    /**
     * Bound the effective [start_date, end_date] org-local filter window
     * to at most MetricsTrendConfig::MAX_TREND_DAYS calendar days. Shared
     * by getMaterialViewsMetrics() and getStudyViewsMetrics() (both feed
     * bucketByLocalDay() and must never fetch more raw rows than a trend
     * chart can ever display) — see OrgDateRange::capRangeToMaxDays() for
     * the exact truncation rules.
     *
     * This MUST run unconditionally, not only when start_date/end_date are
     * both empty: the frontend date-picker has no upper bound on the
     * requested span, so an explicit wide (or one-sided) range would
     * otherwise fetch an org's entire unbounded view history into PHP for
     * org-local bucketing (CONVERT_TZ is unavailable on Hostinger, so this
     * bounding can't be pushed back down into a SQL-level LIMIT either —
     * see bucketByLocalDay() / OrgDateRange class docblocks).
     *
     * Truncation is SILENT (no 4xx) and always preserves the caller's
     * requested end_date, pulling start_date forward instead. NOTE: this
     * repository's trend methods return a flat bucket array (no metadata
     * envelope), so there is currently nowhere to surface a
     * "was_truncated" flag back to the caller — if/when these endpoints
     * grow a metadata wrapper, thread that flag through from here.
     *
     * @param array<string, mixed> $filters
     * @return array<string, mixed> $filters with start_date/end_date bounded
     */
    private function boundTrendDateRange(array $filters, string $timezone): array
    {
        [$filters['start_date'], $filters['end_date']] = OrgDateRange::capRangeToMaxDays(
            !empty($filters['start_date']) ? $filters['start_date'] : null,
            !empty($filters['end_date']) ? $filters['end_date'] : null,
            MetricsTrendConfig::MAX_TREND_DAYS,
            $timezone
        );

        return $filters;
    }

    public function getMaterialViewsMetrics(int $organizationId, ?int $managerId, array $filters = [], string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $where = ['m.organization_id = :org_id'];
        $params = [':org_id' => $organizationId];

        if ($managerId !== null) {
            $where[] = 'm.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
        }

        $materialIds = $this->intIds($filters['material_ids'] ?? null);
        if (!empty($materialIds)) {
            $where[] = 'm.id IN ' . $this->buildInClause($materialIds, 'mat', $params);
        }

        // Attribute each view to a rep via RepAttribution::condition() (rep's
        // own viewer_id for viewer_type='rep', otherwise the owning visit
        // session's rep_id for viewer_type='doctor') — see that class'
        // docblock for why a plain "viewer_type = 'rep' AND viewer_id IN
        // (...)" predicate is wrong (it drops every doctor view). No
        // visit_sessions JOIN needed here: a correlated subquery resolves
        // the session's rep_id inline.
        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $where[] = RepAttribution::condition(
                $repIds,
                'mv.viewer_id',
                '(SELECT rep_id FROM visit_sessions WHERE id = mv.visit_session_id)',
                $params
            );
        }

        // Bound the row fetch at the DB level — see boundTrendDateRange()
        // docblock for why this must apply unconditionally.
        $filters = $this->boundTrendDateRange($filters, $timezone);

        foreach ($this->dateRangeFragments($filters, 'mv.opened_at', $timezone, $params) as $fragment) {
            $where[] = $fragment;
        }

        $whereSql = implode(' AND ', $where);

        // Day bucketing MUST happen org-local, not UTC (see bucketByLocalDay()
        // docblock), so we fetch raw rows here and group in PHP instead of
        // `GROUP BY DATE(mv.opened_at)`. IFNULL(mv.visit_session_id, mv.id)
        // preserves the original "sessions" distinct-count semantics
        // (fallback to the view's own id when it has no session).
        $sql = "SELECT
                    mv.opened_at,
                    mv.viewer_type,
                    IFNULL(mv.visit_session_id, mv.id) as session_key
                FROM material_views mv
                JOIN materials m ON m.id = mv.material_id
                WHERE {$whereSql}
                ORDER BY mv.opened_at DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return $this->bucketByLocalDay($rows, $timezone);
    }

    public function getRepLastLoginMetrics(int $organizationId, ?int $managerId, array $filters = []): array
    {
        $where = ['u.organization_id = :org_id'];
        $params = [':org_id' => $organizationId];

        $joinSql = "JOIN roles r ON r.id = u.role_id AND r.name = 'rep'";

        if ($managerId !== null) {
            $joinSql .= " JOIN rep_manager_access rma ON rma.rep_id = u.id AND rma.active = 1";
            $where[] = 'rma.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
        }

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT 
                    u.id,
                    u.name,
                    u.email,
                    u.last_login_at
                FROM users u
                {$joinSql}
                WHERE {$whereSql}
                ORDER BY u.last_login_at DESC, u.name ASC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getTopMaterialsMetrics(int $organizationId, ?int $managerId, array $filters = [], int $limit = 10, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $where = ['m.organization_id = :org_id'];
        $params = [':org_id' => $organizationId];

        if ($managerId !== null) {
            $where[] = 'm.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
        }

        $materialIds = $this->intIds($filters['material_ids'] ?? null);
        if (!empty($materialIds)) {
            $where[] = 'm.id IN ' . $this->buildInClause($materialIds, 'mat', $params);
        }

        if (!empty($filters['q'])) {
            $where[] = 'm.title LIKE :q';
            $params[':q'] = '%' . $filters['q'] . '%';
        }

        // Date and rep filters are applied to the JOIN ON clause so that materials
        // with 0 views in the selected scope still appear in the result set.
        $viewsJoinCondition = "mv.material_id = m.id";
        foreach ($this->dateRangeFragments($filters, 'mv.opened_at', $timezone, $params) as $fragment) {
            $viewsJoinCondition .= " AND {$fragment}";
        }
        // See RepAttribution docblock: viewer_id-only matching drops doctor
        // views. The condition stays inside the JOIN...ON (not WHERE) so
        // materials with 0 views in the selected scope still appear —
        // correlated subquery because visit_sessions can't be JOINed ahead
        // of material_views in this FROM sequence.
        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $viewsJoinCondition .= ' AND ' . RepAttribution::condition(
                $repIds,
                'mv.viewer_id',
                '(SELECT rep_id FROM visit_sessions WHERE id = mv.visit_session_id)',
                $params
            );
        }

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT 
                    m.id,
                    m.title,
                    m.type,
                    COUNT(mv.id) as total_views,
                    SUM(CASE WHEN mv.viewer_type = 'rep' THEN 1 ELSE 0 END) as rep_views,
                    SUM(CASE WHEN mv.viewer_type = 'doctor' THEN 1 ELSE 0 END) as doctor_views,
                    COUNT(DISTINCT CASE WHEN mv.viewer_type = 'rep' THEN mv.viewer_id END) as unique_reps
                FROM materials m
                LEFT JOIN material_views mv ON {$viewsJoinCondition}
                WHERE {$whereSql}
                GROUP BY m.id, m.title, m.type
                ORDER BY total_views DESC
                LIMIT " . (int)$limit;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Paginated sibling of getTopMaterialsMetrics(), exclusive to the
     * "Detalle de materiales" table. Reuses the exact same WHERE/JOIN/GROUP BY
     * aggregation; only adds a COUNT(*) over the grouped subquery plus
     * LIMIT/OFFSET on the same ORDER BY (total_views DESC).
     */
    public function getTopMaterialsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $where = ['m.organization_id = :org_id'];
        $params = [':org_id' => $organizationId];

        if ($managerId !== null) {
            $where[] = 'm.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
        }

        $materialIds = $this->intIds($filters['material_ids'] ?? null);
        if (!empty($materialIds)) {
            $where[] = 'm.id IN ' . $this->buildInClause($materialIds, 'mat', $params);
        }

        if (!empty($filters['q'])) {
            $where[] = 'm.title LIKE :q';
            $params[':q'] = '%' . $filters['q'] . '%';
        }

        // Date and rep filters are applied to the JOIN ON clause so that materials
        // with 0 views in the selected scope still appear in the result set.
        $viewsJoinCondition = "mv.material_id = m.id";
        foreach ($this->dateRangeFragments($filters, 'mv.opened_at', $timezone, $params) as $fragment) {
            $viewsJoinCondition .= " AND {$fragment}";
        }
        // See RepAttribution docblock: viewer_id-only matching drops doctor
        // views. The condition stays inside the JOIN...ON (not WHERE) so
        // materials with 0 views in the selected scope still appear —
        // correlated subquery because visit_sessions can't be JOINed ahead
        // of material_views in this FROM sequence.
        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $viewsJoinCondition .= ' AND ' . RepAttribution::condition(
                $repIds,
                'mv.viewer_id',
                '(SELECT rep_id FROM visit_sessions WHERE id = mv.visit_session_id)',
                $params
            );
        }

        $whereSql = implode(' AND ', $where);

        $groupedSql = "SELECT 
                    m.id,
                    m.title,
                    m.type,
                    COUNT(mv.id) as total_views,
                    SUM(CASE WHEN mv.viewer_type = 'rep' THEN 1 ELSE 0 END) as rep_views,
                    SUM(CASE WHEN mv.viewer_type = 'doctor' THEN 1 ELSE 0 END) as doctor_views,
                    COUNT(DISTINCT CASE WHEN mv.viewer_type = 'rep' THEN mv.viewer_id END) as unique_reps
                FROM materials m
                LEFT JOIN material_views mv ON {$viewsJoinCondition}
                WHERE {$whereSql}
                GROUP BY m.id, m.title, m.type";

        $countSql = "SELECT COUNT(*) FROM ({$groupedSql}) as t";

        $countStmt = $this->pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $pageSize = \App\Infrastructure\Config\MetricsPaginationConfig::PAGE_SIZE;
        $offset = ($page - 1) * $pageSize;

        $sql = "{$groupedSql}
                ORDER BY total_views DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'items' => $items,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $pageSize,
                'last_page' => (int) ceil($total / $pageSize)
            ]
        ];
    }

    public function getMaterialViewsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $where = ['m.organization_id = :org_id'];
        $params = [':org_id' => $organizationId];

        if ($managerId !== null) {
            $where[] = 'm.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
        }
        
        $materialIds = $this->intIds($filters['material_ids'] ?? null);
        if (!empty($materialIds)) {
            $where[] = 'm.id IN ' . $this->buildInClause($materialIds, 'mat', $params);
        }
        
        foreach ($this->dateRangeFragments($filters, 'mv.opened_at', $timezone, $params) as $fragment) {
            $where[] = $fragment;
        }

        // Resolve the rep behind each view: direct rep view (mv.viewer_id) takes
        // precedence, otherwise the rep that owns the visit session (vs.rep_id).
        $repJoin = "LEFT JOIN users rep ON rep.id = COALESCE(mv.viewer_id, vs.rep_id)";

        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            // vs is already LEFT JOINed above (repJoin needs it too), so
            // pass its column directly — see RepAttribution docblock.
            $where[] = RepAttribution::condition($repIds, 'mv.viewer_id', 'vs.rep_id', $params);
        }

        $whereSql = implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) FROM material_views mv
                     JOIN materials m ON m.id = mv.material_id
                     LEFT JOIN visit_sessions vs ON vs.id = mv.visit_session_id
                     {$repJoin}
                     WHERE {$whereSql}";
        
        $countStmt = $this->pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $pageSize = \App\Infrastructure\Config\MetricsPaginationConfig::PAGE_SIZE;
        $offset = ($page - 1) * $pageSize;

        $sql = "SELECT 
                    mv.id,
                    m.id as material_id,
                    m.title as material_title,
                    m.type as material_type,
                    m.cover_path,
                    mv.viewer_type,
                    mv.opened_at,
                    vs.doctor_name,
                    rep.name as rep_name
                FROM material_views mv
                JOIN materials m ON m.id = mv.material_id
                LEFT JOIN visit_sessions vs ON vs.id = mv.visit_session_id
                {$repJoin}
                WHERE {$whereSql}
                ORDER BY mv.opened_at DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'items' => $items,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $pageSize,
                'last_page' => ceil($total / $pageSize)
            ]
        ];
    }

    public function getRepAdoptionMetrics(int $organizationId, ?int $managerId, array $filters = [], int $page = 1, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        // Build the universe of materials available to each rep (denominator for
        // adoption %). For a manager scope, that's the manager's materials; for
        // org_admin, it's all approved materials of the organization.
        $materialWhere = ['m.organization_id = :org_id', "m.status = 'approved'"];
        $materialParams = [':org_id' => $organizationId];
        if ($managerId !== null) {
            $materialWhere[] = 'm.manager_id = :manager_id';
            $materialParams[':manager_id'] = $managerId;
        }
        $materialWhereSql = implode(' AND ', $materialWhere);

        $availableStmt = $this->pdo->prepare(
            "SELECT COUNT(*) FROM materials m WHERE {$materialWhereSql}"
        );
        $availableStmt->execute($materialParams);
        $availableMaterials = (int)$availableStmt->fetchColumn();

        // Rep scope.
        $repWhere = ['u.organization_id = :org_id', "u.active = 1"];
        $repParams = [':org_id' => $organizationId];
        $repJoin = "JOIN roles r ON r.id = u.role_id AND r.name = 'rep'";
        if ($managerId !== null) {
            $repJoin .= " JOIN rep_manager_access rma ON rma.rep_id = u.id AND rma.active = 1";
            $repWhere[] = 'rma.manager_id = :manager_id';
            $repParams[':manager_id'] = $managerId;
        }

        // Views sub-scope, restricted to materials within the same scope and to
        // rep-type views. Date filters apply to the LEFT JOIN so reps with 0
        // views still appear.
        //
        // NOTE (checked against the RepAttribution class-drops-doctor-views
        // bug — see that class' docblock): this is intentionally NOT the
        // same predicate. "Rep adoption" measures each rep's OWN personal
        // material engagement (did THIS rep open the material), so it must
        // stay scoped to that rep's direct viewer_type='rep' views — mixing
        // in doctor views generated during that rep's sessions would change
        // what the metric means, not fix a bug. The `rep_ids` filter below
        // (repWhere) is also unrelated to this: it restricts which USERS
        // (rows) appear in the report, not which views get attributed to a
        // rep — so it isn't the "filter drops doctor views" bug either.
        $viewJoin = "mv.viewer_id = u.id AND mv.viewer_type = 'rep'";
        foreach ($this->dateRangeFragments($filters, 'mv.opened_at', $timezone, $repParams) as $fragment) {
            $viewJoin .= " AND {$fragment}";
        }

        // Use distinct placeholder names because native (non-emulated) prepared
        // statements do not allow reusing the same named parameter twice.
        $materialScopeJoin = "m2.id = mv.material_id AND m2.organization_id = :org_id_scope";
        $repParams[':org_id_scope'] = $organizationId;
        if ($managerId !== null) {
            $materialScopeJoin .= " AND m2.manager_id = :manager_id_scope";
            $repParams[':manager_id_scope'] = $managerId;
        }

        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $repWhere[] = 'u.id IN ' . $this->buildInClause($repIds, 'rep', $repParams);
        }

        $repWhereSql = implode(' AND ', $repWhere);

        $groupedSql = "SELECT 
                    u.id as rep_id,
                    u.name,
                    u.email,
                    u.last_login_at,
                    COUNT(mv.id) as total_views,
                    COUNT(DISTINCT mv.material_id) as distinct_materials,
                    MAX(mv.opened_at) as last_view_at
                FROM users u
                {$repJoin}
                LEFT JOIN material_views mv ON {$viewJoin}
                LEFT JOIN materials m2 ON {$materialScopeJoin}
                WHERE {$repWhereSql}
                  AND (mv.id IS NULL OR m2.id IS NOT NULL)
                GROUP BY u.id, u.name, u.email, u.last_login_at";

        $countSql = "SELECT COUNT(*) FROM ({$groupedSql}) as t";

        $countStmt = $this->pdo->prepare($countSql);
        $countStmt->execute($repParams);
        $total = (int)$countStmt->fetchColumn();

        $pageSize = \App\Infrastructure\Config\MetricsPaginationConfig::PAGE_SIZE;
        $offset = ($page - 1) * $pageSize;

        $sql = "{$groupedSql}
                ORDER BY total_views DESC, u.name ASC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($repParams as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Compute adoption percent = distinct materials viewed / available materials.
        foreach ($rows as &$row) {
            $distinct = (int)$row['distinct_materials'];
            $row['available_materials'] = $availableMaterials;
            $row['adoption_percent'] = $availableMaterials > 0
                ? (int)round(($distinct / $availableMaterials) * 100)
                : 0;
        }
        unset($row);

        return [
            'items' => $rows,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $pageSize,
                'last_page' => (int) ceil($total / $pageSize)
            ]
        ];
    }

    /**
     * Study views metrics — fully separate report, mirrors
     * getMaterialViewsMetrics' date/viewer_type breakdown shape but reads
     * study_views joined through material_studies -> materials (for
     * org/manager scoping, since material_studies has no organization_id of
     * its own). Never merged into getTopMaterialsMetrics/getRepAdoptionMetrics.
     */
    public function getStudyViewsMetrics(int $organizationId, ?int $managerId, array $filters = [], string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $where = ['m.organization_id = :org_id'];
        $params = [':org_id' => $organizationId];

        if ($managerId !== null) {
            $where[] = 'm.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
        }

        $materialIds = $this->intIds($filters['material_ids'] ?? null);
        if (!empty($materialIds)) {
            $where[] = 'm.id IN ' . $this->buildInClause($materialIds, 'mat', $params);
        }

        $studyIds = $this->intIds($filters['study_ids'] ?? null);
        if (!empty($studyIds)) {
            $where[] = 'ms.id IN ' . $this->buildInClause($studyIds, 'study', $params);
        }

        // See RepAttribution docblock (shared with getMaterialViewsMetrics())
        // for why viewer_id-only matching drops doctor views.
        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $where[] = RepAttribution::condition(
                $repIds,
                'sv.viewer_id',
                '(SELECT rep_id FROM visit_sessions WHERE id = sv.visit_session_id)',
                $params
            );
        }

        // Bound the row fetch at the DB level — see boundTrendDateRange()
        // docblock (shared with getMaterialViewsMetrics()) for the full
        // rationale.
        $filters = $this->boundTrendDateRange($filters, $timezone);

        foreach ($this->dateRangeFragments($filters, 'sv.opened_at', $timezone, $params) as $fragment) {
            $where[] = $fragment;
        }

        $whereSql = implode(' AND ', $where);

        // Day bucketing MUST happen org-local, not UTC (see bucketByLocalDay()
        // docblock), so we fetch raw rows here and group in PHP instead of
        // `GROUP BY DATE(sv.opened_at)`.
        $sql = "SELECT
                    sv.opened_at,
                    sv.viewer_type,
                    IFNULL(sv.visit_session_id, sv.id) as session_key
                FROM study_views sv
                JOIN material_studies ms ON ms.id = sv.study_id
                JOIN materials m ON m.id = ms.material_id
                WHERE {$whereSql}
                ORDER BY sv.opened_at DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return $this->bucketByLocalDay($rows, $timezone);
    }

    /**
     * Paginated detail list for study views ("Registro de Visualizaciones de
     * Estudios" table). Mirrors getMaterialViewsList's row-level pattern but
     * reads study_views joined through material_studies -> materials.
     */
    public function getStudyViewsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $where = ['m.organization_id = :org_id'];
        $params = [':org_id' => $organizationId];

        if ($managerId !== null) {
            $where[] = 'm.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
        }

        $materialIds = $this->intIds($filters['material_ids'] ?? null);
        if (!empty($materialIds)) {
            $where[] = 'm.id IN ' . $this->buildInClause($materialIds, 'mat', $params);
        }

        $studyIds = $this->intIds($filters['study_ids'] ?? null);
        if (!empty($studyIds)) {
            $where[] = 'ms.id IN ' . $this->buildInClause($studyIds, 'study', $params);
        }

        foreach ($this->dateRangeFragments($filters, 'sv.opened_at', $timezone, $params) as $fragment) {
            $where[] = $fragment;
        }

        // Resolve the rep behind each view: direct rep view (sv.viewer_id) takes
        // precedence, otherwise the rep that owns the visit session (vs.rep_id).
        $repJoin = "LEFT JOIN users rep ON rep.id = COALESCE(sv.viewer_id, vs.rep_id)";

        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            // vs is already LEFT JOINed above (repJoin needs it too), so
            // pass its column directly — see RepAttribution docblock.
            $where[] = RepAttribution::condition($repIds, 'sv.viewer_id', 'vs.rep_id', $params);
        }

        $whereSql = implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) FROM study_views sv
                     JOIN material_studies ms ON ms.id = sv.study_id
                     JOIN materials m ON m.id = ms.material_id
                     LEFT JOIN visit_sessions vs ON vs.id = sv.visit_session_id
                     {$repJoin}
                     WHERE {$whereSql}";

        $countStmt = $this->pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $pageSize = \App\Infrastructure\Config\MetricsPaginationConfig::PAGE_SIZE;
        $offset = ($page - 1) * $pageSize;

        $sql = "SELECT 
                    sv.id,
                    ms.id as study_id,
                    ms.title as study_title,
                    m.id as material_id,
                    m.title as material_title,
                    m.cover_path,
                    sv.viewer_type,
                    sv.opened_at,
                    vs.doctor_name,
                    rep.name as rep_name
                FROM study_views sv
                JOIN material_studies ms ON ms.id = sv.study_id
                JOIN materials m ON m.id = ms.material_id
                LEFT JOIN visit_sessions vs ON vs.id = sv.visit_session_id
                {$repJoin}
                WHERE {$whereSql}
                ORDER BY sv.opened_at DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'items' => $items,
            'meta' => [
                'total' => $total,
                'page' => $page,
                'per_page' => $pageSize,
                'last_page' => (int) ceil($total / $pageSize)
            ]
        ];
    }
}
