<?php

declare(strict_types=1);

use App\Infrastructure\Database\Connection;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

return function (App $app) {
    $app->options('/{routes:.*}', function (Request $request, Response $response) {
        // CORS Pre-Flight OPTIONS Request Handler
        return $response;
    });

    $app->get('/health', function (Request $request, Response $response) {
        $dbStatus = Connection::testConnection();

        $payload = [
            'api' => [
                'status' => 'ok',
                'name' => $_ENV['APP_NAME'] ?? 'MEDMETRIC',
                'version' => '1.0.0',
                'environment' => $_ENV['APP_ENV'] ?? 'development',
            ],
            'database' => $dbStatus,
        ];

        $response->getBody()->write((string) json_encode($payload, JSON_UNESCAPED_SLASHES));

        return $response
            ->withStatus($dbStatus['status'] === 'ok' ? 200 : 503)
            ->withHeader('Content-Type', 'application/json');
    });
};
