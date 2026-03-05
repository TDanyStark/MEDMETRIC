<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\RepAccess;

use App\Domain\RepAccess\RepAccess;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Config\PaginationConfig;
use PDO;

class DbRepAccessRepository implements RepAccessRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    public function findAllByManager(int $managerId, ?string $search = null, ?bool $active = null, int $page = 1): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        $where  = ['rma.manager_id = :manager_id'];
        $params = [':manager_id' => $managerId];

        if ($search !== null && $search !== '') {
            $where[]               = '(u.name LIKE :search_name OR u.email LIKE :search_email)';
            $params[':search_name'] = '%' . $search . '%';
            $params[':search_email'] = '%' . $search . '%';
        }

        if ($active !== null) {
            $where[]            = 'rma.active = :active';
            $params[':active'] = $active ? 1 : 0;
        }

        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $countStmt = $this->pdo->prepare(
            "SELECT COUNT(*) 
             FROM rep_manager_access rma
             JOIN users u ON rma.rep_id = u.id" . $whereSql
        );
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT rma.id, rma.rep_id, rma.manager_id, rma.active, rma.created_at, rma.updated_at,
                       u.name as rep_name, u.email as rep_email
                FROM rep_manager_access rma
                JOIN users u ON rma.rep_id = u.id
                {$whereSql}
                ORDER BY u.name ASC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit',  $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = array_map(fn(array $row) => RepAccess::fromRow($row), $rows);

        return [
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $pageSize,
            'last_page' => (int) ceil($total / $pageSize),
        ];
    }

    public function findByManagerAndRep(int $managerId, int $repId): ?RepAccess
    {
        $stmt = $this->pdo->prepare(
            "SELECT rma.id, rma.rep_id, rma.manager_id, rma.active, rma.created_at, rma.updated_at,
                    u.name as rep_name, u.email as rep_email
             FROM rep_manager_access rma
             JOIN users u ON rma.rep_id = u.id
             WHERE rma.manager_id = :manager_id AND rma.rep_id = :rep_id
             LIMIT 1"
        );

        $stmt->execute([':manager_id' => $managerId, ':rep_id' => $repId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return RepAccess::fromRow($row);
    }

    public function assign(int $managerId, int $repId): RepAccess
    {
        $existing = $this->findByManagerAndRep($managerId, $repId);
        
        if ($existing) {
            if (!$existing->isActive()) {
                return $this->toggleActive($managerId, $repId, true);
            }
            return $existing;
        }

        $stmt = $this->pdo->prepare(
            'INSERT INTO rep_manager_access (rep_id, manager_id, active) VALUES (:rep_id, :manager_id, 1)'
        );

        $stmt->execute([
            ':rep_id'     => $repId,
            ':manager_id' => $managerId,
        ]);

        $id = (int) $this->pdo->lastInsertId();

        $result = $this->findByManagerAndRep($managerId, $repId);
        
        if (!$result) {
            throw new \RuntimeException('Failed to create rep access');
        }

        return $result;
    }

    public function remove(int $managerId, int $repId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE rep_manager_access SET active = 0 WHERE manager_id = :manager_id AND rep_id = :rep_id'
        );

        $stmt->execute([
            ':manager_id' => $managerId,
            ':rep_id'     => $repId,
        ]);
    }

    public function toggleActive(int $managerId, int $repId, bool $active): RepAccess
    {
        $stmt = $this->pdo->prepare(
            'UPDATE rep_manager_access SET active = :active WHERE manager_id = :manager_id AND rep_id = :rep_id'
        );

        $stmt->execute([
            ':manager_id' => $managerId,
            ':rep_id'     => $repId,
            ':active'     => $active ? 1 : 0,
        ]);

        $result = $this->findByManagerAndRep($managerId, $repId);
        
        if (!$result) {
            throw new \RuntimeException('Failed to update rep access');
        }

        return $result;
    }

    public function getAvailableRepsForManager(int $managerId, int $organizationId, ?string $search = null): array
    {
        $where  = ['u.organization_id = :organization_id', 'u.role = :role'];
        $params = [
            ':organization_id' => $organizationId,
            ':role'           => 'rep',
        ];

        if ($search !== null && $search !== '') {
            $where[]                = '(u.name LIKE :search_name OR u.email LIKE :search_email)';
            $params[':search_name'] = '%' . $search . '%';
            $params[':search_email'] = '%' . $search . '%';
        }

        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $sql = "SELECT u.id, u.name, u.email
                FROM users u
                LEFT JOIN rep_manager_access rma ON u.id = rma.rep_id AND rma.manager_id = :current_manager_id
                {$whereSql}
                AND (rma.id IS NULL OR rma.active = 0)
                ORDER BY u.name ASC
                LIMIT 50";

        $params[':current_manager_id'] = $managerId;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function($row) {
            return [
                'id'    => (int) $row['id'],
                'name'  => $row['name'],
                'email' => $row['email'],
            ];
        }, $rows);
    }
}
