<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Brand;

use App\Domain\Brand\Brand;
use App\Domain\Brand\BrandNotFoundException;
use App\Domain\Brand\BrandRepositoryInterface;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Config\PaginationConfig;
use PDO;

class DbBrandRepository implements BrandRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    public function findAllByManager(int $managerId, ?string $search = null, int $page = 1): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        $where  = ['manager_id = :manager_id'];
        $params = [':manager_id' => $managerId];

        if ($search !== null && $search !== '') {
            $where[]           = '(name LIKE :search OR description LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }

        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM brands" . $whereSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT id, organization_id, manager_id, name, description, active, created_at, updated_at
                FROM   brands
                {$whereSql}
                ORDER  BY name ASC
                LIMIT  :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit',  $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = array_map(fn(array $row) => Brand::fromRow($row), $rows);

        return [
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $pageSize,
            'last_page' => (int) ceil($total / $pageSize),
        ];
    }

    public function findById(int $id): Brand
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, organization_id, manager_id, name, description, active, created_at, updated_at
             FROM   brands
             WHERE  id = :id
             LIMIT  1'
        );

        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new BrandNotFoundException($id);
        }

        return Brand::fromRow($row);
    }

    public function findByManagerAndId(int $managerId, int $id): Brand
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, organization_id, manager_id, name, description, active, created_at, updated_at
             FROM   brands
             WHERE  id = :id AND manager_id = :manager_id
             LIMIT  1'
        );

        $stmt->execute([':id' => $id, ':manager_id' => $managerId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new BrandNotFoundException($id);
        }

        return Brand::fromRow($row);
    }

    public function create(int $organizationId, int $managerId, string $name, ?string $description): Brand
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO brands (organization_id, manager_id, name, description, active) 
             VALUES (:organization_id, :manager_id, :name, :description, 1)'
        );

        $stmt->execute([
            ':organization_id' => $organizationId,
            ':manager_id'      => $managerId,
            ':name'            => $name,
            ':description'     => $description,
        ]);

        $id = (int) $this->pdo->lastInsertId();

        return $this->findById($id);
    }

    public function update(int $id, array $data): Brand
    {
        $this->findById($id);

        $fields = [];
        $params = [':id' => $id];

        if (isset($data['name'])) {
            $fields[] = 'name = :name';
            $params[':name'] = $data['name'];
        }

        if (isset($data['description'])) {
            $fields[] = 'description = :description';
            $params[':description'] = $data['description'];
        }

        if (isset($data['active'])) {
            $fields[] = 'active = :active';
            $params[':active'] = $data['active'] ? 1 : 0;
        }

        if (!empty($fields)) {
            $stmt = $this->pdo->prepare(
                'UPDATE brands SET ' . implode(', ', $fields) . ' WHERE id = :id'
            );
            $stmt->execute($params);
        }

        return $this->findById($id);
    }

    public function delete(int $id): void
    {
        $this->findById($id);

        $stmt = $this->pdo->prepare('DELETE FROM brands WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }
}
