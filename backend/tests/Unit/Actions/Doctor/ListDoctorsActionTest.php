<?php

declare(strict_types=1);

namespace Tests\Unit\Actions\Doctor;

use App\Application\Services\Auth\JwtServiceInterface;
use App\Domain\Doctor\Doctor;
use App\Domain\Doctor\DoctorRepositoryInterface;
use DI\Container;
use Prophecy\Argument;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Tests\TestCase;

/**
 * Phase 2 (T2.1) — proves ListDoctorsAction/findAllByOrg() forces
 * assigned_rep_id = auth_user.id for role==='rep', ignoring/overriding any
 * client-supplied rep_id/assigned_rep_id, per
 * sdd/doctors-management-fixes/spec §"Server-Enforced Rep Doctor Scoping".
 *
 * DoctorRepositoryInterface is mocked (Prophecy) so this exercises ONLY the
 * Action's scoping decision, not the repository's SQL — that is covered by
 * the Integration/Doctor/DoctorScopeTest.php real-DB test.
 */
class ListDoctorsActionTest extends TestCase
{
    private static bool $envLoaded = false;

    protected function setUp(): void
    {
        if (!self::$envLoaded) {
            $dotenv = \Dotenv\Dotenv::createImmutable(__DIR__ . '/../../../..');
            $dotenv->safeLoad();
            self::$envLoaded = true;
        }
    }

    public function testRepSeesOnlyOwnDoctorsEvenWithForgedRepId(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $doctor = $this->makeDoctor(1, 10, 501);

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy
            ->findAllByOrg(
                10,
                Argument::type('array'),
                1,
                501 // restrictRepId MUST be the authenticated rep's own id (501)...
            )
            ->willReturn(['items' => [$doctor], 'total' => 1, 'page' => 1, 'per_page' => 20, 'last_page' => 1])
            ->shouldBeCalledOnce();

        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 501,
            'email' => 'rep501@test.local',
            'name' => 'Rep 501',
            'role' => 'rep',
            'organization_id' => 10,
        ]);

        // ...even though the request forges a DIFFERENT rep_id/assigned_rep_id (999).
        $request = $this->authedRequest($app, 'GET', '/v1/doctors', $token, ['assigned_rep_id' => '999']);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertTrue($payload['success']);
        $this->assertSame(1, $payload['data']['total']);
    }

    public function testOrgAdminIsNotRestrictedByRepId(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy
            ->findAllByOrg(10, Argument::type('array'), 1, null) // restrictRepId must be null for org_admin
            ->willReturn(['items' => [], 'total' => 0, 'page' => 1, 'per_page' => 20, 'last_page' => 0])
            ->shouldBeCalledOnce();

        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 1,
            'email' => 'org_admin@test.local',
            'name' => 'Org Admin',
            'role' => 'org_admin',
            'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'GET', '/v1/doctors', $token, []);
        $response = $app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
    }

    private function makeDoctor(int $id, int $orgId, int $assignedRepId): Doctor
    {
        return Doctor::fromRow([
            'id' => $id,
            'organization_id' => $orgId,
            'external_id' => null,
            'name' => 'Test Doctor',
            'document' => null,
            'specialty' => null,
            'country' => null,
            'region' => null,
            'provincia' => null,
            'comuna' => null,
            'institution' => null,
            'category' => null,
            'last_visit_date' => null,
            'product' => null,
            'adoption_level' => null,
            'assigned_rep_id' => $assignedRepId,
            'email' => null,
            'phone' => null,
            'mobile_phone' => null,
            'address' => null,
            'created_by_id' => null,
            'active' => 1,
            'created_at' => '2026-01-01 00:00:00',
            'updated_at' => '2026-01-01 00:00:00',
        ]);
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
