<?php

declare(strict_types=1);

use App\Application\Actions\Auth\LoginAction;
use App\Application\Actions\Auth\MeAction;
use App\Application\Middleware\JwtMiddleware;
use App\Infrastructure\Database\Connection;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

return function (App $app) {
    $app->options('/{routes:.*}', function (Request $request, Response $response) {
        // CORS Pre-Flight OPTIONS Request Handler
        return $response;
    });

    // API v1 route group
    $app->group('/v1', function (RouteCollectorProxy $group) {

        // -------------------------------------------------------------------------
        // Health check
        // -------------------------------------------------------------------------
        $group->get('/health', function (Request $request, Response $response) {
            $dbStatus = Connection::testConnection();

            $payload = [
                'success' => $dbStatus['status'] === 'ok',
                'data' => [
                    'api' => [
                        'status' => 'ok',
                        'name' => $_ENV['APP_NAME'] ?? 'MEDMETRIC',
                        'version' => '1.0.0',
                        'environment' => $_ENV['APP_ENV'] ?? 'development',
                    ],
                    'database' => $dbStatus,
                ],
            ];

            $response->getBody()->write((string) json_encode($payload, JSON_UNESCAPED_SLASHES));

            return $response
                ->withStatus($dbStatus['status'] === 'ok' ? 200 : 503)
                ->withHeader('Content-Type', 'application/json');
        });

        // -------------------------------------------------------------------------
        // Auth routes (public — no JWT required)
        // -------------------------------------------------------------------------
        $group->group('/auth', function (RouteCollectorProxy $auth) {
            $auth->post('/login', LoginAction::class);
        });

        // -------------------------------------------------------------------------
        // Auth routes (protected — JWT required)
        // -------------------------------------------------------------------------
        $group->group('/auth', function (RouteCollectorProxy $auth) {
            $auth->get('/me', MeAction::class);
        })->add(JwtMiddleware::class);
    });
};
