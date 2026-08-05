<?php

declare(strict_types=1);

namespace Tests\Unit\Actions\Doctor;

use App\Application\Services\Auth\JwtServiceInterface;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use DI\Container;
use Prophecy\Argument;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Tests\TestCase;

/**
 * Phase 4 (T4.1) — proves GET /v1/doctors/reps/search branches strictly by
 * caller role, per sdd/doctors-management-fixes/spec §"Role-Aware
 * Representative Search Endpoint":
 *   - org_admin -> RepAccessRepositoryInterface::findRepsByOrg() (all org reps)
 *   - manager   -> RepAccessRepositoryInterface::getSubscribedRepsForManager()
 *   - rep       -> 403, repository never queried
 *
 * RepAccessRepositoryInterface is mocked (Prophecy); the repository's own
 * `rma.active = 1` / org-scoped SQL is covered by the real-DB integration
 * test (T4.2).
 */
class RepSearchActionTest extends TestCase
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

    public function testOrgAdminGetsAllOrgReps(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $repositoryProphecy = $this->prophesize(RepAccessRepositoryInterface::class);
        $repositoryProphecy
            ->findRepsByOrg(10, 'ana', 20)
            ->willReturn([['id' => 1, 'name' => 'Ana Rep', 'email' => 'ana@test.local']])
            ->shouldBeCalledOnce();
        $repositoryProphecy->getSubscribedRepsForManager(Argument::any(), Argument::any(), Argument::any())
            ->shouldNotBeCalled();

        $container->set(RepAccessRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 1, 'email' => 'org_admin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'GET', '/v1/doctors/reps/search', $token, ['q' => 'ana']);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertCount(1, $payload['data']);
    }

    public function testManagerGetsOnlySubscribedReps(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $repositoryProphecy = $this->prophesize(RepAccessRepositoryInterface::class);
        $repositoryProphecy
            ->getSubscribedRepsForManager(7, '', 20)
            ->willReturn([['id' => 2, 'name' => 'Subscribed Rep', 'email' => 'rep@test.local']])
            ->shouldBeCalledOnce();

        $container->set(RepAccessRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 7, 'email' => 'manager@test.local', 'name' => 'Manager',
            'role' => 'manager', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'GET', '/v1/doctors/reps/search', $token, []);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertCount(1, $payload['data']);
    }

    public function testRepIsDeniedAndRepositoryIsNeverQueried(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $repositoryProphecy = $this->prophesize(RepAccessRepositoryInterface::class);
        $container->set(RepAccessRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 501, 'email' => 'rep@test.local', 'name' => 'Rep',
            'role' => 'rep', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, 'GET', '/v1/doctors/reps/search', $token, ['q' => 'x']);
        $response = $app->handle($request);

        $this->assertEquals(403, $response->getStatusCode());
        $repositoryProphecy->findRepsByOrg(10, 'x', 20)->shouldNotHaveBeenCalled();
        $repositoryProphecy->getSubscribedRepsForManager(501, 'x', 20)->shouldNotHaveBeenCalled();
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
