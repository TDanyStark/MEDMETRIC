<?php

declare(strict_types=1);

namespace Tests\Integration\Doctor;

use App\Application\Handlers\HttpErrorHandler;
use App\Application\Services\Auth\JwtServiceInterface;
use App\Infrastructure\Database\Connection;
use DI\Container;
use PDO;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Slim\Middleware\ErrorMiddleware;
use Tests\TestCase;

/**
 * Doctor create/edit rep-assignment fix — real-DB, real-route regression
 * test proving RepAccessRepository::isRepAssignable() (exercised through
 * Create/UpdateDoctorAction) correctly scopes assignable representatives:
 *   - org_admin: any 'rep' user in their own organization; a rep belonging
 *     to a DIFFERENT organization must be rejected (422, no persist).
 *   - manager: only reps they are actively subscribed to
 *     (rep_manager_access.active = 1); an in-org but unsubscribed rep must
 *     be rejected (422, no persist).
 *
 * Exercises the ACTUAL DbRepAccessRepository SQL, not a mock — this is the
 * failure surface Unit/Actions/Doctor/{Create,Update}DoctorActionTest cannot
 * reach. Fixtures are raw INSERTs against the live PDO connection and
 * removed by exact primary key in tearDown(), same pattern as DoctorScopeTest.
 */
class DoctorRepAssignmentIntegrationTest extends TestCase
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

    // -----------------------------------------------------------------
    // org_admin: any rep in the SAME organization is assignable.
    // -----------------------------------------------------------------
    public function testOrgAdminCanAssignRepInSameOrg(): void
    {
        $app = $this->appInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['org_admin_id'], 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/' . $this->fx['doctor_id'], $token)
            ->withParsedBody(['assigned_rep_id' => $this->fx['rep1_id']]);
        $response = $app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());

        $stmt = $this->pdo->prepare('SELECT assigned_rep_id FROM doctors WHERE id = :id');
        $stmt->execute([':id' => $this->fx['doctor_id']]);
        $this->assertSame($this->fx['rep1_id'], (int) $stmt->fetchColumn());
    }

    // -----------------------------------------------------------------
    // org_admin: a rep from a DIFFERENT organization must be rejected.
    // -----------------------------------------------------------------
    public function testOrgAdminCannotAssignRepFromDifferentOrg(): void
    {
        $app = $this->appInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['org_admin_id'], 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/' . $this->fx['doctor_id'], $token)
            ->withParsedBody(['assigned_rep_id' => $this->fx['other_org_rep_id']]);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(422, $response->getStatusCode());
        $this->assertArrayHasKey('data', $payload);

        $stmt = $this->pdo->prepare('SELECT assigned_rep_id FROM doctors WHERE id = :id');
        $stmt->execute([':id' => $this->fx['doctor_id']]);
        $this->assertNull($stmt->fetchColumn(), 'Cross-organization assignment must not be persisted');
    }

    // -----------------------------------------------------------------
    // manager: an actively-subscribed rep is assignable.
    // -----------------------------------------------------------------
    public function testManagerCanAssignSubscribedRep(): void
    {
        $app = $this->appInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['manager_id'], 'email' => 'manager@test.local', 'name' => 'Manager',
            'role' => 'manager', 'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/' . $this->fx['doctor_id'], $token)
            ->withParsedBody(['assigned_rep_id' => $this->fx['rep1_id']]);
        $response = $app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());

        $stmt = $this->pdo->prepare('SELECT assigned_rep_id FROM doctors WHERE id = :id');
        $stmt->execute([':id' => $this->fx['doctor_id']]);
        $this->assertSame($this->fx['rep1_id'], (int) $stmt->fetchColumn());
    }

    // -----------------------------------------------------------------
    // manager: an in-org but UNSUBSCRIBED rep must be rejected.
    // -----------------------------------------------------------------
    public function testManagerCannotAssignUnsubscribedRep(): void
    {
        $app = $this->appInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['manager_id'], 'email' => 'manager@test.local', 'name' => 'Manager',
            'role' => 'manager', 'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/' . $this->fx['doctor_id'], $token)
            ->withParsedBody(['assigned_rep_id' => $this->fx['rep2_unsubscribed_id']]);
        $response = $app->handle($request);

        $this->assertEquals(422, $response->getStatusCode());

        $stmt = $this->pdo->prepare('SELECT assigned_rep_id FROM doctors WHERE id = :id');
        $stmt->execute([':id' => $this->fx['doctor_id']]);
        $this->assertNull($stmt->fetchColumn(), 'Unsubscribed-rep assignment must not be persisted');
    }

    // -----------------------------------------------------------------
    // POST /v1/doctors — a valid assigned_rep_id is persisted on create.
    // -----------------------------------------------------------------
    public function testCreateDoctorWithValidRepPersists(): void
    {
        $app = $this->appInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['org_admin_id'], 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'POST', '/v1/doctors', $token)
            ->withParsedBody(['name' => 'Created With Rep', 'assigned_rep_id' => $this->fx['rep1_id']]);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(201, $response->getStatusCode());
        $newId = (int) $payload['data']['id'];

        $stmt = $this->pdo->prepare('SELECT assigned_rep_id FROM doctors WHERE id = :id');
        $stmt->execute([':id' => $newId]);
        $this->assertSame($this->fx['rep1_id'], (int) $stmt->fetchColumn());

        // Cleanup this test's own extra row (not part of shared fixtures).
        $this->deleteWhereIn('doctors', 'id', [$newId]);
    }

    // ===================================================================
    // Fixture helpers
    // ===================================================================

    private function createFixtures(): array
    {
        $suffix = uniqid('docrep_', true);

        $orgId      = $this->insertOrganization("Test Org {$suffix}");
        $otherOrgId = $this->insertOrganization("Other Org {$suffix}");

        $orgAdminId = $this->insertUser($orgId, 'org_admin', "org_admin_{$suffix}@test.local", 'Org Admin');
        $managerId  = $this->insertUser($orgId, 'manager', "manager_{$suffix}@test.local", 'Manager');
        $rep1Id     = $this->insertUser($orgId, 'rep', "rep1_{$suffix}@test.local", 'Rep One');
        $rep2Id     = $this->insertUser($orgId, 'rep', "rep2_{$suffix}@test.local", 'Rep Two Unsubscribed');
        $otherOrgRepId = $this->insertUser($otherOrgId, 'rep', "rep_other_{$suffix}@test.local", 'Rep Other Org');

        // Only rep1 is actively subscribed to the manager; rep2 stays unsubscribed.
        $this->insertRepManagerAccess($managerId, $rep1Id, true);

        $doctorId = $this->insertDoctor($orgId, 'Doctor Fixture');

        return [
            'org_id' => $orgId,
            'other_org_id' => $otherOrgId,
            'org_admin_id' => $orgAdminId,
            'manager_id' => $managerId,
            'rep1_id' => $rep1Id,
            'rep2_unsubscribed_id' => $rep2Id,
            'other_org_rep_id' => $otherOrgRepId,
            'doctor_id' => $doctorId,
        ];
    }

    private function destroyFixtures(array $fx): void
    {
        if (empty($fx)) {
            return;
        }

        $this->deleteWhereIn('doctors', 'id', [$fx['doctor_id']]);
        $this->pdo->prepare('DELETE FROM rep_manager_access WHERE manager_id = :manager_id')
            ->execute([':manager_id' => $fx['manager_id']]);
        $this->deleteWhereIn('users', 'id', [
            $fx['org_admin_id'], $fx['manager_id'], $fx['rep1_id'],
            $fx['rep2_unsubscribed_id'], $fx['other_org_rep_id'],
        ]);
        $this->deleteWhereIn('organizations', 'id', [$fx['org_id'], $fx['other_org_id']]);
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

    private function insertRepManagerAccess(int $managerId, int $repId, bool $active): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO rep_manager_access (rep_id, manager_id, active) VALUES (:rep_id, :manager_id, :active)'
        );
        $stmt->execute([':rep_id' => $repId, ':manager_id' => $managerId, ':active' => $active ? 1 : 0]);
    }

    private function insertDoctor(int $organizationId, string $name): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO doctors (organization_id, name, active) VALUES (:org_id, :name, 1)'
        );
        $stmt->execute([':org_id' => $organizationId, ':name' => $name]);
        return (int) $this->pdo->lastInsertId();
    }

    // ===================================================================
    // HTTP / JWT helpers
    // ===================================================================

    private function appInstance(): App
    {
        $app = $this->getAppInstance();

        $callableResolver = $app->getCallableResolver();
        $responseFactory = $app->getResponseFactory();
        $errorHandler = new HttpErrorHandler($callableResolver, $responseFactory);
        $errorMiddleware = new ErrorMiddleware($callableResolver, $responseFactory, true, false, false);
        $errorMiddleware->setDefaultErrorHandler($errorHandler);
        $app->add($errorMiddleware);

        return $app;
    }

    private function jwtFor(App $app, array $user): string
    {
        /** @var Container $container */
        $container = $app->getContainer();
        return $container->get(JwtServiceInterface::class)->generate($user);
    }

    private function authedRequest(App $app, string $method, string $path, string $bearerToken): Request
    {
        return $this->createRequest($method, $path, [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $bearerToken,
        ]);
    }

    private function decode(\Psr\Http\Message\ResponseInterface $response): array
    {
        return json_decode((string) $response->getBody(), true) ?? [];
    }
}
