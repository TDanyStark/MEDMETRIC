<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Metrics;

use App\Domain\Metrics\MetricsRepositoryInterface;
use App\Infrastructure\Database\Connection;
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

    public function getMaterialViewsMetrics(int $organizationId, ?int $managerId, array $filters = []): array
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

        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $where[] = "mv.viewer_type = 'rep' AND mv.viewer_id IN " . $this->buildInClause($repIds, 'rep', $params);
        }

        if (!empty($filters['start_date'])) {
            $where[] = 'DATE(mv.opened_at) >= :start_date';
            $params[':start_date'] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $where[] = 'DATE(mv.opened_at) <= :end_date';
            $params[':end_date'] = $filters['end_date'];
        }

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT 
                    DATE(mv.opened_at) as date,
                    mv.viewer_type,
                    COUNT(mv.id) as views,
                    COUNT(DISTINCT IFNULL(mv.visit_session_id, mv.id)) as sessions
                FROM material_views mv
                JOIN materials m ON m.id = mv.material_id
                WHERE {$whereSql}
                GROUP BY DATE(mv.opened_at), mv.viewer_type
                ORDER BY date DESC
                LIMIT 90";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
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

    public function getTopMaterialsMetrics(int $organizationId, ?int $managerId, array $filters = [], int $limit = 10): array
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
        if (!empty($filters['start_date'])) {
            $viewsJoinCondition .= " AND DATE(mv.opened_at) >= :start_date";
            $params[':start_date'] = $filters['start_date'];
        }
        if (!empty($filters['end_date'])) {
            $viewsJoinCondition .= " AND DATE(mv.opened_at) <= :end_date";
            $params[':end_date'] = $filters['end_date'];
        }
        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $viewsJoinCondition .= " AND mv.viewer_type = 'rep' AND mv.viewer_id IN " . $this->buildInClause($repIds, 'rep', $params);
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
    public function getTopMaterialsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1): array
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
        if (!empty($filters['start_date'])) {
            $viewsJoinCondition .= " AND DATE(mv.opened_at) >= :start_date";
            $params[':start_date'] = $filters['start_date'];
        }
        if (!empty($filters['end_date'])) {
            $viewsJoinCondition .= " AND DATE(mv.opened_at) <= :end_date";
            $params[':end_date'] = $filters['end_date'];
        }
        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $viewsJoinCondition .= " AND mv.viewer_type = 'rep' AND mv.viewer_id IN " . $this->buildInClause($repIds, 'rep', $params);
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

    public function getMaterialViewsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1): array
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
        
        if (!empty($filters['start_date'])) {
            $where[] = 'DATE(mv.opened_at) >= :start_date';
            $params[':start_date'] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $where[] = 'DATE(mv.opened_at) <= :end_date';
            $params[':end_date'] = $filters['end_date'];
        }

        // Resolve the rep behind each view: direct rep view (mv.viewer_id) takes
        // precedence, otherwise the rep that owns the visit session (vs.rep_id).
        $repJoin = "LEFT JOIN users rep ON rep.id = COALESCE(mv.viewer_id, vs.rep_id)";

        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $where[] = 'COALESCE(mv.viewer_id, vs.rep_id) IN ' . $this->buildInClause($repIds, 'rep', $params);
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

    public function getRepAdoptionMetrics(int $organizationId, ?int $managerId, array $filters = [], int $page = 1): array
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
        $viewJoin = "mv.viewer_id = u.id AND mv.viewer_type = 'rep'";
        if (!empty($filters['start_date'])) {
            $viewJoin .= " AND DATE(mv.opened_at) >= :start_date";
            $repParams[':start_date'] = $filters['start_date'];
        }
        if (!empty($filters['end_date'])) {
            $viewJoin .= " AND DATE(mv.opened_at) <= :end_date";
            $repParams[':end_date'] = $filters['end_date'];
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
    public function getStudyViewsMetrics(int $organizationId, ?int $managerId, array $filters = []): array
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

        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $where[] = "sv.viewer_type = 'rep' AND sv.viewer_id IN " . $this->buildInClause($repIds, 'rep', $params);
        }

        if (!empty($filters['start_date'])) {
            $where[] = 'DATE(sv.opened_at) >= :start_date';
            $params[':start_date'] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $where[] = 'DATE(sv.opened_at) <= :end_date';
            $params[':end_date'] = $filters['end_date'];
        }

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT
                    DATE(sv.opened_at) as date,
                    sv.viewer_type,
                    COUNT(sv.id) as views,
                    COUNT(DISTINCT IFNULL(sv.visit_session_id, sv.id)) as sessions
                FROM study_views sv
                JOIN material_studies ms ON ms.id = sv.study_id
                JOIN materials m ON m.id = ms.material_id
                WHERE {$whereSql}
                GROUP BY DATE(sv.opened_at), sv.viewer_type
                ORDER BY date DESC
                LIMIT 90";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Paginated detail list for study views ("Registro de Visualizaciones de
     * Estudios" table). Mirrors getMaterialViewsList's row-level pattern but
     * reads study_views joined through material_studies -> materials.
     */
    public function getStudyViewsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1): array
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

        if (!empty($filters['start_date'])) {
            $where[] = 'DATE(sv.opened_at) >= :start_date';
            $params[':start_date'] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $where[] = 'DATE(sv.opened_at) <= :end_date';
            $params[':end_date'] = $filters['end_date'];
        }

        // Resolve the rep behind each view: direct rep view (sv.viewer_id) takes
        // precedence, otherwise the rep that owns the visit session (vs.rep_id).
        $repJoin = "LEFT JOIN users rep ON rep.id = COALESCE(sv.viewer_id, vs.rep_id)";

        $repIds = $this->intIds($filters['rep_ids'] ?? null);
        if (!empty($repIds)) {
            $where[] = 'COALESCE(sv.viewer_id, vs.rep_id) IN ' . $this->buildInClause($repIds, 'rep', $params);
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
