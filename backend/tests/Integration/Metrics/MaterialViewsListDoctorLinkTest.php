<?php

declare(strict_types=1);

namespace Tests\Integration\Metrics;

use App\Infrastructure\Database\Connection;
use App\Infrastructure\Persistence\Metrics\DbMetricsRepository;
use PDO;
use Tests\TestCase;

/**
 * Real-DB regression test for the "Registro de Visualizaciones" (material
 * views log) doctor resolution.
 *
 * Root cause fixed here: the table used to select `visit_sessions.doctor_name`
 * only, and rows whose `material_views.visit_session_id` was NULL (a rep
 * opening a material outside of any visit session) rendered as an ambiguous
 * blank cell — indistinguishable from a bug. This test locks in the fix:
 * doctor identity is resolved via `visit_sessions.doctor_id` joined against
 * the `doctors` catalog (canonical, current name — not the possibly-stale
 * text snapshot), and every row carries an explicit `doctor_link_status` so
 * the frontend can render *why* a row has no doctor instead of a blank cell.
 */
class MaterialViewsListDoctorLinkTest extends TestCase
{
    private PDO $pdo;
    private DbMetricsRepository $repo;
    private static bool $envLoaded = false;

    /** @var array<string,mixed> */
    private array $fx = [];

    protected function setUp(): void
    {
        if (!self::$envLoaded) {
            $dotenv = \Dotenv\Dotenv::createImmutable(__DIR__ . '/../../..');
            $dotenv->safeLoad();
            self::$envLoaded = true;
        }

        $this->pdo = Connection::getConnection();
        $this->repo = new DbMetricsRepository();
        $this->fx = $this->createFixtures();
    }

    protected function tearDown(): void
    {
        $this->destroyFixtures($this->fx);
    }

    public function testLinkedRowResolvesCanonicalDoctorNameNotTheStaleSnapshot(): void
    {
        $row = $this->findViewRow($this->fx['linked_view_id']);

        $this->assertNotNull($row);
        $this->assertSame('linked', $row['doctor_link_status']);
        $this->assertSame($this->fx['doctor_id'], (int) $row['doctor_id']);
        $this->assertSame(
            'Dr. Canonical Current Name',
            $row['doctor_name'],
            'must resolve the current doctors.name, not the possibly-stale visit_sessions.doctor_name snapshot'
        );
    }

    public function testLegacyRowFallsBackToTextSnapshotAndIsFlaggedAsLegacy(): void
    {
        $row = $this->findViewRow($this->fx['legacy_view_id']);

        $this->assertNotNull($row);
        $this->assertSame('legacy', $row['doctor_link_status']);
        $this->assertNull($row['doctor_id']);
        $this->assertSame('Legacy Snapshot Only', $row['doctor_name']);
    }

    public function testOrphanRowWithNoVisitSessionHasNoDoctorAndIsFlaggedAsNoVisit(): void
    {
        $row = $this->findViewRow($this->fx['no_visit_view_id']);

        $this->assertNotNull($row);
        $this->assertSame('no_visit', $row['doctor_link_status']);
        $this->assertNull($row['doctor_id']);
        $this->assertNull($row['doctor_name']);
        // The rep is still known (viewer_id survives independently of the
        // visit session) — only the doctor is unknown for this row.
        $this->assertSame('Rep One', $row['rep_name']);
    }

    // ===================================================================
    // Helpers
    // ===================================================================

    private function findViewRow(int $viewId): ?array
    {
        $list = $this->repo->getMaterialViewsList($this->fx['org_id'], null, []);
        foreach ($list['items'] as $row) {
            if ((int) $row['id'] === $viewId) {
                return $row;
            }
        }
        return null;
    }

    private function createFixtures(): array
    {
        $suffix = uniqid('metrics_doctorlink_', true);

        $orgId = $this->insertOrganization("Test Org {$suffix}");
        $managerId = $this->insertUser($orgId, 'manager', "manager_{$suffix}@test.local", 'Manager');
        $repId = $this->insertUser($orgId, 'rep', "rep_{$suffix}@test.local", 'Rep One');
        $brandId = $this->insertBrand($orgId, "Brand {$suffix}");
        $materialId = $this->insertMaterial($orgId, $brandId, $managerId, "Material {$suffix}");

        $doctorId = $this->insertDoctor($orgId, 'Dr. Canonical Current Name');

        // Session A: doctor_id linked, but its doctor_name snapshot is
        // deliberately stale/different — proves the resolved name comes
        // from the doctors catalog, not the snapshot column.
        $linkedSessionId = $this->insertVisitSession($orgId, $repId, "token_linked_{$suffix}", $doctorId, 'Stale Snapshot Name');
        // Session B: pre-doctor_id-column session — only the text snapshot
        // exists (simulates a visit created before migration 014).
        $legacySessionId = $this->insertVisitSession($orgId, $repId, "token_legacy_{$suffix}", null, 'Legacy Snapshot Only');

        $linkedViewId = $this->insertMaterialView($materialId, $linkedSessionId, 'rep', $repId);
        $legacyViewId = $this->insertMaterialView($materialId, $legacySessionId, 'rep', $repId);
        // No visit session at all — e.g. a rep opening the material outside
        // of any visit link.
        $noVisitViewId = $this->insertMaterialView($materialId, null, 'rep', $repId);

        return [
            'org_id' => $orgId,
            'manager_id' => $managerId,
            'rep_id' => $repId,
            'brand_id' => $brandId,
            'material_id' => $materialId,
            'doctor_id' => $doctorId,
            'linked_session_id' => $linkedSessionId,
            'legacy_session_id' => $legacySessionId,
            'linked_view_id' => $linkedViewId,
            'legacy_view_id' => $legacyViewId,
            'no_visit_view_id' => $noVisitViewId,
        ];
    }

    private function destroyFixtures(array $fx): void
    {
        if (empty($fx)) {
            return;
        }

        $this->deleteWhereIn('material_views', 'id', [
            $fx['linked_view_id'], $fx['legacy_view_id'], $fx['no_visit_view_id'],
        ]);
        $this->deleteWhereIn('visit_sessions', 'id', [$fx['linked_session_id'], $fx['legacy_session_id']]);
        $this->deleteWhereIn('doctors', 'id', [$fx['doctor_id']]);
        $this->deleteWhereIn('materials', 'id', [$fx['material_id']]);
        $this->deleteWhereIn('brands', 'id', [$fx['brand_id']]);
        $this->deleteWhereIn('users', 'id', [$fx['manager_id'], $fx['rep_id']]);
        $this->deleteWhereIn('organizations', 'id', [$fx['org_id']]);
    }

    private function deleteWhereIn(string $table, string $column, array $ids): void
    {
        $ids = array_values(array_unique(array_filter($ids, fn ($v) => $v !== null)));
        if (empty($ids)) {
            return;
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->pdo->prepare("DELETE FROM `{$table}` WHERE `{$column}` IN ({$placeholders})");
        $stmt->execute($ids);
    }

    private function insertOrganization(string $name): int
    {
        $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower($name));
        $stmt = $this->pdo->prepare('INSERT INTO organizations (name, slug, active) VALUES (:name, :slug, 1)');
        $stmt->execute([':name' => $name, ':slug' => $slug]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertUser(int $organizationId, string $roleName, string $email, string $name): int
    {
        $roleStmt = $this->pdo->prepare('SELECT id FROM roles WHERE name = :name LIMIT 1');
        $roleStmt->execute([':name' => $roleName]);
        $roleId = (int) $roleStmt->fetchColumn();

        $stmt = $this->pdo->prepare(
            'INSERT INTO users (organization_id, role_id, name, email, password_hash, active)
             VALUES (:org_id, :role_id, :name, :email, :hash, 1)'
        );
        $stmt->execute([
            ':org_id' => $organizationId,
            ':role_id' => $roleId,
            ':name' => $name,
            ':email' => $email,
            ':hash' => password_hash('test-password-not-used', PASSWORD_BCRYPT),
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertDoctor(int $organizationId, string $name): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO doctors (organization_id, name, active) VALUES (:org_id, :name, 1)'
        );
        $stmt->execute([':org_id' => $organizationId, ':name' => $name]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertBrand(int $organizationId, string $name): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO brands (organization_id, name, active) VALUES (:org_id, :name, 1)'
        );
        $stmt->execute([':org_id' => $organizationId, ':name' => $name]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertMaterial(int $organizationId, int $brandId, int $managerId, string $title): int
    {
        $stmt = $this->pdo->prepare(
            "INSERT INTO materials (organization_id, brand_id, manager_id, title, type, status)
             VALUES (:org_id, :brand_id, :manager_id, :title, 'pdf', 'approved')"
        );
        $stmt->execute([
            ':org_id' => $organizationId,
            ':brand_id' => $brandId,
            ':manager_id' => $managerId,
            ':title' => $title,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertVisitSession(
        int $organizationId,
        int $repId,
        string $token,
        ?int $doctorId,
        string $doctorNameSnapshot
    ): int {
        $stmt = $this->pdo->prepare(
            'INSERT INTO visit_sessions (organization_id, rep_id, doctor_token, doctor_id, doctor_name, active)
             VALUES (:org_id, :rep_id, :token, :doctor_id, :doctor_name, 1)'
        );
        $stmt->execute([
            ':org_id' => $organizationId,
            ':rep_id' => $repId,
            ':token' => $token,
            ':doctor_id' => $doctorId,
            ':doctor_name' => $doctorNameSnapshot,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertMaterialView(int $materialId, ?int $sessionId, string $viewerType, ?int $viewerId): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO material_views (material_id, visit_session_id, viewer_type, viewer_id, opened_at)
             VALUES (:material_id, :session_id, :viewer_type, :viewer_id, NOW())'
        );
        $stmt->execute([
            ':material_id' => $materialId,
            ':session_id' => $sessionId,
            ':viewer_type' => $viewerType,
            ':viewer_id' => $viewerId,
        ]);
        return (int) $this->pdo->lastInsertId();
    }
}
