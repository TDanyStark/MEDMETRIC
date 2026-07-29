<?php

declare(strict_types=1);

namespace Tests\Application\Actions\Organization;

use App\Application\Services\Auth\JwtServiceInterface;
use App\Infrastructure\Database\Connection;
use DI\Container;
use PDO;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Tests\TestCase;

/**
 * org-timezone Phase 4 — Action-layer regression tests for the
 * organization timezone API surface:
 *   - GET  /v1/timezones                  (curated allow-list)
 *   - POST /v1/superadmin/organizations    (+timezone validation)
 *   - PUT  /v1/superadmin/organizations/:id (+timezone validation)
 *   - GET  /v1/org-admin/organization      (own org, self-scoped)
 *   - PUT  /v1/org-admin/organization      (own org ONLY, self-scoped)
 */
class OrganizationActionsTest extends TestCase
{
    private PDO $pdo;
    private static bool $envLoaded = false;

    /** @var array<string,mixed> */
    private array $fx = [];

    protected function setUp(): void
    {
        if (!self::$envLoaded) {
            $dotenv = \Dotenv\Dotenv::createImmutable(__DIR__ . '/../../../..');
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
    // GET /v1/timezones — curated allow-list, available to any
    // authenticated role.
    // -----------------------------------------------------------------
    public function testListTimezonesReturnsCuratedZones(): void
    {
        $app = $this->getAppInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['rep_a_id'],
            'email' => 'rep_a@test.local',
            'name' => 'Rep A',
            'role' => 'rep',
            'organization_id' => $this->fx['org_a_id'],
        ]);

        $request = $this->authedRequest($app, 'GET', '/v1/timezones', $token);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertTrue($payload['success']);
        $this->assertContains('America/Santiago', $payload['data']);
        $this->assertContains('America/Bogota', $payload['data']);
    }

    // -----------------------------------------------------------------
    // (a) Invalid timezone REJECTED on create (superadmin).
    // -----------------------------------------------------------------
    public function testCreateOrganizationRejectsInvalidTimezone(): void
    {
        $app = $this->getAppInstance();
        $token = $this->superadminToken($app);

        $request = $this->authedRequest($app, 'POST', '/v1/superadmin/organizations', $token)
            ->withParsedBody([
                'name' => 'Bogus TZ Org ' . uniqid('', true),
                'timezone' => 'Mars/Olympus_Mons',
            ]);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(422, $response->getStatusCode());
        $this->assertFalse($payload['success']);
        $this->assertSame('VALIDATION_ERROR', $payload['error']['type']);

        // Sanity: no organization row was created with that bogus name.
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM organizations WHERE timezone = :tz');
        $stmt->execute([':tz' => 'Mars/Olympus_Mons']);
        $this->assertSame(0, (int) $stmt->fetchColumn());
    }

    // -----------------------------------------------------------------
    // (a) Invalid timezone REJECTED on update (superadmin), and a valid
    // one is persisted.
    // -----------------------------------------------------------------
    public function testUpdateOrganizationRejectsInvalidTimezoneButAcceptsValid(): void
    {
        $app = $this->getAppInstance();
        $token = $this->superadminToken($app);

        $badRequest = $this->authedRequest($app, 'PUT', '/v1/superadmin/organizations/' . $this->fx['org_a_id'], $token)
            ->withParsedBody(['timezone' => 'Not/AZone']);
        $badResponse = $app->handle($badRequest);
        $badPayload = $this->decode($badResponse);

        $this->assertEquals(422, $badResponse->getStatusCode());
        $this->assertSame('VALIDATION_ERROR', $badPayload['error']['type']);

        // Org A's timezone must be unchanged after the rejected attempt.
        $stmt = $this->pdo->prepare('SELECT timezone FROM organizations WHERE id = :id');
        $stmt->execute([':id' => $this->fx['org_a_id']]);
        $this->assertSame('America/Santiago', $stmt->fetchColumn());

        $goodRequest = $this->authedRequest($app, 'PUT', '/v1/superadmin/organizations/' . $this->fx['org_a_id'], $token)
            ->withParsedBody(['timezone' => 'America/Bogota']);
        $goodResponse = $app->handle($goodRequest);
        $goodPayload = $this->decode($goodResponse);

        $this->assertEquals(200, $goodResponse->getStatusCode());
        $this->assertSame('America/Bogota', $goodPayload['data']['timezone']);
    }

    // -----------------------------------------------------------------
    // (b) org_admin CANNOT change another organization's timezone.
    // The endpoint has no {id} param — it is structurally impossible to
    // address another org — verify org B's timezone is untouched no
    // matter what org_admin_A sends in the payload, and org_admin_A's
    // OWN org (A) is what actually gets updated.
    // -----------------------------------------------------------------
    public function testOrgAdminCannotChangeAnotherOrganizationsTimezone(): void
    {
        $app = $this->getAppInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['org_admin_a_id'],
            'email' => 'org_admin_a@test.local',
            'name' => 'Org Admin A',
            'role' => 'org_admin',
            'organization_id' => $this->fx['org_a_id'],
        ]);

        // org_admin_A attempts to smuggle org B's id via the body — the
        // action must ignore it entirely and only ever touch org A.
        $request = $this->authedRequest($app, 'PUT', '/v1/org-admin/organization', $token)
            ->withParsedBody([
                'timezone' => 'America/Lima',
                'organization_id' => $this->fx['org_b_id'],
                'id' => $this->fx['org_b_id'],
            ]);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertSame($this->fx['org_a_id'], $payload['data']['id'], 'Must update org A (the caller\'s own org), never org B');
        $this->assertSame('America/Lima', $payload['data']['timezone']);

        // Org B's timezone must remain exactly at its original default —
        // untouched by org_admin_A's request.
        $stmt = $this->pdo->prepare('SELECT timezone FROM organizations WHERE id = :id');
        $stmt->execute([':id' => $this->fx['org_b_id']]);
        $this->assertSame('America/Santiago', $stmt->fetchColumn());
    }

    // -----------------------------------------------------------------
    // (b) org_admin's own-org GET/PUT also rejects an invalid timezone,
    // and manager/rep are denied entirely (role gate).
    // -----------------------------------------------------------------
    public function testOrgAdminOwnOrganizationRejectsInvalidTimezoneAndBlocksOtherRoles(): void
    {
        $app = $this->getAppInstance();
        $orgAdminToken = $this->jwtFor($app, [
            'id' => $this->fx['org_admin_a_id'],
            'email' => 'org_admin_a@test.local',
            'name' => 'Org Admin A',
            'role' => 'org_admin',
            'organization_id' => $this->fx['org_a_id'],
        ]);

        $getRequest = $this->authedRequest($app, 'GET', '/v1/org-admin/organization', $orgAdminToken);
        $getResponse = $app->handle($getRequest);
        $getPayload = $this->decode($getResponse);
        $this->assertEquals(200, $getResponse->getStatusCode());
        $this->assertSame($this->fx['org_a_id'], $getPayload['data']['id']);

        $badRequest = $this->authedRequest($app, 'PUT', '/v1/org-admin/organization', $orgAdminToken)
            ->withParsedBody(['timezone' => 'Nowhere/Fake']);
        $badResponse = $app->handle($badRequest);
        $this->assertEquals(422, $badResponse->getStatusCode());

        // manager and rep must be denied entirely (403) by the existing
        // ['org_admin'] RoleMiddleware allow-list on the /org-admin group.
        $repToken = $this->jwtFor($app, [
            'id' => $this->fx['rep_a_id'],
            'email' => 'rep_a@test.local',
            'name' => 'Rep A',
            'role' => 'rep',
            'organization_id' => $this->fx['org_a_id'],
        ]);
        $repRequest = $this->authedRequest($app, 'GET', '/v1/org-admin/organization', $repToken);
        $repResponse = $app->handle($repRequest);
        $this->assertEquals(403, $repResponse->getStatusCode());
    }

    // ===================================================================
    // Fixture helpers
    // ===================================================================

    private function createFixtures(): array
    {
        $suffix = uniqid('org_tz_', true);

        $orgAId = $this->insertOrganization("Test Org A {$suffix}");
        $orgBId = $this->insertOrganization("Test Org B {$suffix}");

        $orgAdminAId = $this->insertUser($orgAId, 'org_admin', "org_admin_a_{$suffix}@test.local", 'Org Admin A');
        $repAId = $this->insertUser($orgAId, 'rep', "rep_a_{$suffix}@test.local", 'Rep A');

        return [
            'org_a_id' => $orgAId,
            'org_b_id' => $orgBId,
            'org_admin_a_id' => $orgAdminAId,
            'rep_a_id' => $repAId,
        ];
    }

    private function destroyFixtures(array $fx): void
    {
        if (empty($fx)) {
            return;
        }

        $this->deleteWhereIn('users', 'id', [$fx['org_admin_a_id'], $fx['rep_a_id']]);
        $this->deleteWhereIn('organizations', 'id', [$fx['org_a_id'], $fx['org_b_id']]);
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
        // Deliberately omit `timezone` -> exercises the column DEFAULT
        // ('America/Santiago'), matching real-world new-org creation
        // before this Phase 4 change existed.
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

    // ===================================================================
    // HTTP / JWT helpers
    // ===================================================================

    private function jwtFor(App $app, array $user): string
    {
        /** @var Container $container */
        $container = $app->getContainer();
        return $container->get(JwtServiceInterface::class)->generate($user);
    }

    private function superadminToken(App $app): string
    {
        // No DB row needed: JwtMiddleware only decodes the token and never
        // looks the user up in the DB; RoleMiddleware only reads the
        // 'role' claim (same pattern as CommentActionsTest).
        return $this->jwtFor($app, [
            'id' => 999999999,
            'email' => 'superadmin@test.local',
            'name' => 'Super Admin',
            'role' => 'superadmin',
            'organization_id' => null,
        ]);
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
