<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Organization;

use App\Domain\Organization\Organization;
use App\Domain\Organization\OrganizationNotFoundException;
use App\Domain\Organization\OrganizationRepositoryInterface;
use App\Infrastructure\Database\Connection;
use PDO;

class DbOrganizationRepository implements OrganizationRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    public function findAll(): array
    {
        $stmt = $this->pdo->query(
            'SELECT id, name, slug, active, created_at, updated_at
             FROM   organizations
             ORDER  BY name ASC'
        );

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(fn(array $row) => Organization::fromRow($row), $rows);
    }

    public function findById(int $id): Organization
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, name, slug, active, created_at, updated_at
             FROM   organizations
             WHERE  id = :id
             LIMIT  1'
        );

        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new OrganizationNotFoundException($id);
        }

        return Organization::fromRow($row);
    }

    public function create(string $name, string $slug, bool $active): Organization
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO organizations (name, slug, active) VALUES (:name, :slug, :active)'
        );

        $stmt->execute([
            ':name'   => $name,
            ':slug'   => $slug,
            ':active' => $active ? 1 : 0,
        ]);

        $id = (int) $this->pdo->lastInsertId();

        return $this->findById($id);
    }

    public function update(int $id, array $data): Organization
    {
        // Ensure organization exists
        $this->findById($id);

        $fields = [];
        $params = [':id' => $id];

        if (isset($data['name'])) {
            $fields[] = 'name = :name';
            $params[':name'] = $data['name'];
        }

        if (isset($data['slug'])) {
            $fields[] = 'slug = :slug';
            $params[':slug'] = $data['slug'];
        }

        if (isset($data['active'])) {
            $fields[] = 'active = :active';
            $params[':active'] = $data['active'] ? 1 : 0;
        }

        if (!empty($fields)) {
            $stmt = $this->pdo->prepare(
                'UPDATE organizations SET ' . implode(', ', $fields) . ' WHERE id = :id'
            );
            $stmt->execute($params);
        }

        return $this->findById($id);
    }

    public function slugExists(string $slug, ?int $excludeId = null): bool
    {
        $sql    = 'SELECT COUNT(*) FROM organizations WHERE slug = :slug';
        $params = [':slug' => $slug];

        if ($excludeId !== null) {
            $sql .= ' AND id != :exclude_id';
            $params[':exclude_id'] = $excludeId;
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn() > 0;
    }
}
