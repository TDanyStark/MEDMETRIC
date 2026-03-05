<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\AdminUser;

use App\Domain\AdminUser\AdminUser;
use App\Domain\AdminUser\AdminUserNotFoundException;
use App\Domain\AdminUser\AdminUserRepositoryInterface;
use App\Infrastructure\Database\Connection;
use PDO;

class DbAdminUserRepository implements AdminUserRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    private function baseSelect(): string
    {
        return 'SELECT u.id,
                       u.organization_id,
                       o.name  AS organization_name,
                       u.role_id,
                       r.name  AS role,
                       u.name,
                       u.email,
                       u.active,
                       u.last_login_at,
                       u.created_at,
                       u.updated_at
                FROM   users u
                JOIN   organizations o ON o.id = u.organization_id
                JOIN   roles r         ON r.id = u.role_id';
    }

    public function findAll(?string $role = null, ?int $organizationId = null): array
    {
        $where  = [];
        $params = [];

        if ($role !== null) {
            $where[]          = 'r.name = :role';
            $params[':role']  = $role;
        }

        if ($organizationId !== null) {
            $where[]             = 'u.organization_id = :org_id';
            $params[':org_id']   = $organizationId;
        }

        $sql = $this->baseSelect();

        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }

        $sql .= ' ORDER BY u.name ASC';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(fn(array $row) => AdminUser::fromRow($row), $rows);
    }

    public function findById(int $id): AdminUser
    {
        $stmt = $this->pdo->prepare(
            $this->baseSelect() . ' WHERE u.id = :id LIMIT 1'
        );

        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new AdminUserNotFoundException($id);
        }

        return AdminUser::fromRow($row);
    }

    public function create(array $data): AdminUser
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO users (organization_id, role_id, name, email, password_hash, active)
             VALUES (:organization_id, :role_id, :name, :email, :password_hash, :active)'
        );

        $stmt->execute([
            ':organization_id' => $data['organization_id'],
            ':role_id'         => $data['role_id'],
            ':name'            => $data['name'],
            ':email'           => $data['email'],
            ':password_hash'   => password_hash($data['password'], PASSWORD_BCRYPT),
            ':active'          => isset($data['active']) ? ($data['active'] ? 1 : 0) : 1,
        ]);

        $id = (int) $this->pdo->lastInsertId();

        return $this->findById($id);
    }

    public function update(int $id, array $data): AdminUser
    {
        // Ensure user exists
        $this->findById($id);

        $fields = [];
        $params = [':id' => $id];

        $allowed = ['organization_id', 'role_id', 'name', 'email', 'active'];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $fields[]          = "{$field} = :{$field}";
                $params[":{$field}"] = ($field === 'active') ? ($data[$field] ? 1 : 0) : $data[$field];
            }
        }

        if (isset($data['password']) && $data['password'] !== '') {
            $fields[]                  = 'password_hash = :password_hash';
            $params[':password_hash']  = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        if (!empty($fields)) {
            $stmt = $this->pdo->prepare(
                'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id'
            );
            $stmt->execute($params);
        }

        return $this->findById($id);
    }

    public function emailExists(string $email, ?int $excludeId = null): bool
    {
        $sql    = 'SELECT COUNT(*) FROM users WHERE email = :email';
        $params = [':email' => $email];

        if ($excludeId !== null) {
            $sql .= ' AND id != :exclude_id';
            $params[':exclude_id'] = $excludeId;
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        return (int) $stmt->fetchColumn() > 0;
    }

    public function findAllRoles(): array
    {
        $stmt = $this->pdo->query('SELECT id, name FROM roles ORDER BY id ASC');

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function findManagersByOrganization(int $organizationId): array
    {
        $stmt = $this->pdo->prepare(
            $this->baseSelect() . " WHERE u.organization_id = :org_id AND r.name = 'manager' ORDER BY u.name ASC"
        );

        $stmt->execute([':org_id' => $organizationId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(fn(array $row) => AdminUser::fromRow($row), $rows);
    }

    public function subscribeRepToManager(int $repId, int $managerId): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO rep_manager_access (rep_id, manager_id, active)
             VALUES (:rep_id, :manager_id, 1)
             ON DUPLICATE KEY UPDATE active = 1'
        );

        $stmt->execute([':rep_id' => $repId, ':manager_id' => $managerId]);
    }

    public function unsubscribeRepFromManager(int $repId, int $managerId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE rep_manager_access SET active = 0
             WHERE rep_id = :rep_id AND manager_id = :manager_id'
        );

        $stmt->execute([':rep_id' => $repId, ':manager_id' => $managerId]);
    }

    public function getRepSubscriptions(int $repId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT rma.manager_id,
                    u.name  AS manager_name,
                    u.email AS manager_email,
                    rma.active
             FROM   rep_manager_access rma
             JOIN   users u ON u.id = rma.manager_id
             WHERE  rma.rep_id = :rep_id
             ORDER  BY u.name ASC'
        );

        $stmt->execute([':rep_id' => $repId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
