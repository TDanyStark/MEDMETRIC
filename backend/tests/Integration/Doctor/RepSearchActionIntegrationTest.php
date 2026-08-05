<?php

declare(strict_types=1);

namespace Tests\Integration\Doctor;

use App\Application\Services\Auth\JwtServiceInterface;
use App\Infrastructure\Database\Connection;
use DI\Container;
use PDO;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Tests\TestCase;

/**
 * Phase 4 (T4.2) — real-DB, real-route test for GET /v1/doctors/reps/search
 * per sdd/doctors-management-fixes/spec §"Role-Aware Representative Search
 * Endpoint". Exercises the actual DbRepAccessRepository SQL, in particular
 * confirming `rep_manager_access.active = 1` is the correct "subscribed"
 * predicate for a manager's rep search (resolves the design's open
 * question — verified directly against getAvailableRepsForManager()'s
 * existing inverse predicate `rma.id IS NULL OR rma.active = 0`, and here
 * against real rows with both active states).
 */
class RepSearchActionIntegrationTest extends TestCase
{
    private PDO $pdo;
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
        $this->fx = $this->createFixtures();
    }

    protected function tearDown(): void
    {
        $this->destroyFixtures($this->fx);
    }

    public function testOrgAdminSeesAllOrgReps(): void
    {
        $app = $this->getAppInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['org_admin_id'],
            'email' => 'org_admin@test.local',
            'name' => 'Org Admin',
            'role' => 'org_admin',
            'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'GET', '/v1/doctors/reps/search', $token, []);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $ids = array_column($payload['data'], 'id');
        $this->assertContains($this->fx['rep_subscribed_id'], $ids);
        $this->assertContains($this->fx['rep_unsubscribed_id'], $ids, 'org_admin sees ALL org reps regardless of subscription state');
    }

    public function testManagerSeesOnlySubscribedActiveReps(): void
    {
        $app = $this->getAppInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['manager_id'],
            'email' => 'manager@test.local',
            'name' => 'Manager',
            'role' => 'manager',
            'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'GET', '/v1/doctors/reps/search', $token, []);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $ids = array_column($payload['data'], 'id');
        $this->assertContains($this->fx['rep_subscribed_id'], $ids, 'manager must see the actively-subscribed rep');
        $this->assertNotContains($this->fx['rep_unsubscribed_id'], $ids, 'manager must NOT see the (active=0) unsubscribed rep');
    }

    public function testRepIsDenied(): void
    {
        $app = $this->getAppInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['rep_subscribed_id'],
            'email' => 'rep_subscribed@test.local',
            'name' => 'Subscribed Rep',
            'role' => 'rep',
            'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'GET', '/v1/doctors/reps/search', $token, []);
        $response = $app->handle($request);

        $this->assertEquals(403, $response->getStatusCode());
    }

    // ===================================================================
    // Fixture helpers
    // ===================================================================

    private function createFixtures(): array
    {
        $suffix = uniqid('reps_', true);

        $orgId = $this->insertOrganization("Test Org {$suffix}");
        $orgAdminId = $this->insertUser($orgId, 'org_admin', "org_admin_{$suffix}@test.local", 'Org Admin');
        $managerId = $this->insertUser($orgId, 'manager', "manager_{$suffix}@test.local", 'Manager');
        $repSubscribedId = $this->insertUser($orgId, 'rep', "rep_subscribed_{$suffix}@test.local", 'Subscribed Rep');
        $repUnsubscribedId = $this->insertUser($orgId, 'rep', "rep_unsubscribed_{$suffix}@test.local", 'Unsubscribed Rep');

        $this->insertRepAccess($managerId, $repSubscribedId, true);
        $this->insertRepAccess($managerId, $repUnsubscribedId, false);

        return [
            'org_id' => $orgId,
            'org_admin_id' => $orgAdminId,
            'manager_id' => $managerId,
            'rep_subscribed_id' => $repSubscribedId,
            'rep_unsubscribed_id' => $repUnsubscribedId,
        ];
    }

    private function destroyFixtures(array $fx): void
    {
        if (empty($fx)) {
            return;
        }

        $this->deleteWhereIn('rep_manager_access', 'manager_id', [$fx['manager_id']]);
        $this->deleteWhereIn('users', 'id', [
            $fx['org_admin_id'], $fx['manager_id'], $fx['rep_subscribed_id'], $fx['rep_unsubscribed_id'],
        ]);
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

    private function insertRepAccess(int $managerId, int $repId, bool $active): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO rep_manager_access (rep_id, manager_id, active) VALUES (:rep_id, :manager_id, :active)'
        );
        $stmt->execute([':rep_id' => $repId, ':manager_id' => $managerId, ':active' => $active ? 1 : 0]);
    }

    // ===================================================================
    // HTTP / JWT helpers
    // ===================================================================

    private function jwtFor(App $app, array $user): string
    {
        /** @var Container $container */
        $container = $app->getContainer();
        return $container->get(JwtServiceInterface::class)->generate($user);
    }

    private function authedRequest(App $app, string $method, string $path, string $bearerToken, array $queryParams = []): Request
    {
        $request = $this->createRequest($method, $path, [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $bearerToken,
        ]);

        if (!empty($queryParams)) {
            $request = $request->withUri($request->getUri()->withQuery(http_build_query($queryParams)));
        }

        return $request;
    }

    private function decode(\Psr\Http\Message\ResponseInterface $response): array
    {
        return json_decode((string) $response->getBody(), true) ?? [];
    }
}
