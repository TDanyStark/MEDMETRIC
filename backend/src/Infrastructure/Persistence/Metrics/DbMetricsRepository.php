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

        $whereSql = implode(' AND ', $where);

        $sql = "SELECT 
                    m.id,
                    m.title,
                    m.type,
                    COUNT(mv.id) as total_views,
                    SUM(CASE WHEN mv.viewer_type = 'rep' THEN 1 ELSE 0 END) as rep_views,
                    SUM(CASE WHEN mv.viewer_type = 'doctor' THEN 1 ELSE 0 END) as doctor_views
                FROM materials m
                LEFT JOIN material_views mv ON mv.material_id = m.id
                WHERE {$whereSql}
                GROUP BY m.id, m.title, m.type
                ORDER BY total_views DESC
                LIMIT " . (int)$limit;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
