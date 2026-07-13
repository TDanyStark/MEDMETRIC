<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Material;

use App\Domain\Material\Material;
use App\Domain\Material\MaterialNotFoundException;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Config\PaginationConfig;
use PDO;

class DbMaterialRepository implements MaterialRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    public function findAllByManager(int $managerId, ?string $search = null, ?string $status = null, ?string $type = null, int $page = 1): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        // Join with manager_brands to verify brand access
        $where  = ['m.manager_id = :manager_id', 'mb.active = 1'];
        $params = [':manager_id' => $managerId];

        if ($search !== null && $search !== '') {
            $where[]                  = '(m.title LIKE :search_title OR m.description LIKE :search_description)';
            $params[':search_title']  = '%' . $search . '%';
            $params[':search_description'] = '%' . $search . '%';
        }

        if ($status !== null && $status !== '') {
            $where[]         = 'm.status = :status';
            $params[':status'] = $status;
        }

        if ($type !== null && $type !== '') {
            $where[]      = 'm.type = :type';
            $params[':type'] = $type;
        }

        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) 
                     FROM materials m
                     JOIN manager_brands mb ON m.brand_id = mb.brand_id AND mb.manager_id = m.manager_id
                     {$whereSql}";
        $countStmt = $this->pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT m.id, m.organization_id, m.brand_id, m.manager_id, m.title, m.description, m.cover_path, m.type, m.status, m.is_visible,
                       m.storage_driver, m.storage_path, m.external_url, m.approved_at, m.approved_by, 
                       m.created_at, m.updated_at
                FROM   materials m
                JOIN   manager_brands mb ON m.brand_id = mb.brand_id AND mb.manager_id = m.manager_id
                {$whereSql}
                ORDER  BY m.created_at DESC
                LIMIT  :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit',  $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = array_map(fn(array $row) => Material::fromRow($row), $rows);

        return [
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $pageSize,
            'last_page' => (int) ceil($total / $pageSize),
        ];
    }

    public function findAllByOrganization(int $organizationId, ?string $search = null, ?string $status = null, ?string $type = null, ?int $brandId = null, ?int $managerId = null, int $page = 1): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        $where  = ['m.organization_id = :organization_id'];
        $params = [':organization_id' => $organizationId];

        if ($search !== null && $search !== '') {
            $where[]                       = '(m.title LIKE :search_title OR m.description LIKE :search_description)';
            $params[':search_title']       = '%' . $search . '%';
            $params[':search_description'] = '%' . $search . '%';
        }

        if ($status !== null && $status !== '') {
            $where[]           = 'm.status = :status';
            $params[':status'] = $status;
        }

        if ($type !== null && $type !== '') {
            $where[]         = 'm.type = :type';
            $params[':type'] = $type;
        }

        if ($brandId !== null) {
            $where[]             = 'm.brand_id = :brand_id';
            $params[':brand_id'] = $brandId;
        }

        if ($managerId !== null) {
            $where[]               = 'm.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
        }

        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) FROM materials m {$whereSql}";
        $countStmt = $this->pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT m.id, m.organization_id, m.brand_id, m.manager_id, m.title, m.description, m.cover_path, m.type, m.status, m.is_visible,
                       m.storage_driver, m.storage_path, m.external_url, m.approved_at, m.approved_by,
                       m.created_at, m.updated_at,
                       b.name AS brand_name,
                       u.name AS manager_name
                FROM   materials m
                JOIN   brands b ON m.brand_id = b.id
                JOIN   users u ON m.manager_id = u.id
                {$whereSql}
                ORDER  BY m.created_at DESC
                LIMIT  :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit',  $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = array_map(fn(array $row) => Material::fromRow($row), $rows);

        return [
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $pageSize,
            'last_page' => (int) ceil($total / $pageSize),
        ];
    }

    public function findByOrganizationAndId(int $organizationId, int $id): Material
    {
        $stmt = $this->pdo->prepare(
            'SELECT m.id, m.organization_id, m.brand_id, m.manager_id, m.title, m.description, m.cover_path, m.type, m.status, m.is_visible,
                    m.storage_driver, m.storage_path, m.external_url, m.approved_at, m.approved_by,
                    m.created_at, m.updated_at,
                    b.name AS brand_name,
                    u.name AS manager_name
             FROM   materials m
             JOIN   brands b ON m.brand_id = b.id
             JOIN   users u ON m.manager_id = u.id
             WHERE  m.id = :id AND m.organization_id = :organization_id
             LIMIT  1'
        );

        $stmt->execute([':id' => $id, ':organization_id' => $organizationId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new MaterialNotFoundException($id);
        }

        return Material::fromRow($row);
    }

    public function findById(int $id): Material
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, organization_id, brand_id, manager_id, title, description, cover_path, type, status, is_visible,
                    storage_driver, storage_path, external_url, approved_at, approved_by, 
                    created_at, updated_at, pdf_compression_status, pdf_compression_error, pdf_compression_checked_at
             FROM   materials
             WHERE  id = :id
             LIMIT  1'
        );

        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new MaterialNotFoundException($id);
        }

        return Material::fromRow($row);
    }

    public function findByManagerAndId(int $managerId, int $id): Material
    {
        $stmt = $this->pdo->prepare(
            'SELECT m.id, m.organization_id, m.brand_id, m.manager_id, m.title, m.description, m.cover_path, m.type, m.status, m.is_visible,
                    m.storage_driver, m.storage_path, m.external_url, m.approved_at, m.approved_by, 
                    m.created_at, m.updated_at
             FROM   materials m
             JOIN   manager_brands mb ON m.brand_id = mb.brand_id
             WHERE  m.id = :id AND m.manager_id = :manager_id AND mb.manager_id = m.manager_id AND mb.active = 1
             LIMIT  1'
        );

        $stmt->execute([':id' => $id, ':manager_id' => $managerId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new MaterialNotFoundException($id);
        }

        return Material::fromRow($row);
    }

    public function create(array $data): Material
    {
        $idempotencyKey = !empty($data['idempotency_key']) ? (string) $data['idempotency_key'] : null;

        $stmt = $this->pdo->prepare(
            'INSERT INTO materials (organization_id, brand_id, manager_id, title, description, cover_path, type, status, is_visible, storage_driver, storage_path, external_url, idempotency_key, pdf_compression_status) 
             VALUES (:organization_id, :brand_id, :manager_id, :title, :description, :cover_path, :type, :status, :is_visible, :storage_driver, :storage_path, :external_url, :idempotency_key, :pdf_compression_status)'
        );

        try {
            $stmt->execute([
                ':organization_id' => $data['organization_id'],
                ':brand_id'        => $data['brand_id'],
                ':manager_id'      => $data['manager_id'],
                ':title'           => $data['title'],
                ':description'     => $data['description'] ?? null,
                ':cover_path'      => $data['cover_path'] ?? null,
                ':type'            => $data['type'],
                ':status'          => $data['status'] ?? 'draft',
                ':is_visible'      => isset($data['is_visible']) ? (int) $data['is_visible'] : 0,
                ':storage_driver'  => $data['storage_driver'] ?? 'local',
                ':storage_path'    => $data['storage_path'] ?? null,
                ':external_url'    => $data['external_url'] ?? null,
                ':idempotency_key' => $idempotencyKey,
                ':pdf_compression_status' => $data['pdf_compression_status'] ?? null,
            ]);
        } catch (\PDOException $e) {
            // Race condition: two near-simultaneous requests with the same
            // idempotency_key (e.g. a retry fired right as the first request
            // was finishing). The unique constraint rejects the second
            // insert — return the row the first request already created
            // instead of failing the whole request.
            if ($idempotencyKey !== null && (int) ($e->errorInfo[1] ?? 0) === 1062) {
                $existing = $this->findByIdempotencyKey($idempotencyKey);
                if ($existing !== null) {
                    return $existing;
                }
            }
            throw $e;
        }

        $id = (int) $this->pdo->lastInsertId();

        return $this->findById($id);
    }

    public function findByIdempotencyKey(string $idempotencyKey): ?Material
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, organization_id, brand_id, manager_id, title, description, cover_path, type, status, is_visible,
                    storage_driver, storage_path, external_url, approved_at, approved_by,
                    created_at, updated_at
             FROM   materials
             WHERE  idempotency_key = :idempotency_key
             LIMIT  1'
        );

        $stmt->execute([':idempotency_key' => $idempotencyKey]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? Material::fromRow($row) : null;
    }

    public function update(int $id, array $data): Material
    {
        $this->findById($id);

        $fields = [];
        $params = [':id' => $id];

        if (isset($data['title'])) {
            $fields[] = 'title = :title';
            $params[':title'] = $data['title'];
        }

        if (isset($data['description'])) {
            $fields[] = 'description = :description';
            $params[':description'] = $data['description'];
        }
        
        if (isset($data['cover_path'])) {
            $fields[] = 'cover_path = :cover_path';
            $params[':cover_path'] = $data['cover_path'];
        }

        if (isset($data['brand_id'])) {
            $fields[] = 'brand_id = :brand_id';
            $params[':brand_id'] = $data['brand_id'];
        }

        if (isset($data['type'])) {
            $fields[] = 'type = :type';
            $params[':type'] = $data['type'];
        }

        if (isset($data['status'])) {
            $fields[] = 'status = :status';
            $params[':status'] = $data['status'];
        }

        if (isset($data['is_visible'])) {
            $fields[] = 'is_visible = :is_visible';
            $params[':is_visible'] = (int) $data['is_visible'];
        }

        if (isset($data['storage_driver'])) {
            $fields[] = 'storage_driver = :storage_driver';
            $params[':storage_driver'] = $data['storage_driver'];
        }

        if (isset($data['storage_path'])) {
            $fields[] = 'storage_path = :storage_path';
            $params[':storage_path'] = $data['storage_path'];
        }

        if (isset($data['external_url'])) {
            $fields[] = 'external_url = :external_url';
            $params[':external_url'] = $data['external_url'];
        }

        if (isset($data['pdf_compression_status'])) {
            $fields[] = 'pdf_compression_status = :pdf_compression_status';
            $params[':pdf_compression_status'] = $data['pdf_compression_status'];
        }

        // array_key_exists (not isset): must allow explicitly clearing a
        // previous error message back to NULL once compression succeeds.
        if (array_key_exists('pdf_compression_error', $data)) {
            $fields[] = 'pdf_compression_error = :pdf_compression_error';
            $params[':pdf_compression_error'] = $data['pdf_compression_error'];
        }

        if (isset($data['pdf_compression_checked_at'])) {
            $fields[] = 'pdf_compression_checked_at = :pdf_compression_checked_at';
            $params[':pdf_compression_checked_at'] = $data['pdf_compression_checked_at'];
        }

        if (!empty($fields)) {
            $stmt = $this->pdo->prepare(
                'UPDATE materials SET ' . implode(', ', $fields) . ' WHERE id = :id'
            );
            $stmt->execute($params);
        }

        return $this->findById($id);
    }

    public function delete(int $id): void
    {
        $this->findById($id);

        $stmt = $this->pdo->prepare('DELETE FROM materials WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }

    public function approve(int $id, int $approvedBy): Material
    {
        $this->findById($id);

        $stmt = $this->pdo->prepare(
            'UPDATE materials SET status = :status, is_visible = 1, approved_at = NOW(), approved_by = :approved_by WHERE id = :id'
        );

        $stmt->execute([
            ':id'          => $id,
            ':status'      => 'approved',
            ':approved_by' => $approvedBy,
        ]);

        return $this->findById($id);
    }

    public function setVisibility(int $id, bool $isVisible): Material
    {
        $this->findById($id);

        $stmt = $this->pdo->prepare(
            'UPDATE materials SET is_visible = :is_visible, updated_at = NOW() WHERE id = :id'
        );

        $stmt->execute([
            ':id'         => $id,
            ':is_visible' => $isVisible ? 1 : 0,
        ]);

        return $this->findById($id);
    }

    public function findAllApprovedByRep(int $repId, ?string $search = null, ?string $type = null, int $page = 1, ?int $managerId = null, ?int $brandId = null): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        // Join with rep_manager_access to get materials from subscribed managers
        // Only approved materials that are active
        $where  = ['m.status = :status', 'm.is_visible = 1', 'rma.active = 1', 'rma.rep_id = :rep_id'];
        $params = [':rep_id' => $repId, ':status' => 'approved'];

        if ($search !== null && $search !== '') {
            $where[]                  = '(m.title LIKE :search_title OR m.description LIKE :search_description)';
            $params[':search_title']  = '%' . $search . '%';
            $params[':search_description'] = '%' . $search . '%';
        }

        if ($type !== null && $type !== '') {
            $where[]      = 'm.type = :type';
            $params[':type'] = $type;
        }

        if ($managerId !== null) {
            $where[] = 'm.manager_id = :manager_id';
            $params[':manager_id'] = $managerId;
        }

        if ($brandId !== null) {
            $where[] = 'm.brand_id = :brand_id';
            $params[':brand_id'] = $brandId;
        }

        $whereSql = ' WHERE ' . implode(' AND ', $where);

        $countSql = "SELECT COUNT(*) 
                     FROM materials m
                     JOIN rep_manager_access rma ON m.manager_id = rma.manager_id
                     {$whereSql}";
        $countStmt = $this->pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT m.id, m.organization_id, m.brand_id, m.manager_id, m.title, m.description, m.cover_path, m.type, m.status, m.is_visible,
                        m.storage_driver, m.storage_path, m.external_url, m.approved_at, m.approved_by, 
                        m.created_at, m.updated_at,
                        b.name as brand_name,
                        u.name as manager_name
                FROM   materials m
                JOIN   rep_manager_access rma ON m.manager_id = rma.manager_id
                JOIN   brands b ON m.brand_id = b.id
                JOIN   users u ON m.manager_id = u.id
                {$whereSql}
                ORDER  BY m.approved_at DESC
                LIMIT  :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val);
        }
        $stmt->bindValue(':limit',  $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = array_map(fn(array $row) => Material::fromRow($row), $rows);

        return [
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $pageSize,
            'last_page' => (int) ceil($total / $pageSize),
        ];
    }
}
