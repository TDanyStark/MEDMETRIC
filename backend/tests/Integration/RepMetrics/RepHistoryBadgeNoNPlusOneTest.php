<?php

declare(strict_types=1);

namespace Tests\Integration\RepMetrics;

use App\Infrastructure\Database\Connection;
use App\Infrastructure\Persistence\VisitSession\DbVisitSessionRepository;
use PDO;
use Tests\TestCase;

/**
 * Real-DB regression/coverage test for sdd/rep-metrics-module task 6.3:
 * "badge query (3.1) executes exactly 1 query (assert no N+1)". Previously
 * only "structurally guaranteed" by code inspection (single SQL statement,
 * no loop around execute()) — committed here as an automated PHPUnit test
 * using MySQL's own `Com_select` session status counter so a future
 * regression (e.g. someone adding a per-row query to resolve the "viewed"
 * badge) fails CI instead of silently degrading production performance.
 *
 * Strategy: seed TWO different row counts (3 sessions, then 9 sessions —
 * a 3x difference) for the SAME rep and assert `Com_select` increases by
 * the SAME small constant for both calls. If the implementation had a
 * per-row query, the 9-session call would show a proportionally larger
 * delta than the 3-session call — this test would fail immediately.
 */
class RepHistoryBadgeNoNPlusOneTest extends TestCase
{
    private PDO $pdo;
    private DbVisitSessionRepository $repo;
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
        $this->repo = new DbVisitSessionRepository();
    }

    protected function tearDown(): void
    {
        if (!empty($this->fx)) {
            $this->destroyFixtures($this->fx);
        }
    }

    public function testFindAllByRepQueryCountIsIndependentOfRowCount(): void
    {
        // --- Small batch: 3 sessions, mixed viewed/unviewed ---
        $this->fx = $this->createFixtures(3);
        $deltaSmall = $this->comSelectDelta(function () {
            $this->repo->findAllByRep($this->fx['rep_id'], 1);
        });
        $this->destroyFixtures($this->fx);

        // --- Large batch: 9 sessions (3x), mixed viewed/unviewed ---
        $this->fx = $this->createFixtures(9);
        $deltaLarge = $this->comSelectDelta(function () {
            $this->repo->findAllByRep($this->fx['rep_id'], 1);
        });

        $this->assertSame(
            $deltaSmall,
            $deltaLarge,
            "findAllByRep() issued a different number of SELECT statements for 3 vs 9 rows " .
            "({$deltaSmall} vs {$deltaLarge}) — this indicates a per-row (N+1) query was introduced."
        );

        // The method itself contains exactly 2 top-level SELECTs (COUNT +
        // the main batched query) — assert the observed constant matches
        // that, with a little headroom for driver-level housekeeping.
        $this->assertLessThanOrEqual(3, $deltaLarge, 'expected ~2 SELECTs (count + main query), got ' . $deltaLarge);
        $this->assertGreaterThanOrEqual(2, $deltaLarge);
    }

    public function testFindAllByRepStillReturnsCorrectViewedBadgeData(): void
    {
        $this->fx = $this->createFixtures(3);

        $result = $this->repo->findAllByRep($this->fx['rep_id'], 1);

        $this->assertSame(3, $result['total']);
        $byId = [];
        foreach ($result['items'] as $item) {
            $byId[$item['id']] = $item;
        }

        // Session 0 has 1 doctor view -> viewed=true, open_count=1.
        $this->assertTrue($byId[$this->fx['session_ids'][0]]['viewed']);
        $this->assertSame(1, $byId[$this->fx['session_ids'][0]]['open_count']);

        // Session 1 has 0 doctor views -> viewed=false, open_count=0.
        $this->assertFalse($byId[$this->fx['session_ids'][1]]['viewed']);
        $this->assertSame(0, $byId[$this->fx['session_ids'][1]]['open_count']);
    }

    /**
     * Run $callback and return the delta of MySQL's session-level
     * `Com_select` status counter (number of SELECT statements executed),
     * isolating it from the 2 `SHOW SESSION STATUS` calls themselves.
     */
    private function comSelectDelta(callable $callback): int
    {
        $before = $this->comSelectCount();
        $callback();
        $after = $this->comSelectCount();

        return $after - $before;
    }

    private function comSelectCount(): int
    {
        $stmt = $this->pdo->query("SHOW SESSION STATUS LIKE 'Com_select'");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int) $row['Value'];
    }

    private function createFixtures(int $sessionCount): array
    {
        $suffix = uniqid('badge_n1_', true);

        $orgId = $this->insertOrganization("Test Org {$suffix}");
        $managerId = $this->insertUser($orgId, 'manager', "manager_{$suffix}@test.local", 'Manager');
        $repId = $this->insertUser($orgId, 'rep', "rep_{$suffix}@test.local", 'Rep');
        $brandId = $this->insertBrand($orgId, "Brand {$suffix}");
        $materialId = $this->insertMaterial($orgId, $brandId, $managerId, "Material {$suffix}");

        $sessionIds = [];
        $viewIds = [];
        for ($i = 0; $i < $sessionCount; $i++) {
            $sessionId = $this->insertVisitSession($orgId, $repId, "token_{$suffix}_{$i}");
            $sessionIds[] = $sessionId;

            // Every other session gets a doctor view; the rest stay unviewed.
            if ($i % 2 === 0) {
                $viewIds[] = $this->insertMaterialView($materialId, $sessionId, 'doctor', null);
            }
        }

        return [
            'org_id' => $orgId,
            'manager_id' => $managerId,
            'rep_id' => $repId,
            'brand_id' => $brandId,
            'material_id' => $materialId,
            'session_ids' => $sessionIds,
            'view_ids' => $viewIds,
        ];
    }

    private function destroyFixtures(array $fx): void
    {
        $this->deleteWhereIn('material_views', 'id', $fx['view_ids']);
        $this->deleteWhereIn('visit_sessions', 'id', $fx['session_ids']);
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
