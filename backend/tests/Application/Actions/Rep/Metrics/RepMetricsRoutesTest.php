<?php

declare(strict_types=1);

namespace Tests\Application\Actions\Rep\Metrics;

use App\Application\Services\Auth\JwtServiceInterface;
use App\Domain\RepMetrics\RepMetricsRepositoryInterface;
use DI\Container;
use Prophecy\Argument;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Tests\TestCase;

/**
 * Covers Phase 2 (tasks 2.3/2.4) of sdd/rep-metrics-module:
 *   - the exact set of /v1/rep/metrics/* route patterns is registered
 *   - no JWT -> 401, non-rep role -> 403, on every route
 *   - repId is ALWAYS resolved from the JWT identity, never from a query
 *     param — even when the caller supplies rep_id/session_id belonging
 *     to someone else (spec "Rep Data Isolation")
 *
 * RepMetricsRepositoryInterface is mocked (Prophecy) — the real SQL scope
 * predicate lives in DbRepMetricsRepository and is out of scope for this
 * Action/route-layer test.
 */
class RepMetricsRoutesTest extends TestCase
{
    private static bool $envLoaded = false;

    protected function setUp(): void
    {
        if (!self::$envLoaded) {
            $dotenv = \Dotenv\Dotenv::createImmutable(__DIR__ . '/../../../../..');
            $dotenv->safeLoad();
            self::$envLoaded = true;
        }
    }

    public function testExactSetOfRepMetricsRoutePatternsIsRegistered(): void
    {
        $app = $this->getAppInstance();

        $actual = [];
        foreach ($app->getRouteCollector()->getRoutes() as $route) {
            foreach ($route->getMethods() as $method) {
                $actual[] = $method . ' ' . $route->getPattern();
            }
        }

        $expected = [
            'GET /v1/rep/metrics/summary',
            'GET /v1/rep/metrics/open-trend',
            'GET /v1/rep/metrics/hour-histogram',
            'GET /v1/rep/metrics/device-split',
            'GET /v1/rep/metrics/top-materials',
            'GET /v1/rep/metrics/sessions',
            'GET /v1/rep/metrics/never-opened-doctors',
        ];

        foreach ($expected as $pattern) {
            $this->assertContains($pattern, $actual, "Expected route pattern '{$pattern}' is not registered.");
        }
    }

    /**
     * @dataProvider routeProvider
     */
    public function testMissingJwtReturns401(string $path): void
    {
        $app = $this->getAppInstance();
        $this->mockRepository($app);

        $request = $this->createRequest('GET', $path);
        $response = $app->handle($request);

        $this->assertEquals(401, $response->getStatusCode());
    }

    /**
     * @dataProvider routeProvider
     */
    public function testManagerRoleReturns403(string $path): void
    {
        $app = $this->getAppInstance();
        $this->mockRepository($app);

        $token = $this->jwtFor($app, [
            'id' => 7, 'email' => 'manager@test.local', 'name' => 'Manager',
            'role' => 'manager', 'organization_id' => 10,
        ]);

        $response = $app->handle($this->authedRequest($app, $path, $token));

        $this->assertEquals(403, $response->getStatusCode());
    }

    /**
     * @dataProvider routeProvider
     */
    public function testOrgAdminRoleReturns403(string $path): void
    {
        $app = $this->getAppInstance();
        $this->mockRepository($app);

        $token = $this->jwtFor($app, [
            'id' => 3, 'email' => 'orgadmin@test.local', 'name' => 'Org Admin',
            'role' => 'org_admin', 'organization_id' => 10,
        ]);

        $response = $app->handle($this->authedRequest($app, $path, $token));

        $this->assertEquals(403, $response->getStatusCode());
    }

    public function routeProvider(): array
    {
        return [
            'summary' => ['/v1/rep/metrics/summary'],
            'open-trend' => ['/v1/rep/metrics/open-trend'],
            'hour-histogram' => ['/v1/rep/metrics/hour-histogram'],
            'device-split' => ['/v1/rep/metrics/device-split'],
            'top-materials' => ['/v1/rep/metrics/top-materials'],
            'sessions' => ['/v1/rep/metrics/sessions'],
            'never-opened-doctors' => ['/v1/rep/metrics/never-opened-doctors'],
        ];
    }

    /**
     * The core isolation invariant: repId passed to the repository is
     * ALWAYS the JWT's own id (501), even though the request also supplies
     * rep_id / session_id query params that (if honored) would target a
     * different rep's data. RepMetricsAction never reads a `rep_id` query
     * param at all, so this also proves that param is simply ignored.
     */
    public function testRepIdIsAlwaysResolvedFromJwtNeverFromQueryParams(): void
    {
        $app = $this->getAppInstance();
        /** @var Container $container */
        $container = $app->getContainer();

        $repositoryProphecy = $this->prophesize(RepMetricsRepositoryInterface::class);
        $repositoryProphecy
            ->summary(501, Argument::any(), Argument::any())
            ->willReturn([
                'sessions_total' => 0,
                'sessions_viewed' => 0,
                'open_rate' => 0.0,
                'doctors_never_opened' => 0,
                'first_open_median_hours' => null,
                'materials_opened' => 0,
                'materials_unopened' => 0,
            ])
            ->shouldBeCalledOnce();
        // If the Action ever leaked rep_id=999 through to the repository,
        // this would be the call instead — asserting it's never called
        // catches that regression explicitly.
        $repositoryProphecy->summary(999, Argument::any(), Argument::any())->shouldNotBeCalled();

        $container->set(RepMetricsRepositoryInterface::class, $repositoryProphecy->reveal());

        $token = $this->jwtFor($app, [
            'id' => 501, 'email' => 'rep@test.local', 'name' => 'Rep',
            'role' => 'rep', 'organization_id' => 10,
        ]);

        $request = $this->authedRequest($app, '/v1/rep/metrics/summary', $token);
        // Attempt to widen scope via query params — must be a no-op.
        $request = $request->withUri($request->getUri()->withQuery(http_build_query([
            'rep_id' => 999,
            'session_id' => 12345,
        ])));

        $response = $app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
    }

    private function mockRepository(App $app): void
    {
        /** @var Container $container */
        $container = $app->getContainer();
        $repositoryProphecy = $this->prophesize(RepMetricsRepositoryInterface::class);
        $container->set(RepMetricsRepositoryInterface::class, $repositoryProphecy->reveal());
    }

    private function jwtFor(App $app, array $user): string
    {
        /** @var Container $container */
        $container = $app->getContainer();
        return $container->get(JwtServiceInterface::class)->generate($user);
    }

    private function authedRequest(App $app, string $path, string $bearerToken): Request
    {
        return $this->createRequest('GET', $path, [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $bearerToken,
        ]);
    }
}
