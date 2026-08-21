<?php

declare(strict_types=1);

namespace Tests\Integration\RepMetrics;

use App\Infrastructure\Database\Connection;
use App\Infrastructure\Persistence\RepMetrics\DbRepMetricsRepository;
use PDO;
use Tests\TestCase;

/**
 * Real-DB regression test for sdd/group-by-id-not-name — the
 * "Médicos que nunca abrieron" widget fix.
 *
 * Root cause fixed here: `RepMetricsRepositoryInterface::sessions()`
 * (previously backing this widget) is session-level and displayed the raw
 * `visit_sessions.doctor_name` text snapshot. Several organizations have
 * doctors that share the exact same name — text alone cannot distinguish
 * them. This test locks in `neverOpenedDoctors()`: identity is resolved
 * exclusively by `doctor_id` (never by name), so:
 *   - Two DIFFERENT doctors who happen to share a name are NEVER merged
 *     into one row (the bug this fix targets).
 *   - The SAME doctor with multiple never-opened sessions collapses into
 *     ONE row (deduplicated), not one row per session.
 *   - A legacy session with no `doctor_id` can't be matched against
 *     anything, so it always stays its own row.
 *   - `neverOpenedDoctors()['total']` always equals
 *     `summary()['doctors_never_opened']` (the "tarjeta == tabla"
 *     invariant), using the identical dedup key on both sides.
 */
class NeverOpenedDoctorsDedupTest extends TestCase
{
    private PDO $pdo;
    private DbRepMetricsRepository $repo;
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
        $this->repo = new DbRepMetricsRepository();
        $this->fx = $this->createFixtures();
    }

    protected function tearDown(): void
    {
        $this->destroyFixtures($this->fx);
    }

    /**
     * The core bug this change fixes: Dr. Juan Perez (A) and Dr. Juan
     * Perez (B) are TWO DIFFERENT doctors (different doctor_id) who
     * happen to share the exact same name in the same organization. Both
     * must appear as SEPARATE rows — grouping by text would have merged
     * them into one.
     */
    public function testTwoDistinctDoctorsWithTheSameNameAreNotMerged(): void
    {
        $result = $this->repo->neverOpenedDoctors($this->fx['rep_id'], [], 1);

        $doctorIds = array_column($result['items'], 'doctor_id');
        $this->assertContains($this->fx['doctor_a_id'], $doctorIds);
        $this->assertContains($this->fx['doctor_b_id'], $doctorIds);
        $this->assertNotSame(
            $this->fx['doctor_a_id'],
            $this->fx['doctor_b_id'],
            'fixture sanity: the two same-name doctors must have different ids'
        );

        $rowA = $this->findByDoctorId($result['items'], $this->fx['doctor_a_id']);
        $rowB = $this->findByDoctorId($result['items'], $this->fx['doctor_b_id']);
        $this->assertNotNull($rowA);
        $this->assertNotNull($rowB);
        $this->assertSame('Dr. Juan Perez', $rowA['doctor_name']);
        $this->assertSame('Dr. Juan Perez', $rowB['doctor_name']);
        $this->assertSame(1, $rowA['session_count']);
        $this->assertSame(1, $rowB['session_count']);
    }

    /**
     * The SAME doctor with 2 never-opened sessions must collapse into ONE
     * row with session_count=2 — proves the grouping actually deduplicates
     * by identity instead of just relabeling session-level rows.
     */
    public function testSameDoctorWithMultipleNeverOpenedSessionsCollapsesToOneRow(): void
    {
        $result = $this->repo->neverOpenedDoctors($this->fx['rep_id'], [], 1);

        $matches = array_values(array_filter(
            $result['items'],
            fn (array $row) => $row['doctor_id'] === $this->fx['doctor_c_id']
        ));

        $this->assertCount(1, $matches, 'doctor with 2 unopened sessions must appear exactly once');
        $this->assertSame(2, $matches[0]['session_count']);
        $this->assertSame('linked', $matches[0]['doctor_link_status']);
    }

    /**
     * A legacy session (no doctor_id) can't be matched against anything —
     * it must always survive as its own row, never silently dropped, and
     * flagged so the frontend can render it distinctly.
     */
    public function testLegacySessionWithNoDoctorIdStaysItsOwnRow(): void
    {
        $result = $this->repo->neverOpenedDoctors($this->fx['rep_id'], [], 1);

        $matches = array_values(array_filter(
            $result['items'],
            fn (array $row) => $row['doctor_link_status'] === 'legacy'
        ));

        $this->assertCount(1, $matches);
        $this->assertNull($matches[0]['doctor_id']);
        $this->assertSame('Legacy Snapshot Doc', $matches[0]['doctor_name']);
        $this->assertSame(1, $matches[0]['session_count']);
    }

    /**
     * A doctor whose only session WAS opened by the doctor must never
     * appear in the never-opened list.
     */
    public function testDoctorWhoOpenedTheirSessionDoesNotAppear(): void
    {
        $result = $this->repo->neverOpenedDoctors($this->fx['rep_id'], [], 1);

        $doctorIds = array_column($result['items'], 'doctor_id');
        $this->assertNotContains($this->fx['doctor_opened_id'], $doctorIds);
    }

    /**
     * The non-negotiable invariant: the summary card's count and this
     * table's total must never disagree, for identical filters — both use
     * the same COALESCE(doctor_id, -id) dedup key over the same base
     * predicate.
     */
    public function testTotalMatchesSummaryDoctorsNeverOpenedCard(): void
    {
        $summary = $this->repo->summary($this->fx['rep_id'], []);
        $result = $this->repo->neverOpenedDoctors($this->fx['rep_id'], [], 1);

        // 4 distinct never-opened doctors expected: A, B (same name,
        // different id), C (deduped from 2 sessions), legacy.
        $this->assertSame(4, $summary['doctors_never_opened']);
        $this->assertSame($summary['doctors_never_opened'], $result['total']);
    }

    public function testPageSizeMatchesMetricsPaginationConfig(): void
    {
        $result = $this->repo->neverOpenedDoctors($this->fx['rep_id'], [], 1);

        $this->assertSame(\App\Infrastructure\Config\MetricsPaginationConfig::PAGE_SIZE, $result['per_page']);
    }

    // ===================================================================
    // Helpers
    // ===================================================================

    private function findByDoctorId(array $items, int $doctorId): ?array
    {
        foreach ($items as $row) {
            if ($row['doctor_id'] === $doctorId) {
                return $row;
            }
        }
        return null;
    }

    private function createFixtures(): array
    {
        $suffix = uniqid('never_opened_dedup_', true);

        $orgId = $this->insertOrganization("Test Org {$suffix}");
        $repId = $this->insertUser($orgId, 'rep', "rep_{$suffix}@test.local", 'Rep One');

        // A and B: two DIFFERENT doctors sharing the exact same name.
        $doctorAId = $this->insertDoctor($orgId, 'Dr. Juan Perez');
        $doctorBId = $this->insertDoctor($orgId, 'Dr. Juan Perez');
        // C: one doctor with 2 never-opened sessions (must collapse to 1 row).
        $doctorCId = $this->insertDoctor($orgId, 'Dr. Maria Gonzalez');
        // Doctor whose session WAS opened — must never appear.
        $doctorOpenedId = $this->insertDoctor($orgId, 'Dr. Opened Everything');

        $sessionAId = $this->insertVisitSession($orgId, $repId, "token_a_{$suffix}", $doctorAId, 'Dr. Juan Perez');
        $sessionBId = $this->insertVisitSession($orgId, $repId, "token_b_{$suffix}", $doctorBId, 'Dr. Juan Perez');
        $sessionC1Id = $this->insertVisitSession($orgId, $repId, "token_c1_{$suffix}", $doctorCId, 'Dr. Maria Gonzalez');
        $sessionC2Id = $this->insertVisitSession($orgId, $repId, "token_c2_{$suffix}", $doctorCId, 'Dr. Maria Gonzalez');
        $sessionLegacyId = $this->insertVisitSession($orgId, $repId, "token_legacy_{$suffix}", null, 'Legacy Snapshot Doc');
        $sessionOpenedId = $this->insertVisitSession($orgId, $repId, "token_opened_{$suffix}", $doctorOpenedId, 'Dr. Opened Everything');

        // No material needed to prove "never opened" (NOT EXISTS on
        // material_views doesn't require visit_session_materials rows),
        // but the "opened" fixture needs one real doctor view row.
        $managerId = $this->insertUser($orgId, 'manager', "manager_{$suffix}@test.local", 'Manager');
        $brandId = $this->insertBrand($orgId, "Brand {$suffix}");
        $materialId = $this->insertMaterial($orgId, $brandId, $managerId, "Material {$suffix}");
        $viewOpenedId = $this->insertMaterialView($materialId, $sessionOpenedId, 'doctor');

        return [
            'org_id' => $orgId,
            'rep_id' => $repId,
            'manager_id' => $managerId,
            'brand_id' => $brandId,
            'material_id' => $materialId,
            'doctor_a_id' => $doctorAId,
            'doctor_b_id' => $doctorBId,
            'doctor_c_id' => $doctorCId,
            'doctor_opened_id' => $doctorOpenedId,
            'session_a_id' => $sessionAId,
            'session_b_id' => $sessionBId,
            'session_c1_id' => $sessionC1Id,
            'session_c2_id' => $sessionC2Id,
            'session_legacy_id' => $sessionLegacyId,
            'session_opened_id' => $sessionOpenedId,
            'view_opened_id' => $viewOpenedId,
        ];
    }

    private function destroyFixtures(array $fx): void
    {
        if (empty($fx)) {
            return;
        }

        $this->deleteWhereIn('material_views', 'id', [$fx['view_opened_id']]);
        $this->deleteWhereIn('visit_sessions', 'id', [
            $fx['session_a_id'], $fx['session_b_id'], $fx['session_c1_id'],
            $fx['session_c2_id'], $fx['session_legacy_id'], $fx['session_opened_id'],
        ]);
        $this->deleteWhereIn('doctors', 'id', [
            $fx['doctor_a_id'], $fx['doctor_b_id'], $fx['doctor_c_id'], $fx['doctor_opened_id'],
        ]);
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

    private function insertMaterialView(int $materialId, ?int $sessionId, string $viewerType): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO material_views (material_id, visit_session_id, viewer_type, opened_at)
             VALUES (:material_id, :session_id, :viewer_type, NOW())'
        );
        $stmt->execute([
            ':material_id' => $materialId,
            ':session_id' => $sessionId,
            ':viewer_type' => $viewerType,
        ]);
        return (int) $this->pdo->lastInsertId();
    }
}
