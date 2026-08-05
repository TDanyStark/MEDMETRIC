<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Doctor;

use App\Domain\Doctor\Doctor;
use App\Domain\Doctor\DoctorNotFoundException;
use App\Domain\Doctor\DoctorRepositoryInterface;
use App\Infrastructure\Config\PaginationConfig;
use App\Infrastructure\Database\Connection;
use PDO;

class DbDoctorRepository implements DoctorRepositoryInterface
{
    private PDO $pdo;

    /**
     * Columns stored on the `doctors` table (excludes computed fields).
     */
    private const COLUMNS = [
        'id', 'organization_id', 'external_id', 'name', 'document', 'specialty', 'country', 'region',
        'provincia', 'comuna', 'institution', 'category', 'last_visit_date', 'product', 'adoption_level',
        'assigned_rep_id', 'email', 'phone', 'mobile_phone', 'address', 'created_by_id', 'active',
        'created_at', 'updated_at',
    ];

    /**
     * Fields that may be written via create()/update()/upsertByExternalId().
     */
    private const WRITABLE_FIELDS = [
        'external_id', 'name', 'document', 'specialty', 'country', 'region', 'provincia', 'comuna',
        'institution', 'category', 'last_visit_date', 'product', 'adoption_level', 'assigned_rep_id',
        'email', 'phone', 'mobile_phone', 'address', 'created_by_id',
    ];

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    public function create(int $organizationId, array $data): Doctor
    {
        $columns     = array_merge(['organization_id'], self::WRITABLE_FIELDS);
        $placeholders = array_map(fn(string $c) => ":{$c}", $columns);

        $stmt = $this->pdo->prepare(
            'INSERT INTO doctors (' . implode(', ', $columns) . ', active)
             VALUES (' . implode(', ', $placeholders) . ', 1)'
        );

        $params = [':organization_id' => $organizationId];
        foreach (self::WRITABLE_FIELDS as $field) {
            $params[":{$field}"] = $data[$field] ?? null;
        }

        $stmt->execute($params);

        $id = (int) $this->pdo->lastInsertId();

        return $this->findById($id, $organizationId) ?? throw new DoctorNotFoundException($id);
    }

    public function update(int $id, int $organizationId, array $data, ?int $restrictRepId = null): Doctor
    {
        $existing = $this->findById($id, $organizationId);
        if ($existing === null) {
            throw new DoctorNotFoundException($id);
        }

        // Reps may only update doctors they own. Treated as not-found (not 403)
        // so a rep probing another rep's doctor id learns nothing about its
        // existence, mirroring the org-mismatch behavior above.
        if ($restrictRepId !== null && $existing->getAssignedRepId() !== $restrictRepId) {
            throw new DoctorNotFoundException($id);
        }

        $allowedFields = array_merge(self::WRITABLE_FIELDS, ['active']);

        $fields = [];
        $params = [':id' => $id, ':organization_id' => $organizationId];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "{$field} = :{$field}";
                $params[":{$field}"] = $field === 'active' ? ($data[$field] ? 1 : 0) : $data[$field];
            }
        }

        if (!empty($fields)) {
            $stmt = $this->pdo->prepare(
                'UPDATE doctors SET ' . implode(', ', $fields) . '
                 WHERE id = :id AND organization_id = :organization_id'
            );
            $stmt->execute($params);
        }

        return $this->findById($id, $organizationId) ?? throw new DoctorNotFoundException($id);
    }

    public function findById(int $id, int $organizationId): ?Doctor
    {
        $columns = implode(', ', array_map(fn(string $c) => "d.{$c}", self::COLUMNS));

        $stmt = $this->pdo->prepare(
            "SELECT {$columns}, u.name AS assigned_rep_name
             FROM   doctors d
             LEFT   JOIN users u ON u.id = d.assigned_rep_id
             WHERE  d.id = :id AND d.organization_id = :organization_id
             LIMIT  1"
        );

        $stmt->execute([':id' => $id, ':organization_id' => $organizationId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? Doctor::fromRow($row) : null;
    }

    public function search(int $organizationId, string $q, int $limit = 20, ?int $restrictRepId = null): array
    {
        $where  = ['organization_id = :organization_id', 'active = 1'];
        $params = [':organization_id' => $organizationId];

        if ($q !== '') {
            $where[] = '(name LIKE :q1 OR document LIKE :q2 OR institution LIKE :q3)';
            $likeValue = "%{$q}%";
            $params[':q1'] = $likeValue;
            $params[':q2'] = $likeValue;
            $params[':q3'] = $likeValue;
        }

        if ($restrictRepId !== null) {
            $where[]                    = 'assigned_rep_id = :restrict_rep_id';
            $params[':restrict_rep_id'] = $restrictRepId;
        }

        $whereSql = implode(' AND ', $where);
        $orderBy  = $q !== '' ? 'name ASC' : 'created_at DESC';
        $columns  = implode(', ', self::COLUMNS);

        $sql = "SELECT {$columns}
                FROM   doctors
                WHERE  {$whereSql}
                ORDER  BY {$orderBy}
                LIMIT  :limit";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(fn(array $row) => Doctor::fromRow($row), $rows);
    }

    public function findAllByOrg(int $organizationId, array $filters, int $page, ?int $restrictRepId = null): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        $where  = ['d.organization_id = :organization_id'];
        $params = [':organization_id' => $organizationId];

        if (!empty($filters['q'])) {
            $where[] = '(d.name LIKE :q1 OR d.document LIKE :q2 OR d.institution LIKE :q3)';
            $likeValue = '%' . $filters['q'] . '%';
            $params[':q1'] = $likeValue;
            $params[':q2'] = $likeValue;
            $params[':q3'] = $likeValue;
        }

        if (!empty($filters['region'])) {
            $where[]           = 'd.region = :region';
            $params[':region'] = $filters['region'];
        }

        if (!empty($filters['category'])) {
            $where[]             = 'd.category = :category';
            $params[':category'] = $filters['category'];
        }

        // $restrictRepId (role==='rep') always wins over $filters['assigned_rep_id']:
        // the Action layer forces it from auth_user, so a client-supplied
        // assigned_rep_id must never widen or replace the rep's own scope.
        if ($restrictRepId !== null) {
            $where[]                    = 'd.assigned_rep_id = :assigned_rep_id';
            $params[':assigned_rep_id'] = $restrictRepId;
        } elseif (!empty($filters['assigned_rep_id'])) {
            $where[]                     = 'd.assigned_rep_id = :assigned_rep_id';
            $params[':assigned_rep_id']  = (int) $filters['assigned_rep_id'];
        }

        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $countStmt = $this->pdo->prepare("SELECT COUNT(*) FROM doctors d{$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $columns = implode(', ', array_map(fn(string $c) => "d.{$c}", self::COLUMNS));

        $sql = "SELECT {$columns}, u.name AS assigned_rep_name
                FROM   doctors d
                LEFT   JOIN users u ON u.id = d.assigned_rep_id
                {$whereSql}
                ORDER  BY d.name ASC
                LIMIT  :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit',  $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
        $stmt->execute();

        $rows  = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = array_map(fn(array $row) => Doctor::fromRow($row), $rows);

        return [
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $pageSize,
            'last_page' => (int) ceil($total / $pageSize),
        ];
    }

    public function upsertByExternalId(int $organizationId, string $externalId, array $data): Doctor
    {
        $data['external_id'] = $externalId;

        $columns      = array_merge(['organization_id'], self::WRITABLE_FIELDS);
        $placeholders = array_map(fn(string $c) => ":{$c}", $columns);

        // Only update fields that actually come from the import payload
        // (external_id is part of the unique key match and is never re-written).
        $updatable   = array_values(array_diff(self::WRITABLE_FIELDS, ['external_id']));
        $updateSql   = implode(', ', array_map(fn(string $c) => "{$c} = VALUES({$c})", $updatable));

        $stmt = $this->pdo->prepare(
            'INSERT INTO doctors (' . implode(', ', $columns) . ', active)
             VALUES (' . implode(', ', $placeholders) . ', 1)
             ON DUPLICATE KEY UPDATE ' . $updateSql . ', id = LAST_INSERT_ID(id)'
        );

        $params = [':organization_id' => $organizationId];
        foreach (self::WRITABLE_FIELDS as $field) {
            $params[":{$field}"] = $data[$field] ?? null;
        }

        $stmt->execute($params);

        $id = (int) $this->pdo->lastInsertId();

        return $this->findById($id, $organizationId) ?? throw new DoctorNotFoundException($id);
    }

    public function touchLastVisit(int $id): void
    {
        $stmt = $this->pdo->prepare('UPDATE doctors SET last_visit_date = CURDATE() WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }
}
