<?php

declare(strict_types=1);

namespace Tests\Unit\Actions\Doctor;

use App\Application\Services\Auth\JwtServiceInterface;
use App\Domain\Doctor\Doctor;
use App\Domain\Doctor\DoctorRepositoryInterface;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use DI\Container;
use Prophecy\Argument;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Tests\TestCase;

/**
 * Phase 8 (T8.2) — proves CreateDoctorAction normalizes `region` through
 * RegionCatalog::normalizeRegion() before it ever reaches the repository,
 * and REJECTS (422, repository never called) an unmappable value instead
 * of silently persisting the raw string, per sdd/doctors-management-fixes/
 * spec §"Canonical Region Diagnostic & Normalization" — Scenario
 * "Unmappable value at write time".
 *
 * Doctor create/edit rep-assignment fix — proves CreateDoctorAction:
 *  (a) strips any client-supplied assigned_rep_id for role==='rep' (a rep
 *      can never self-assign or hand a doctor off to another rep);
 *  (b) validates assigned_rep_id via RepAccessRepositoryInterface for
 *      org_admin/manager, rejecting (422, repository never called) an
 *      out-of-scope/cross-organization id;
 *  (c) scopes that validation to the manager's own id for role==='manager'
 *      (mirrors RepSearchAction's subscribed-only semantics).
 */
class CreateDoctorActionTest extends TestCase
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

    public function testAliasRegionIsNormalizedBeforePersisting(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $doctor = $this->makeDoctor(1, 10, 'Valparaíso');

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy
            ->create(10, Argument::that(fn (array $data) => $data['region'] === 'Valparaíso'))
            ->willReturn($doctor)
            ->shouldBeCalledOnce();

        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 1, 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => 10,
        ]);

        // "Valparaiso" (no accent) is an ALIAS, not the canonical spelling.
        $request = $this->authedRequest($app, 'POST', '/v1/doctors', $token)
            ->withParsedBody(['name' => 'New Doctor', 'region' => 'Valparaiso']);
        $response = $app->handle($request);

        $this->assertEquals(201, $response->getStatusCode());
    }

    public function testUnmappableRegionIsRejectedAndRepositoryNeverCalled(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 1, 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'POST', '/v1/doctors', $token)
            ->withParsedBody(['name' => 'New Doctor', 'region' => 'Not A Real Region']);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(422, $response->getStatusCode());
        $repositoryProphecy->create(Argument::any(), Argument::any())->shouldNotHaveBeenCalled();
        $this->assertArrayHasKey('data', $payload);
    }

    public function testRepAssignedRepIdIsStrippedFromCreatePayload(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $doctor = $this->makeDoctor(1, 10, null);

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy
            ->create(10, Argument::that(fn (array $data) => !array_key_exists('assigned_rep_id', $data)))
            ->willReturn($doctor)
            ->shouldBeCalledOnce();
        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $repAccessProphecy = $this->prophesize(RepAccessRepositoryInterface::class);
        $repAccessProphecy->isRepAssignable(Argument::cetera())->shouldNotBeCalled();
        $container->set(RepAccessRepositoryInterface::class, $repAccessProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 501, 'email' => 'rep501@test.local', 'name' => 'Rep R1',
            'role' => 'rep', 'organization_id' => 10,
        ]);

        // Rep tries to self-assign (or reassign to another rep) at creation.
        $request = $this->authedRequest($app, 'POST', '/v1/doctors', $token)
            ->withParsedBody(['name' => 'New Doctor', 'assigned_rep_id' => 999]);
        $response = $app->handle($request);

        $this->assertEquals(201, $response->getStatusCode());
    }

    public function testOrgAdminCanAssignValidRepOnCreate(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $doctor = $this->makeDoctor(1, 10, null);

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy
            ->create(10, Argument::that(fn (array $data) => ($data['assigned_rep_id'] ?? null) === 55))
            ->willReturn($doctor)
            ->shouldBeCalledOnce();
        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $repAccessProphecy = $this->prophesize(RepAccessRepositoryInterface::class);
        $repAccessProphecy->isRepAssignable(55, 10, null)->willReturn(true)->shouldBeCalledOnce();
        $container->set(RepAccessRepositoryInterface::class, $repAccessProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 1, 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'POST', '/v1/doctors', $token)
            ->withParsedBody(['name' => 'New Doctor', 'assigned_rep_id' => 55]);
        $response = $app->handle($request);

        $this->assertEquals(201, $response->getStatusCode());
    }

    public function testInvalidRepIdIsRejectedOnCreate(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $repAccessProphecy = $this->prophesize(RepAccessRepositoryInterface::class);
        $repAccessProphecy->isRepAssignable(999, 10, null)->willReturn(false)->shouldBeCalledOnce();
        $container->set(RepAccessRepositoryInterface::class, $repAccessProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 1, 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'POST', '/v1/doctors', $token)
            ->withParsedBody(['name' => 'New Doctor', 'assigned_rep_id' => 999]);
        $response = $app->handle($request);

        $this->assertEquals(422, $response->getStatusCode());
        $repositoryProphecy->create(Argument::any(), Argument::any())->shouldNotHaveBeenCalled();
    }

    public function testManagerAssignmentIsScopedToManagerOwnId(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $doctor = $this->makeDoctor(1, 10, null);

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy->create(10, Argument::type('array'))->willReturn($doctor)->shouldBeCalledOnce();
        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $repAccessProphecy = $this->prophesize(RepAccessRepositoryInterface::class);
        // managerId (3rd arg) MUST be the manager's own auth id, not null —
        // this is what confines a manager to their own subscribed reps.
        $repAccessProphecy->isRepAssignable(77, 10, 7)->willReturn(true)->shouldBeCalledOnce();
        $container->set(RepAccessRepositoryInterface::class, $repAccessProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 7, 'email' => 'manager@test.local', 'name' => 'Manager',
            'role' => 'manager', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'POST', '/v1/doctors', $token)
            ->withParsedBody(['name' => 'New Doctor', 'assigned_rep_id' => 77]);
        $response = $app->handle($request);

        $this->assertEquals(201, $response->getStatusCode());
    }

    private function makeDoctor(int $id, int $orgId, ?string $region): Doctor
    {
        return Doctor::fromRow([
            'id' => $id, 'organization_id' => $orgId, 'external_id' => null, 'name' => 'New Doctor',
            'document' => null, 'specialty' => null, 'country' => null, 'region' => $region,
            'provincia' => null, 'comuna' => null, 'institution' => null, 'category' => null,
            'last_visit_date' => null, 'product' => null, 'adoption_level' => null,
            'assigned_rep_id' => null, 'email' => null, 'phone' => null, 'mobile_phone' => null,
            'address' => null, 'created_by_id' => 1, 'active' => 1,
            'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00',
        ]);
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
