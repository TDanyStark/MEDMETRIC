<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\MaterialStudy;

use App\Domain\MaterialStudy\MaterialStudy;
use App\Domain\MaterialStudy\MaterialStudyNotFoundException;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use App\Infrastructure\Database\Connection;
use PDO;

class DbMaterialStudyRepository implements MaterialStudyRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    public function findAllByMaterial(int $materialId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, material_id, title, type, storage_driver, storage_path, external_url,
                    pdf_compression_status, pdf_compression_error, pdf_compression_checked_at,
                    created_at, updated_at
             FROM   material_studies
             WHERE  material_id = :material_id
             ORDER  BY created_at ASC'
        );

        $stmt->execute([':material_id' => $materialId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(fn(array $row) => MaterialStudy::fromRow($row), $rows);
    }

    public function findAllByMaterialIds(array $materialIds): array
    {
        if (empty($materialIds)) {
            return [];
        }

        $placeholders = [];
        $params       = [];
        foreach (array_values($materialIds) as $index => $materialId) {
            $key                = ":material_id_{$index}";
            $placeholders[]     = $key;
            $params[$key]       = $materialId;
        }

        $sql = 'SELECT id, material_id, title, type, storage_driver, storage_path, external_url,
                       pdf_compression_status, pdf_compression_error, pdf_compression_checked_at,
                       created_at, updated_at
                FROM   material_studies
                WHERE  material_id IN (' . implode(', ', $placeholders) . ')
                ORDER  BY created_at ASC';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $grouped = [];
        foreach ($rows as $row) {
            $study = MaterialStudy::fromRow($row);
            $grouped[$study->getMaterialId()][] = $study;
        }

        return $grouped;
    }

    public function findByOrganizationAndId(int $organizationId, int $id): MaterialStudy
    {
        $stmt = $this->pdo->prepare(
            'SELECT ms.id, ms.material_id, ms.title, ms.type, ms.storage_driver, ms.storage_path, ms.external_url,
                    ms.pdf_compression_status, ms.pdf_compression_error, ms.pdf_compression_checked_at,
                    ms.created_at, ms.updated_at
             FROM   material_studies ms
             JOIN   materials m ON ms.material_id = m.id
             WHERE  ms.id = :id AND m.organization_id = :organization_id
             LIMIT  1'
        );

        $stmt->execute([':id' => $id, ':organization_id' => $organizationId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new MaterialStudyNotFoundException($id);
        }

        return MaterialStudy::fromRow($row);
    }

    public function findByManagerAndId(int $managerId, int $id): MaterialStudy
    {
        $stmt = $this->pdo->prepare(
            'SELECT ms.id, ms.material_id, ms.title, ms.type, ms.storage_driver, ms.storage_path, ms.external_url,
                    ms.pdf_compression_status, ms.pdf_compression_error, ms.pdf_compression_checked_at,
                    ms.created_at, ms.updated_at
             FROM   material_studies ms
             JOIN   materials m ON ms.material_id = m.id
             JOIN   manager_brands mb ON m.brand_id = mb.brand_id AND mb.manager_id = m.manager_id
             WHERE  ms.id = :id AND m.manager_id = :manager_id AND mb.active = 1
             LIMIT  1'
        );

        $stmt->execute([':id' => $id, ':manager_id' => $managerId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new MaterialStudyNotFoundException($id);
        }

        return MaterialStudy::fromRow($row);
    }

    public function findById(int $id): MaterialStudy
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, material_id, title, type, storage_driver, storage_path, external_url,
                    pdf_compression_status, pdf_compression_error, pdf_compression_checked_at,
                    created_at, updated_at
             FROM   material_studies
             WHERE  id = :id
             LIMIT  1'
        );

        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new MaterialStudyNotFoundException($id);
        }

        return MaterialStudy::fromRow($row);
    }

    public function create(array $data): MaterialStudy
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO material_studies (material_id, title, type, storage_driver, storage_path, external_url, pdf_compression_status)
             VALUES (:material_id, :title, :type, :storage_driver, :storage_path, :external_url, :pdf_compression_status)'
        );

        $stmt->execute([
            ':material_id'             => $data['material_id'],
            ':title'                   => $data['title'],
            ':type'                    => $data['type'],
            ':storage_driver'          => $data['storage_driver'] ?? 'local',
            ':storage_path'            => $data['storage_path'] ?? null,
            ':external_url'            => $data['external_url'] ?? null,
            ':pdf_compression_status'  => $data['pdf_compression_status'] ?? null,
        ]);

        $id = (int) $this->pdo->lastInsertId();

        return $this->findById($id);
    }

    public function update(int $id, array $data): MaterialStudy
    {
        $this->findById($id);

        $fields = [];
        $params = [':id' => $id];

        if (isset($data['title'])) {
            $fields[] = 'title = :title';
            $params[':title'] = $data['title'];
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
                'UPDATE material_studies SET ' . implode(', ', $fields) . ' WHERE id = :id'
            );
            $stmt->execute($params);
        }

        return $this->findById($id);
    }

    public function delete(int $id): void
    {
        $this->findById($id);

        $stmt = $this->pdo->prepare('DELETE FROM material_studies WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }
}
