<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\VisitSession;

use App\Domain\VisitSession\VisitSession;
use App\Domain\VisitSession\VisitSessionNotFoundException;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Config\PaginationConfig;
use PDO;

class DbVisitSessionRepository implements VisitSessionRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    public function findAllByRep(int $repId, int $page = 1, ?string $q = null, ?string $date = null): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        $where = ['vs.rep_id = :rep_id'];
        $params = [':rep_id' => $repId];

        if ($q) {
            $where[] = 'vs.doctor_name LIKE :q';
            $params[':q'] = "%$q%";
        }

        if ($date) {
            $where[] = 'DATE(vs.created_at) = :date';
            $params[':date'] = $date;
        }

        $whereClause = implode(' AND ', $where);

        // Count total
        $countSql = "SELECT COUNT(*) FROM visit_sessions vs WHERE $whereClause";
        $countStmt = $this->pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        // Get sessions with material count and IDs
        $sql = "SELECT vs.id, vs.organization_id, vs.rep_id, vs.doctor_token, 
                       vs.doctor_name, vs.notes, vs.active, vs.created_at, vs.updated_at,
                       COUNT(vsm.id) as material_count,
                       GROUP_CONCAT(vsm.material_id) as material_ids
                FROM visit_sessions vs
                LEFT JOIN visit_session_materials vsm ON vs.id = vsm.visit_session_id
                WHERE $whereClause
                GROUP BY vs.id, vs.organization_id, vs.rep_id, vs.doctor_token, 
                         vs.doctor_name, vs.notes, vs.active, vs.created_at, vs.updated_at
                ORDER BY vs.created_at DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $val) {
            if (is_int($val)) {
                $stmt->bindValue($key, $val, PDO::PARAM_INT);
            } else {
                $stmt->bindValue($key, $val, PDO::PARAM_STR);
            }
        }
        $stmt->bindValue(':limit',  $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $items = array_map(function(array $row) {
            $session = VisitSession::fromRow($row);
            // Add material count and IDs to the serialized data
            $data = $session->jsonSerialize();
            $data['material_count'] = (int) $row['material_count'];
            $data['material_ids'] = $row['material_ids'] 
                ? array_map('intval', explode(',', $row['material_ids'])) 
                : [];
            return $data;
        }, $rows);

        return [
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $pageSize,
            'last_page' => (int) ceil($total / $pageSize),
        ];
    }

    public function findByIdAndRep(int $id, int $repId): VisitSession
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, organization_id, rep_id, doctor_token, doctor_name, notes, active, created_at, updated_at
             FROM visit_sessions
             WHERE id = :id AND rep_id = :rep_id
             LIMIT 1'
        );

        $stmt->execute([':id' => $id, ':rep_id' => $repId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new VisitSessionNotFoundException($id);
        }

        return VisitSession::fromRow($row);
    }

    public function findByDoctorToken(string $token): ?VisitSession
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, organization_id, rep_id, doctor_token, doctor_name, notes, active, created_at, updated_at
             FROM visit_sessions
             WHERE doctor_token = :token AND active = 1
             LIMIT 1'
        );

        $stmt->execute([':token' => $token]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return VisitSession::fromRow($row);
    }

    public function create(int $repId, int $organizationId, array $data, array $materialIds): VisitSession
    {
        // Generate unique token for doctor access
        $doctorToken = bin2hex(random_bytes(32));

        $this->pdo->beginTransaction();

        try {
            // Insert visit session
            $stmt = $this->pdo->prepare(
                'INSERT INTO visit_sessions (organization_id, rep_id, doctor_token, doctor_name, notes, active) 
                 VALUES (:organization_id, :rep_id, :doctor_token, :doctor_name, :notes, 1)'
            );

            $stmt->execute([
                ':organization_id' => $organizationId,
                ':rep_id'          => $repId,
                ':doctor_token'    => $doctorToken,
                ':doctor_name'     => $data['doctor_name'] ?? null,
                ':notes'           => $data['notes'] ?? null,
            ]);

            $sessionId = (int) $this->pdo->lastInsertId();

            // Insert materials for this session
            if (!empty($materialIds)) {
                $insertMaterialStmt = $this->pdo->prepare(
                    'INSERT INTO visit_session_materials (visit_session_id, material_id, sort_order) 
                     VALUES (:visit_session_id, :material_id, :sort_order)'
                );

                foreach ($materialIds as $index => $materialId) {
                    $insertMaterialStmt->execute([
                        ':visit_session_id' => $sessionId,
                        ':material_id'     => $materialId,
                        ':sort_order'      => $index,
                    ]);
                }
            }

            $this->pdo->commit();

            return $this->findByIdAndRep($sessionId, $repId);

        } catch (\Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function getSessionMaterials(int $sessionId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT m.id, m.organization_id, m.brand_id, m.manager_id, m.title, m.description, m.cover_path, m.type, m.status,
                    m.storage_driver, m.storage_path, m.external_url, m.approved_at, m.approved_by, 
                    m.created_at, m.updated_at, vsm.sort_order
             FROM visit_session_materials vsm
             JOIN materials m ON vsm.material_id = m.id
             WHERE vsm.visit_session_id = :session_id
             ORDER BY vsm.sort_order ASC'
        );

        $stmt->execute([':session_id' => $sessionId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function addMaterials(int $sessionId, int $repId, array $materialIds): array
    {
        // Verify session belongs to rep
        $this->findByIdAndRep($sessionId, $repId);

        // Cast all to int for safety
        $materialIds = array_map('intval', $materialIds);

        // Get existing material IDs for this session
        $existingStmt = $this->pdo->prepare(
            'SELECT material_id FROM visit_session_materials WHERE visit_session_id = :session_id'
        );
        $existingStmt->execute([':session_id' => $sessionId]);
        $existingIds = array_map('intval', $existingStmt->fetchAll(PDO::FETCH_COLUMN));

        // Materials to remove (in DB but not in request)
        $toRemove = array_values(array_diff($existingIds, $materialIds));

        // Materials to add (in request but not in DB)
        $toAdd = array_values(array_diff($materialIds, $existingIds));

        if (!empty($toRemove) || !empty($toAdd)) {
            $this->pdo->beginTransaction();
            try {
                // 1. Remove deselected items
                if (!empty($toRemove)) {
                    $placeholders = implode(',', array_fill(0, count($toRemove), '?'));
                    $deleteStmt = $this->pdo->prepare(
                        "DELETE FROM visit_session_materials 
                         WHERE visit_session_id = ? AND material_id IN ($placeholders)"
                    );
                    $deleteStmt->execute(array_merge([$sessionId], $toRemove));
                }

                // 2. Add new items
                if (!empty($toAdd)) {
                    // Get current max sort_order
                    $maxOrderStmt = $this->pdo->prepare(
                        'SELECT COALESCE(MAX(sort_order), -1) FROM visit_session_materials WHERE visit_session_id = :session_id'
                    );
                    $maxOrderStmt->execute([':session_id' => $sessionId]);
                    $maxOrder = (int) $maxOrderStmt->fetchColumn();

                    $insertStmt = $this->pdo->prepare(
                        'INSERT INTO visit_session_materials (visit_session_id, material_id, sort_order)
                         VALUES (:visit_session_id, :material_id, :sort_order)'
                    );

                    foreach ($toAdd as $index => $materialId) {
                        $insertStmt->execute([
                            ':visit_session_id' => $sessionId,
                            ':material_id'      => $materialId,
                            ':sort_order'       => $maxOrder + 1 + $index,
                        ]);
                    }
                }

                $this->pdo->commit();
            } catch (\Exception $e) {
                $this->pdo->rollBack();
                throw $e;
            }
        }

        return $this->getSessionMaterials($sessionId);
    }
}
