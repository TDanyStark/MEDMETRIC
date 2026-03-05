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

    // Admin: List all brands (optionally filtered by organization)
    public function findAll(?int $organizationId = null, ?string $search = null, int $page = 1): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        $where  = [];
        $params = [];

        if ($organizationId !== null) {
            $where[] = 'organization_id = :organization_id';
            $params[':organization_id'] = $organizationId;
        }

        if ($search !== null && $search !== '') {
            $where[]           = '(name LIKE :search OR description LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }

        $whereSql = !empty($where) ? ' WHERE ' . implode(' AND ', $where) : '';

        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM brands" . $whereSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT id, organization_id, name, description, active, created_at, updated_at
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

    // Manager: Get single brand by manager access
    public function findByManagerAndId(int $managerId, int $brandId): Brand
    {
        $stmt = $this->pdo->prepare(
            "SELECT b.id, b.organization_id, b.name, b.description, b.active, b.created_at, b.updated_at
             FROM   brands b
             JOIN   manager_brands mb ON b.id = mb.brand_id
             WHERE  b.id = :brand_id AND mb.manager_id = :manager_id AND mb.active = 1
             LIMIT  1"
        );

        $stmt->execute([':brand_id' => $brandId, ':manager_id' => $managerId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new BrandNotFoundException($brandId);
        }

        return Brand::fromRow($row);
    }

    // Manager: List brands assigned to manager
    public function findAllByManager(int $managerId, ?string $search = null, int $page = 1): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        $where  = ['mb.manager_id = :manager_id', 'mb.active = 1'];
        $params = [':manager_id' => $managerId];

        if ($search !== null && $search !== '') {
            $where[]           = '(b.name LIKE :search OR b.description LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }

        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) 
                     FROM manager_brands mb 
                     JOIN brands b ON mb.brand_id = b.id
                     {$whereSql}";
        $countStmt = $this->pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT b.id, b.organization_id, b.name, b.description, b.active, b.created_at, b.updated_at
                FROM   manager_brands mb
                JOIN   brands b ON mb.brand_id = b.id
                {$whereSql}
                ORDER  BY b.name ASC
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
            'SELECT id, organization_id, name, description, active, created_at, updated_at
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

    public function create(int $organizationId, string $name, ?string $description): Brand
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO brands (organization_id, name, description, active) 
             VALUES (:organization_id, :name, :description, 1)'
        );

        $stmt->execute([
            ':organization_id' => $organizationId,
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

        // First delete from manager_brands to avoid FK constraint issues
        $stmt = $this->pdo->prepare('DELETE FROM manager_brands WHERE brand_id = :id');
        $stmt->execute([':id' => $id]);

        $stmt = $this->pdo->prepare('DELETE FROM brands WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }

    public function findByOrganizationAndName(int $organizationId, string $name): ?Brand
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, organization_id, name, description, active, created_at, updated_at
             FROM   brands
             WHERE  organization_id = :organization_id AND name = :name
             LIMIT  1'
        );

        $stmt->execute([':organization_id' => $organizationId, ':name' => $name]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return Brand::fromRow($row);
    }

    public function existsInOrganization(int $organizationId, string $name, ?int $excludeId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM brands WHERE organization_id = :organization_id AND name = :name';
        $params = [
            ':organization_id' => $organizationId,
            ':name' => $name,
        ];

        if ($excludeId !== null) {
            $sql .= ' AND id != :exclude_id';
            $params[':exclude_id'] = $excludeId;
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn() > 0;
    }

    // Manager brand assignments
    public function assignToManager(int $managerId, int $brandId): void
    {
        // Check if already exists
        $stmt = $this->pdo->prepare(
            'SELECT id FROM manager_brands WHERE manager_id = :manager_id AND brand_id = :brand_id'
        );
        $stmt->execute([':manager_id' => $managerId, ':brand_id' => $brandId]);
        
        if ($stmt->fetch()) {
            // Reactivate if inactive
            $stmt = $this->pdo->prepare(
                'UPDATE manager_brands SET active = 1 WHERE manager_id = :manager_id AND brand_id = :brand_id'
            );
            $stmt->execute([':manager_id' => $managerId, ':brand_id' => $brandId]);
        } else {
            $stmt = $this->pdo->prepare(
                'INSERT INTO manager_brands (manager_id, brand_id, active) VALUES (:manager_id, :brand_id, 1)'
            );
            $stmt->execute([':manager_id' => $managerId, ':brand_id' => $brandId]);
        }
    }

    public function removeFromManager(int $managerId, int $brandId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE manager_brands SET active = 0 WHERE manager_id = :manager_id AND brand_id = :brand_id'
        );
        $stmt->execute([':manager_id' => $managerId, ':brand_id' => $brandId]);
    }

    public function getManagerBrandIds(int $managerId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT brand_id FROM manager_brands WHERE manager_id = :manager_id AND active = 1'
        );
        $stmt->execute([':manager_id' => $managerId]);
        
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_map(fn($row) => (int) $row['brand_id'], $rows);
    }
}
