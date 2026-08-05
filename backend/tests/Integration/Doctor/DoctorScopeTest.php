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
 * Phase 2 (T2.3) — real-DB, real-route regression test for
 * sdd/doctors-management-fixes/spec §"Server-Enforced Rep Doctor Scoping".
 *
 * Exercises the ACTUAL DbDoctorRepository SQL (restrictRepId filter/guard),
 * not a mock — this is the failure surface the Unit/Actions/Doctor tests
 * cannot reach (query wiring, ON DUPLICATE/JOIN correctness, real
 * DoctorNotFoundException -> HTTP 404 mapping through the Slim error
 * handler). Fixtures are raw INSERTs against the live PDO connection and
 * removed by exact primary key in tearDown() (same pattern as
 * CommentActionsTest / OrganizationActionsTest).
 */
class DoctorScopeTest extends TestCase
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
    // GET /v1/doctors — rep sees only own doctors, forged assigned_rep_id
    // is ignored/overridden.
    // -----------------------------------------------------------------
    public function testRepListOnlySeesOwnDoctorsWithForgedRepIdParam(): void
    {
        $app = $this->appInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['rep1_id'],
            'email' => 'rep1@test.local',
            'name' => 'Rep One',
            'role' => 'rep',
            'organization_id' => $this->fx['org_id'],
        ]);

        // Forge assigned_rep_id to R2 — must be silently overridden by R1's own id.
        $request = $this->authedRequest($app, 'GET', '/v1/doctors', $token, [
            'assigned_rep_id' => (string) $this->fx['rep2_id'],
        ]);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $ids = array_column($payload['data']['items'], 'id');
        $this->assertContains($this->fx['doctor1_id'], $ids);
        $this->assertNotContains($this->fx['doctor2_id'], $ids, 'Rep must never see another rep\'s doctor, even via forged assigned_rep_id');
    }

    // -----------------------------------------------------------------
    // GET /v1/doctors/search — same guarantee on the typeahead endpoint.
    // -----------------------------------------------------------------
    public function testRepSearchOnlyMatchesOwnDoctors(): void
    {
        $app = $this->appInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['rep1_id'],
            'email' => 'rep1@test.local',
            'name' => 'Rep One',
            'role' => 'rep',
            'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'GET', '/v1/doctors/search', $token, ['q' => '']);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $ids = array_column($payload['data'], 'id');
        $this->assertContains($this->fx['doctor1_id'], $ids);
        $this->assertNotContains($this->fx['doctor2_id'], $ids);
    }

    // -----------------------------------------------------------------
    // PUT /v1/doctors/{id} — R1 editing R2's doctor -> 404, no persist.
    // -----------------------------------------------------------------
    public function testRepCannotUpdateAnotherRepsDoctor(): void
    {
        $app = $this->appInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['rep1_id'],
            'email' => 'rep1@test.local',
            'name' => 'Rep One',
            'role' => 'rep',
            'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/' . $this->fx['doctor2_id'], $token)
            ->withParsedBody(['name' => 'Hijacked name', 'assigned_rep_id' => $this->fx['rep1_id']]);
        $response = $app->handle($request);

        $this->assertEquals(404, $response->getStatusCode());

        // No persist: doctor2's name and owner are untouched.
        $stmt = $this->pdo->prepare('SELECT name, assigned_rep_id FROM doctors WHERE id = :id');
        $stmt->execute([':id' => $this->fx['doctor2_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $this->assertSame('Doctor Two', $row['name']);
        $this->assertSame($this->fx['rep2_id'], (int) $row['assigned_rep_id']);
    }

    // -----------------------------------------------------------------
    // Rep CAN update their own doctor, and a forged assigned_rep_id in the
    // payload is stripped (ownership cannot be reassigned via the payload).
    // -----------------------------------------------------------------
    public function testRepCanUpdateOwnDoctorButCannotReassignOwnership(): void
    {
        $app = $this->appInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['rep1_id'],
            'email' => 'rep1@test.local',
            'name' => 'Rep One',
            'role' => 'rep',
            'organization_id' => $this->fx['org_id'],
        ]);

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/' . $this->fx['doctor1_id'], $token)
            ->withParsedBody(['name' => 'Doctor One Updated', 'assigned_rep_id' => $this->fx['rep2_id']]);
        $response = $app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());

        $stmt = $this->pdo->prepare('SELECT name, assigned_rep_id FROM doctors WHERE id = :id');
        $stmt->execute([':id' => $this->fx['doctor1_id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $this->assertSame('Doctor One Updated', $row['name'], 'Own-doctor edit must succeed');
        $this->assertSame($this->fx['rep1_id'], (int) $row['assigned_rep_id'], 'Ownership must NOT change via a forged assigned_rep_id in the payload');
    }

    // -----------------------------------------------------------------
    // org_admin/manager unaffected — both see the full org doctor list.
    // -----------------------------------------------------------------
    public function testOrgAdminAndManagerSeeAllOrgDoctors(): void
    {
        $app = $this->getAppInstance();

        foreach (['org_admin', 'manager'] as $role) {
            $userId = $role === 'org_admin' ? $this->fx['org_admin_id'] : $this->fx['manager_id'];
            $token = $this->jwtFor($app, [
                'id' => $userId,
                'email' => "{$role}@test.local",
                'name' => ucfirst($role),
                'role' => $role,
                'organization_id' => $this->fx['org_id'],
            ]);

            $request = $this->authedRequest($app, 'GET', '/v1/doctors', $token, []);
            $response = $app->handle($request);
            $payload = $this->decode($response);

            $this->assertEquals(200, $response->getStatusCode());
            $ids = array_column($payload['data']['items'], 'id');
            $this->assertContains($this->fx['doctor1_id'], $ids, "{$role} must see doctor1");
            $this->assertContains($this->fx['doctor2_id'], $ids, "{$role} must see doctor2");
        }
    }

    // ===================================================================
    // Fixture helpers
    // ===================================================================

    private function createFixtures(): array
    {
        $suffix = uniqid('doc_', true);

        $orgId = $this->insertOrganization("Test Org {$suffix}");
        $orgAdminId = $this->insertUser($orgId, 'org_admin', "org_admin_{$suffix}@test.local", 'Org Admin');
        $managerId = $this->insertUser($orgId, 'manager', "manager_{$suffix}@test.local", 'Manager');
        $rep1Id = $this->insertUser($orgId, 'rep', "rep1_{$suffix}@test.local", 'Rep One');
        $rep2Id = $this->insertUser($orgId, 'rep', "rep2_{$suffix}@test.local", 'Rep Two');

        $doctor1Id = $this->insertDoctor($orgId, 'Doctor One', $rep1Id);
        $doctor2Id = $this->insertDoctor($orgId, 'Doctor Two', $rep2Id);

        return [
            'org_id' => $orgId,
            'org_admin_id' => $orgAdminId,
            'manager_id' => $managerId,
            'rep1_id' => $rep1Id,
            'rep2_id' => $rep2Id,
            'doctor1_id' => $doctor1Id,
            'doctor2_id' => $doctor2Id,
        ];
    }

    private function destroyFixtures(array $fx): void
    {
        if (empty($fx)) {
            return;
        }

        $this->deleteWhereIn('doctors', 'id', [$fx['doctor1_id'], $fx['doctor2_id']]);
        $this->deleteWhereIn('users', 'id', [$fx['org_admin_id'], $fx['manager_id'], $fx['rep1_id'], $fx['rep2_id']]);
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

    private function insertDoctor(int $organizationId, string $name, int $assignedRepId): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO doctors (organization_id, name, assigned_rep_id, active) VALUES (:org_id, :name, :rep_id, 1)'
        );
        $stmt->execute([':org_id' => $organizationId, ':name' => $name, ':rep_id' => $assignedRepId]);
        return (int) $this->pdo->lastInsertId();
    }

    // ===================================================================
    // HTTP / JWT helpers
    // ===================================================================

    /**
     * getAppInstance() (tests/TestCase.php) does not register error-handling
     * middleware (only public/index.php does, for real requests). Without
     * it, DoctorNotFoundException -> HttpNotFoundException thrown from the
     * real DbDoctorRepository::update() ownership guard would bubble up as
     * an uncaught PHP exception instead of the 404 JSON response the API
     * contract promises. Same pattern as the pre-existing ViewUserActionTest
     * not-found case.
     */
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
