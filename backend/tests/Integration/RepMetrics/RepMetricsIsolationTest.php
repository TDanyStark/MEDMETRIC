<?php

declare(strict_types=1);

namespace Tests\Integration\RepMetrics;

use App\Infrastructure\Database\Connection;
use App\Infrastructure\Persistence\RepMetrics\DbRepMetricsRepository;
use PDO;
use Tests\TestCase;

/**
 * Real-DB regression/coverage test for sdd/rep-metrics-module tasks 6.2:
 * "rep A cannot see rep B's data, including query-param manipulation
 * (?rep_id=, session_id=)". Previously only verified manually against
 * seeded dev data (see apply-progress Batch 2) — committed here as an
 * automated PHPUnit test so the invariant is enforced going forward.
 *
 * Exercises the ACTUAL DbRepMetricsRepository SQL (not a mock) against two
 * real reps (A and B), each with their own visit_sessions + doctor
 * material_views, in the SAME organization (the harder case: isolation
 * must hold even within one org, not just across orgs).
 *
 * Fixtures are raw INSERTs against the live PDO connection, removed by
 * exact primary key in tearDown() — same pattern as
 * tests/Integration/Metrics/MetricsRepAttributionTest.php.
 */
class RepMetricsIsolationTest extends TestCase
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

    public function testSummaryForRepAExcludesRepBSessions(): void
    {
        $summary = $this->repo->summary($this->fx['rep_a_id'], []);

        // Rep A has exactly 1 session (1 viewed, 0 unviewed) seeded below.
        $this->assertSame(1, $summary['sessions_total'], 'must not include rep B\'s 1 session');
        $this->assertSame(1, $summary['sessions_viewed']);
    }

    public function testSessionsListForRepAIgnoresRepIdQueryParamWideningToRepB(): void
    {
        // Even if a caller somehow got a `rep_id` filter through to the
        // repository layer, the interface signature has NO such filter key
        // at all — repId is always the first, non-filterable, positional
        // argument. This proves the repository-level scope predicate
        // itself (`vs.rep_id = :rep`) is what enforces isolation, not
        // Action-layer filtering.
        $result = $this->repo->sessions($this->fx['rep_a_id'], ['rep_id' => $this->fx['rep_b_id']], 1);

        $this->assertSame(1, $result['total']);
        $this->assertCount(1, $result['items']);
        $this->assertSame($this->fx['session_a_id'], $result['items'][0]['id']);
    }

    public function testSessionsListForRepACannotReachRepBsSessionIdViaFilter(): void
    {
        // Rep A queries a session_id that actually belongs to rep B — must
        // yield an EMPTY page, never rep B's row and never a 500 (spec
        // "Rep Data Isolation" — "Manipulación de query param").
        $result = $this->repo->sessions(
            $this->fx['rep_a_id'],
            ['session_id' => $this->fx['session_b_id']],
            1
        );

        $this->assertSame(0, $result['total']);
        $this->assertSame([], $result['items']);
    }

    public function testSessionsListForRepACannotReachRepBsMaterialIdViaFilter(): void
    {
        $result = $this->repo->sessions(
            $this->fx['rep_a_id'],
            ['material_id' => $this->fx['material_b_id']],
            1
        );

        $this->assertSame(0, $result['total']);
        $this->assertSame([], $result['items']);
    }

    public function testOpenTrendForRepADoesNotCountRepBsViews(): void
    {
        $trend = $this->repo->openTrend($this->fx['rep_a_id'], []);
        $totalCreated = array_sum(array_column($trend, 'sessions_created'));
        $totalViewed = array_sum(array_column($trend, 'sessions_viewed'));

        $this->assertSame(1, $totalCreated, 'rep B\'s session must not be counted for rep A');
        $this->assertSame(1, $totalViewed);
    }

    public function testHourHistogramForRepADoesNotCountRepBsViews(): void
    {
        $histogram = $this->repo->hourHistogram($this->fx['rep_a_id'], []);
        $this->assertCount(24, $histogram);

        $totalOpens = array_sum(array_column($histogram, 'opens'));
        // Rep A has exactly 1 doctor view seeded; rep B's doctor view must
        // never leak into rep A's histogram.
        $this->assertSame(1, $totalOpens);
    }

    public function testDeviceSplitForRepADoesNotCountRepBsViews(): void
    {
        $split = $this->repo->deviceSplit($this->fx['rep_a_id'], []);
        $this->assertSame(1, $split['mobile'] + $split['desktop']);
    }

    public function testTopMaterialsForRepADoesNotIncludeRepBsMaterial(): void
    {
        $result = $this->repo->topMaterials($this->fx['rep_a_id'], [], 1);

        $ids = array_column($result['items'], 'id');
        $this->assertContains($this->fx['material_a_id'], $ids);
        $this->assertNotContains($this->fx['material_b_id'], $ids, 'rep B\'s material must not appear in rep A\'s top-materials list');
    }

    public function testUnopenedMaterialsForRepAOnlyReturnsRepAsUnopenedMaterial(): void
    {
        // Rep A has exactly 1 unopened (session, material) pair seeded
        // below: material_a2 (material_a itself WAS opened by the doctor
        // fixture view, so it must not appear here).
        $result = $this->repo->unopenedMaterials($this->fx['rep_a_id'], [], 1);

        $this->assertSame(1, $result['total']);
        $this->assertCount(1, $result['items']);
        $this->assertSame($this->fx['material_a2_id'], $result['items'][0]['material_id']);
        $this->assertSame($this->fx['session_a_id'], $result['items'][0]['session_id']);
        $this->assertArrayNotHasKey('user_agent', $result['items'][0]);
    }

    public function testUnopenedMaterialsForRepACannotSeeRepBsUnopenedMaterial(): void
    {
        $result = $this->repo->unopenedMaterials($this->fx['rep_a_id'], [], 1);

        $ids = array_column($result['items'], 'material_id');
        $this->assertNotContains(
            $this->fx['material_b2_id'],
            $ids,
            'rep B\'s unopened material must not appear in rep A\'s unopened-materials list'
        );
    }

    public function testUnopenedMaterialsPageSizeMatchesMetricsPaginationConfig(): void
    {
        $result = $this->repo->unopenedMaterials($this->fx['rep_a_id'], [], 1);

        $this->assertSame(\App\Infrastructure\Config\MetricsPaginationConfig::PAGE_SIZE, $result['per_page']);
    }

    public function testUnopenedMaterialsTotalMatchesSummaryMaterialsUnopenedForRepA(): void
    {
        // The card-vs-table match invariant (spec "Materiales sin abrir
        // cuadra con la tarjeta"): both must derive from the identical
        // base predicate and disagree on nothing.
        $summary = $this->repo->summary($this->fx['rep_a_id'], []);
        $unopened = $this->repo->unopenedMaterials($this->fx['rep_a_id'], [], 1);

        $this->assertSame($summary['materials_unopened'], $unopened['total']);
    }

    // ===================================================================
    // Fixtures — two reps (A, B) in the SAME organization, each with 1
    // visit_session + 1 material + 1 doctor view.
    // ===================================================================

    private function createFixtures(): array
    {
        $suffix = uniqid('rep_metrics_iso_', true);

        $orgId = $this->insertOrganization("Test Org {$suffix}");
        $managerId = $this->insertUser($orgId, 'manager', "manager_{$suffix}@test.local", 'Manager');
        $repAId = $this->insertUser($orgId, 'rep', "repa_{$suffix}@test.local", 'Rep A');
        $repBId = $this->insertUser($orgId, 'rep', "repb_{$suffix}@test.local", 'Rep B');
        $brandId = $this->insertBrand($orgId, "Brand {$suffix}");

        $materialAId = $this->insertMaterial($orgId, $brandId, $managerId, "Material A {$suffix}");
        $materialBId = $this->insertMaterial($orgId, $brandId, $managerId, "Material B {$suffix}");
        // A2/B2: a SECOND material per rep, added to the SAME session as
        // A/B but deliberately given NO material_views row — this is the
        // "unopened" fixture for testUnopenedMaterials* below.
        $materialA2Id = $this->insertMaterial($orgId, $brandId, $managerId, "Material A2 (unopened) {$suffix}");
        $materialB2Id = $this->insertMaterial($orgId, $brandId, $managerId, "Material B2 (unopened) {$suffix}");

        $sessionAId = $this->insertVisitSession($orgId, $repAId, "token_a_{$suffix}");
        $sessionBId = $this->insertVisitSession($orgId, $repBId, "token_b_{$suffix}");

        $vsmAId = $this->insertVisitSessionMaterial($sessionAId, $materialAId);
        $vsmBId = $this->insertVisitSessionMaterial($sessionBId, $materialBId);
        $vsmA2Id = $this->insertVisitSessionMaterial($sessionAId, $materialA2Id);
        $vsmB2Id = $this->insertVisitSessionMaterial($sessionBId, $materialB2Id);

        $viewAId = $this->insertMaterialView($materialAId, $sessionAId, 'doctor', null, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148');
        $viewBId = $this->insertMaterialView($materialBId, $sessionBId, 'doctor', null, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0');

        return [
            'org_id' => $orgId,
            'manager_id' => $managerId,
            'rep_a_id' => $repAId,
            'rep_b_id' => $repBId,
            'brand_id' => $brandId,
            'material_a_id' => $materialAId,
            'material_b_id' => $materialBId,
            'material_a2_id' => $materialA2Id,
            'material_b2_id' => $materialB2Id,
            'session_a_id' => $sessionAId,
            'session_b_id' => $sessionBId,
            'vsm_a_id' => $vsmAId,
            'vsm_b_id' => $vsmBId,
            'vsm_a2_id' => $vsmA2Id,
            'vsm_b2_id' => $vsmB2Id,
            'view_a_id' => $viewAId,
            'view_b_id' => $viewBId,
        ];
    }

    private function destroyFixtures(array $fx): void
    {
        if (empty($fx)) {
            return;
        }

        $this->deleteWhereIn('material_views', 'id', [$fx['view_a_id'], $fx['view_b_id']]);
        $this->deleteWhereIn('visit_session_materials', 'id', [
            $fx['vsm_a_id'], $fx['vsm_b_id'], $fx['vsm_a2_id'] ?? null, $fx['vsm_b2_id'] ?? null,
        ]);
        $this->deleteWhereIn('visit_sessions', 'id', [$fx['session_a_id'], $fx['session_b_id']]);
        $this->deleteWhereIn('materials', 'id', [
            $fx['material_a_id'], $fx['material_b_id'], $fx['material_a2_id'] ?? null, $fx['material_b2_id'] ?? null,
        ]);
        $this->deleteWhereIn('brands', 'id', [$fx['brand_id']]);
        $this->deleteWhereIn('users', 'id', [$fx['manager_id'], $fx['rep_a_id'], $fx['rep_b_id']]);
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

    private function insertVisitSession(int $organizationId, int $repId, string $token): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO visit_sessions (organization_id, rep_id, doctor_token, doctor_name, active)
             VALUES (:org_id, :rep_id, :token, :doctor_name, 1)'
        );
        $stmt->execute([
            ':org_id' => $organizationId,
            ':rep_id' => $repId,
            ':token' => $token,
            ':doctor_name' => 'Test Doctor',
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertVisitSessionMaterial(int $sessionId, int $materialId): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO visit_session_materials (visit_session_id, material_id) VALUES (:session_id, :material_id)'
        );
        $stmt->execute([':session_id' => $sessionId, ':material_id' => $materialId]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertMaterialView(int $materialId, ?int $sessionId, string $viewerType, ?int $viewerId, string $userAgent): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO material_views (material_id, visit_session_id, viewer_type, viewer_id, user_agent, opened_at)
             VALUES (:material_id, :session_id, :viewer_type, :viewer_id, :user_agent, NOW())'
        );
        $stmt->execute([
            ':material_id' => $materialId,
            ':session_id' => $sessionId,
            ':viewer_type' => $viewerType,
            ':viewer_id' => $viewerId,
            ':user_agent' => $userAgent,
        ]);
        return (int) $this->pdo->lastInsertId();
    }
}
