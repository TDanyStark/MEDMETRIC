<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\MaterialView;

use App\Domain\MaterialView\MaterialViewRepositoryInterface;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Config\PaginationConfig;
use PDO;

class DbMaterialViewRepository implements MaterialViewRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    public function createView(array $data): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO material_views 
             (material_id, visit_session_id, viewer_type, viewer_id, user_agent, ip_address, opened_at) 
             VALUES 
             (:material_id, :visit_session_id, :viewer_type, :viewer_id, :user_agent, :ip_address, NOW())'
        );

        $stmt->execute([
            ':material_id'      => $data['material_id'],
            ':visit_session_id'  => $data['visit_session_id'] ?? null,
            ':viewer_type'       => $data['viewer_type'], // 'rep' or 'doctor'
            ':viewer_id'         => $data['viewer_id'] ?? null,
            ':user_agent'        => $data['user_agent'] ?? null,
            ':ip_address'        => $data['ip_address'] ?? null,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function recordEvent(int $viewId, int $materialId, string $eventType, ?string $eventValue = null): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO material_events 
             (material_view_id, material_id, event_type, event_value, occurred_at) 
             VALUES 
             (:material_view_id, :material_id, :event_type, :event_value, NOW())'
        );

        $stmt->execute([
            ':material_view_id' => $viewId,
            ':material_id'      => $materialId,
            ':event_type'       => $eventType,
            ':event_value'      => $eventValue,
        ]);
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, material_id, visit_session_id, viewer_type, viewer_id, 
                    opened_at, user_agent, ip_address
             FROM material_views
             WHERE id = :id
             LIMIT 1'
        );

        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    public function isMaterialInSession(int $materialId, int $sessionId): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) 
             FROM visit_session_materials
             WHERE visit_session_id = :session_id AND material_id = :material_id'
        );

        $stmt->execute([
            ':session_id'  => $sessionId,
            ':material_id' => $materialId,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    }

    public function findByMaterial(int $materialId, ?string $viewerType = null, int $page = 1): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        $where  = ['material_id = :material_id'];
        $params = [':material_id' => $materialId];

        if ($viewerType !== null && $viewerType !== '') {
            $where[] = 'viewer_type = :viewer_type';
            $params[':viewer_type'] = $viewerType;
        }

        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $countStmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM material_views' . $whereSql
        );
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = 'SELECT id, material_id, visit_session_id, viewer_type, viewer_id, 
                        opened_at, user_agent, ip_address
                FROM material_views
                ' . $whereSql . '
                ORDER BY opened_at DESC
                LIMIT :limit OFFSET :offset';

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit',  $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
        $stmt->execute();

        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return [
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $pageSize,
            'last_page' => (int) ceil($total / $pageSize),
        ];
    }

    public function getMaterialStats(int $materialId): array
    {
        // Total views by type
        $viewsStmt = $this->pdo->prepare(
            'SELECT viewer_type, COUNT(*) as count
             FROM material_views
             WHERE material_id = :material_id
             GROUP BY viewer_type'
        );
        $viewsStmt->execute([':material_id' => $materialId]);
        $viewsByType = $viewsStmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // Total events by type
        $eventsStmt = $this->pdo->prepare(
            'SELECT me.event_type, COUNT(*) as count
             FROM material_events me
             JOIN material_views mv ON me.material_view_id = mv.id
             WHERE mv.material_id = :material_id
             GROUP BY me.event_type'
        );
        $eventsStmt->execute([':material_id' => $materialId]);
        $eventsByType = $eventsStmt->fetchAll(PDO::FETCH_KEY_PAIR);

        return [
            'views_by_type'  => [
                'rep'    => (int) ($viewsByType['rep'] ?? 0),
                'doctor' => (int) ($viewsByType['doctor'] ?? 0),
            ],
            'total_views'    => array_sum($viewsByType),
            'events_by_type' => $eventsByType,
        ];
    }
}
