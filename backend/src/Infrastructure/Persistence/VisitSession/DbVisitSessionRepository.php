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

    public function findAllByRep(int $repId, int $page = 1): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $offset   = ($page - 1) * $pageSize;

        // Count total
        $countStmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM visit_sessions WHERE rep_id = :rep_id'
        );
        $countStmt->execute([':rep_id' => $repId]);
        $total = (int) $countStmt->fetchColumn();

        // Get sessions with material count
        $sql = 'SELECT vs.id, vs.organization_id, vs.rep_id, vs.doctor_token, 
                       vs.doctor_name, vs.notes, vs.active, vs.created_at, vs.updated_at,
                       COUNT(vsm.id) as material_count
                FROM visit_sessions vs
                LEFT JOIN visit_session_materials vsm ON vs.id = vsm.visit_session_id
                WHERE vs.rep_id = :rep_id
                GROUP BY vs.id, vs.organization_id, vs.rep_id, vs.doctor_token, 
                         vs.doctor_name, vs.notes, vs.active, vs.created_at, vs.updated_at
                ORDER BY vs.created_at DESC
                LIMIT :limit OFFSET :offset';

        $stmt = $this->pdo->prepare($sql);
        $stmt->bindValue(':rep_id', $repId, PDO::PARAM_INT);
        $stmt->bindValue(':limit',  $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset,   PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $items = array_map(function(array $row) {
            $session = VisitSession::fromRow($row);
            // Add material count to the serialized data
            $data = $session->jsonSerialize();
            $data['material_count'] = (int) $row['material_count'];
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
            'SELECT m.id, m.organization_id, m.brand_id, m.manager_id, m.title, m.description, m.type, m.status,
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
}
