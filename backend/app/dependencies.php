<?php

declare(strict_types=1);

use App\Application\Middleware\JwtMiddleware;
use App\Application\Services\JwtService;
use App\Application\Services\Storage\LocalStorageService;
use App\Application\Services\Storage\PdfProcessorService;
use App\Application\Services\Storage\S3StorageService;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Application\Settings\SettingsInterface;
use App\Domain\Brand\BrandRepositoryInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use App\Infrastructure\Persistence\Brand\DbBrandRepository;
use App\Infrastructure\Persistence\Material\DbMaterialRepository;
use App\Infrastructure\Persistence\RepAccess\DbRepAccessRepository;
use App\Infrastructure\Persistence\VisitSession\DbVisitSessionRepository;
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

        // PDF Processor (shared between local and S3 services)
        PdfProcessorService::class => \DI\autowire(PdfProcessorService::class),

        // Storage Service — switch between local disk and AWS S3 via STORAGE_DRIVER env var
        StorageServiceInterface::class => function (ContainerInterface $c) {
            $driver = $_ENV['STORAGE_DRIVER'] ?? 'local';

            if ($driver === 's3') {
                return $c->get(S3StorageService::class);
            }

            return $c->get(LocalStorageService::class);
        },

        // Repositories
        BrandRepositoryInterface::class => \DI\autowire(DbBrandRepository::class),
        MaterialRepositoryInterface::class => \DI\autowire(DbMaterialRepository::class),
        RepAccessRepositoryInterface::class => \DI\autowire(DbRepAccessRepository::class),
        VisitSessionRepositoryInterface::class => \DI\autowire(DbVisitSessionRepository::class),
    ]);
};