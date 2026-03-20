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

    public function getMaterialViewsMetrics(int $organizationId, ?int $managerId, array $filters = []): array
    {
        $where = ['m.organization_id = :org_id'];
        $params = [':org_id' => $organizationId];

        if ($managerId !== null) {
            $where[] = 'm.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
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
                LIMIT 30";

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

        if (!empty($filters['material_id'])) {
            $where[] = 'm.id = :material_id';
            $params[':material_id'] = $filters['material_id'];
        }

        if (!empty($filters['q'])) {
            $where[] = 'm.title LIKE :q';
            $params[':q'] = '%' . $filters['q'] . '%';
        }

        // We apply date filters to the ON clause or WHERE clause for the material_views join
        // If we want materials with 0 views to show up if they match material_id, but the views are filtered by date, we need to handle that.
        // Actually, TopMaterials should probably only count views within the date range, but still show materials.
        // Let's modify the JOIN or create an additional views join condition.
        $viewsJoinCondition = "mv.material_id = m.id";
        if (!empty($filters['start_date'])) {
            $viewsJoinCondition .= " AND DATE(mv.opened_at) >= :start_date";
            $params[':start_date'] = $filters['start_date'];
        }
        if (!empty($filters['end_date'])) {
            $viewsJoinCondition .= " AND DATE(mv.opened_at) <= :end_date";
            $params[':end_date'] = $filters['end_date'];
        }

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT 
                    m.id,
                    m.title,
                    m.type,
                    COUNT(mv.id) as total_views,
                    SUM(CASE WHEN mv.viewer_type = 'rep' THEN 1 ELSE 0 END) as rep_views,
                    SUM(CASE WHEN mv.viewer_type = 'doctor' THEN 1 ELSE 0 END) as doctor_views
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

    public function getMaterialViewsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1): array
    {
        $where = ['m.organization_id = :org_id'];
        $params = [':org_id' => $organizationId];

        if ($managerId !== null) {
            $where[] = 'm.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
        }
        
        if (!empty($filters['material_id'])) {
            $where[] = 'm.id = :material_id';
            $params[':material_id'] = $filters['material_id'];
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

        $countSql = "SELECT COUNT(*) FROM material_views mv
                     JOIN materials m ON m.id = mv.material_id
                     LEFT JOIN visit_sessions vs ON vs.id = mv.visit_session_id
                     LEFT JOIN users rep ON rep.id = vs.rep_id OR rep.id = mv.viewer_id
                     WHERE {$whereSql}";
        
        $countStmt = $this->pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $pageSize = \App\Infrastructure\Config\PaginationConfig::PAGE_SIZE;
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
                LEFT JOIN users rep ON rep.id = vs.rep_id OR rep.id = mv.viewer_id
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
}
