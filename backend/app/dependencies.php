<?php

declare(strict_types=1);

use App\Application\Middleware\JwtMiddleware;
use App\Application\Services\JwtService;
use App\Application\Settings\SettingsInterface;
use DI\ContainerBuilder;
use Monolog\Handler\StreamHandler;
use Monolog\Logger;
use Monolog\Processor\UidProcessor;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Log\LoggerInterface;
use Slim\Psr7\Factory\ResponseFactory;

return function (ContainerBuilder $containerBuilder) {
    $containerBuilder->addDefinitions([

        // Logger
        LoggerInterface::class => function (ContainerInterface $c) {
            $settings = $c->get(SettingsInterface::class);

            $loggerSettings = $settings->get('logger');
            $logger = new Logger($loggerSettings['name']);

            $processor = new UidProcessor();
            $logger->pushProcessor($processor);

            $handler = new StreamHandler($loggerSettings['path'], $loggerSettings['level']);
            $logger->pushHandler($handler);

            return $logger;
        },

        // PSR-17 Response Factory (needed by JwtMiddleware / RoleMiddleware)
        ResponseFactoryInterface::class => \DI\autowire(ResponseFactory::class),

        // JWT Service (reads JWT_SECRET from $_ENV)
        JwtService::class => \DI\autowire(JwtService::class),

        // JWT Middleware (auto-wired: JwtService + ResponseFactoryInterface)
        JwtMiddleware::class => \DI\autowire(JwtMiddleware::class),
    ]);
};
