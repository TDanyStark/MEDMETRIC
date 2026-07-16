<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\StudyView;

use App\Domain\StudyView\StudyViewRepositoryInterface;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Config\PaginationConfig;
use PDO;

class DbStudyViewRepository implements StudyViewRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    public function createView(array $data): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO study_views 
             (study_id, visit_session_id, viewer_type, viewer_id, user_agent, ip_address, opened_at) 
             VALUES 
             (:study_id, :visit_session_id, :viewer_type, :viewer_id, :user_agent, :ip_address, NOW())'
        );

        $stmt->execute([
            ':study_id'         => $data['study_id'],
            ':visit_session_id' => $data['visit_session_id'] ?? null,
            ':viewer_type'      => $data['viewer_type'], // 'rep' or 'doctor'
            ':viewer_id'        => $data['viewer_id'] ?? null,
            ':user_agent'       => $data['user_agent'] ?? null,
            ':ip_address'       => $data['ip_address'] ?? null,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, study_id, visit_session_id, viewer_type, viewer_id, 
                    opened_at, user_agent, ip_address
             FROM study_views
             WHERE id = :id
             LIMIT 1'
        );

        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    public function isStudyInSession(int $studyId, int $sessionId): bool
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) 
             FROM visit_session_materials vsm
             JOIN material_studies ms ON ms.material_id = vsm.material_id
             WHERE vsm.visit_session_id = :session_id AND ms.id = :study_id'
        );

        $stmt->execute([
            ':session_id' => $sessionId,
            ':study_id'   => $studyId,
        ]);

        return (int) $stmt->fetchColumn() > 0;
    }

    public function findByStudy(int $studyId, ?string $viewerType = null, int $page = 1): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        $where  = ['study_id = :study_id'];
        $params = [':study_id' => $studyId];

        if ($viewerType !== null && $viewerType !== '') {
            $where[] = 'viewer_type = :viewer_type';
            $params[':viewer_type'] = $viewerType;
        }

        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $countStmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM study_views' . $whereSql
        );
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = 'SELECT id, study_id, visit_session_id, viewer_type, viewer_id, 
                        opened_at, user_agent, ip_address
                FROM study_views
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

    public function countByStudyIds(array $studyIds): array
    {
        if (empty($studyIds)) {
            return [];
        }

        $placeholders = [];
        $params       = [];
        foreach (array_values($studyIds) as $index => $studyId) {
            $key            = ":study_id_{$index}";
            $placeholders[] = $key;
            $params[$key]   = $studyId;
        }

        $sql = 'SELECT study_id, COUNT(*) AS view_count
                FROM   study_views
                WHERE  study_id IN (' . implode(', ', $placeholders) . ')
                GROUP  BY study_id';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $counts = [];
        foreach ($rows as $row) {
            $counts[(int) $row['study_id']] = (int) $row['view_count'];
        }

        return $counts;
    }
}
