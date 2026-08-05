<?php

declare(strict_types=1);

namespace Tests\Unit\Actions\Doctor;

use App\Application\Handlers\HttpErrorHandler;
use App\Application\Services\Auth\JwtServiceInterface;
use App\Domain\Doctor\Doctor;
use App\Domain\Doctor\DoctorNotFoundException;
use App\Domain\Doctor\DoctorRepositoryInterface;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use DI\Container;
use Prophecy\Argument;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Slim\Middleware\ErrorMiddleware;
use Tests\TestCase;

/**
 * Phase 2 (T2.2) — proves UpdateDoctorAction:
 *  (a) scopes the ownership check to auth_user.id (not the payload) by
 *      passing restrictRepId to the repository, which is expected to reject
 *      cross-rep updates as DoctorNotFoundException -> HTTP 404 (never a
 *      raw 403 that would leak the doctor's existence);
 *  (b) strips any client-supplied assigned_rep_id from the write payload
 *      for role==='rep', so a rep can never smuggle a reassignment.
 *
 * DoctorRepositoryInterface is mocked (Prophecy) — the repository's own
 * ownership-guard SQL/logic is covered separately by
 * Integration/Doctor/DoctorScopeTest.php against the real DB.
 */
class UpdateDoctorActionTest extends TestCase
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

    public function testRepEditingOtherRepsDoctorReturnsNotFoundAndDoesNotPersist(): void
    {
        $app = $this->getAppInstance();

        // getAppInstance() does not register error-handling middleware (only
        // public/index.php does, for real requests) — DoctorNotFoundException
        // -> HttpNotFoundException would otherwise bubble up as an uncaught
        // PHP exception instead of the 404 JSON response the Action promises.
        // Same pattern as the pre-existing ViewUserActionTest not-found case.
        $callableResolver = $app->getCallableResolver();
        $responseFactory = $app->getResponseFactory();
        $errorHandler = new HttpErrorHandler($callableResolver, $responseFactory);
        $errorMiddleware = new ErrorMiddleware($callableResolver, $responseFactory, true, false, false);
        $errorMiddleware->setDefaultErrorHandler($errorHandler);
        $app->add($errorMiddleware);

        /** @var Container $container */
        $container = $app->getContainer();

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy
            ->update(42, 10, Argument::type('array'), 501) // restrictRepId = R1's own id
            ->willThrow(new DoctorNotFoundException(42))
            ->shouldBeCalledOnce();

        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 501, // Rep R1
            'email' => 'rep501@test.local',
            'name' => 'Rep R1',
            'role' => 'rep',
            'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/42', $token)
            ->withParsedBody(['name' => 'Attempted edit of R2 doctor']);
        $response = $app->handle($request);

        $this->assertEquals(404, $response->getStatusCode());
    }

    public function testForgedAssignedRepIdIsStrippedFromRepPayload(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $doctor = Doctor::fromRow([
            'id' => 42, 'organization_id' => 10, 'external_id' => null, 'name' => 'Doctor',
            'document' => null, 'specialty' => null, 'country' => null, 'region' => null,
            'provincia' => null, 'comuna' => null, 'institution' => null, 'category' => null,
            'last_visit_date' => null, 'product' => null, 'adoption_level' => null,
            'assigned_rep_id' => 501, 'email' => null, 'phone' => null, 'mobile_phone' => null,
            'address' => null, 'created_by_id' => null, 'active' => 1,
            'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00',
        ]);

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy
            ->update(
                42,
                10,
                Argument::that(fn (array $data) => !array_key_exists('assigned_rep_id', $data)),
                501
            )
            ->willReturn($doctor)
            ->shouldBeCalledOnce();

        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 501,
            'email' => 'rep501@test.local',
            'name' => 'Rep R1',
            'role' => 'rep',
            'organization_id' => 10,
        ]);

        // Rep tries to smuggle assigned_rep_id=999 (reassign to a different rep).
        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/42', $token)
            ->withParsedBody(['name' => 'Doctor', 'assigned_rep_id' => 999]);
        $response = $app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
    }

    // -----------------------------------------------------------------
    // Doctor create/edit rep-assignment fix — org_admin/manager reassignment
    // is validated via RepAccessRepositoryInterface before persisting.
    // -----------------------------------------------------------------
    public function testOrgAdminCanReassignToValidRep(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $doctor = Doctor::fromRow([
            'id' => 42, 'organization_id' => 10, 'external_id' => null, 'name' => 'Doctor',
            'document' => null, 'specialty' => null, 'country' => null, 'region' => null,
            'provincia' => null, 'comuna' => null, 'institution' => null, 'category' => null,
            'last_visit_date' => null, 'product' => null, 'adoption_level' => null,
            'assigned_rep_id' => 88, 'email' => null, 'phone' => null, 'mobile_phone' => null,
            'address' => null, 'created_by_id' => null, 'active' => 1,
            'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00',
        ]);

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy
            ->update(42, 10, Argument::that(fn (array $data) => ($data['assigned_rep_id'] ?? null) === 88), null)
            ->willReturn($doctor)
            ->shouldBeCalledOnce();
        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $repAccessProphecy = $this->prophesize(RepAccessRepositoryInterface::class);
        $repAccessProphecy->isRepAssignable(88, 10, null)->willReturn(true)->shouldBeCalledOnce();
        $container->set(RepAccessRepositoryInterface::class, $repAccessProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 1, 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/42', $token)
            ->withParsedBody(['assigned_rep_id' => 88]);
        $response = $app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function testInvalidRepIdIsRejectedOnUpdate(): void
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

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/42', $token)
            ->withParsedBody(['assigned_rep_id' => 999]);
        $response = $app->handle($request);

        $this->assertEquals(422, $response->getStatusCode());
        $repositoryProphecy->update(Argument::any(), Argument::any(), Argument::any(), Argument::any())->shouldNotHaveBeenCalled();
    }

    public function testManagerReassignmentIsScopedToManagerOwnId(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $doctor = Doctor::fromRow([
            'id' => 42, 'organization_id' => 10, 'external_id' => null, 'name' => 'Doctor',
            'document' => null, 'specialty' => null, 'country' => null, 'region' => null,
            'provincia' => null, 'comuna' => null, 'institution' => null, 'category' => null,
            'last_visit_date' => null, 'product' => null, 'adoption_level' => null,
            'assigned_rep_id' => 77, 'email' => null, 'phone' => null, 'mobile_phone' => null,
            'address' => null, 'created_by_id' => null, 'active' => 1,
            'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00',
        ]);

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy->update(42, 10, Argument::type('array'), null)->willReturn($doctor)->shouldBeCalledOnce();
        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $repAccessProphecy = $this->prophesize(RepAccessRepositoryInterface::class);
        // managerId (3rd arg) MUST be the manager's own auth id, not null.
        $repAccessProphecy->isRepAssignable(77, 10, 7)->willReturn(true)->shouldBeCalledOnce();
        $container->set(RepAccessRepositoryInterface::class, $repAccessProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 7, 'email' => 'manager@test.local', 'name' => 'Manager',
            'role' => 'manager', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/42', $token)
            ->withParsedBody(['assigned_rep_id' => 77]);
        $response = $app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function testClearingAssignedRepIdRequiresNoValidation(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $doctor = Doctor::fromRow([
            'id' => 42, 'organization_id' => 10, 'external_id' => null, 'name' => 'Doctor',
            'document' => null, 'specialty' => null, 'country' => null, 'region' => null,
            'provincia' => null, 'comuna' => null, 'institution' => null, 'category' => null,
            'last_visit_date' => null, 'product' => null, 'adoption_level' => null,
            'assigned_rep_id' => null, 'email' => null, 'phone' => null, 'mobile_phone' => null,
            'address' => null, 'created_by_id' => null, 'active' => 1,
            'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00',
        ]);

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy
            ->update(42, 10, Argument::that(fn (array $data) => array_key_exists('assigned_rep_id', $data) && $data['assigned_rep_id'] === null), null)
            ->willReturn($doctor)
            ->shouldBeCalledOnce();
        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $repAccessProphecy = $this->prophesize(RepAccessRepositoryInterface::class);
        $repAccessProphecy->isRepAssignable(Argument::cetera())->shouldNotBeCalled();
        $container->set(RepAccessRepositoryInterface::class, $repAccessProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 1, 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/42', $token)
            ->withParsedBody(['assigned_rep_id' => '']);
        $response = $app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
    }

    // -----------------------------------------------------------------
    // Phase 8 (T8.2) — region normalization on update.
    // -----------------------------------------------------------------
    public function testAliasRegionIsNormalizedBeforePersisting(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $doctor = Doctor::fromRow([
            'id' => 42, 'organization_id' => 10, 'external_id' => null, 'name' => 'Doctor',
            'document' => null, 'specialty' => null, 'country' => null, 'region' => 'Biobío',
            'provincia' => null, 'comuna' => null, 'institution' => null, 'category' => null,
            'last_visit_date' => null, 'product' => null, 'adoption_level' => null,
            'assigned_rep_id' => null, 'email' => null, 'phone' => null, 'mobile_phone' => null,
            'address' => null, 'created_by_id' => null, 'active' => 1,
            'created_at' => '2026-01-01 00:00:00', 'updated_at' => '2026-01-01 00:00:00',
        ]);

        $repositoryProphecy = $this->prophesize(DoctorRepositoryInterface::class);
        $repositoryProphecy
            ->update(42, 10, Argument::that(fn (array $data) => $data['region'] === 'Biobío'), null)
            ->willReturn($doctor)
            ->shouldBeCalledOnce();

        $container->set(DoctorRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 1, 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => 10,
        ]);

        // "Bio Bio" (no accent, split) is an ALIAS, not the canonical spelling.
        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/42', $token)
            ->withParsedBody(['region' => 'Bio Bio']);
        $response = $app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
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

        $request = $this->authedRequest($app, 'PUT', '/v1/doctors/42', $token)
            ->withParsedBody(['region' => 'Not A Real Region']);
        $response = $app->handle($request);

        $this->assertEquals(422, $response->getStatusCode());
        $repositoryProphecy->update(Argument::any(), Argument::any(), Argument::any(), Argument::any())->shouldNotHaveBeenCalled();
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
}
