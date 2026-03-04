<?php

declare(strict_types=1);

use App\Application\Settings\Settings;
use App\Application\Settings\SettingsInterface;
use DI\ContainerBuilder;
use Monolog\Logger;

return function (ContainerBuilder $containerBuilder) {
    $debug = filter_var($_ENV['APP_DEBUG'] ?? 'false', FILTER_VALIDATE_BOOL);

    // Global Settings Object
    $containerBuilder->addDefinitions([
        SettingsInterface::class => function () use ($debug) {
            return new Settings([
                'displayErrorDetails' => $debug,
                'logError'            => !$debug,
                'logErrorDetails'     => !$debug,
                'logger' => [
                    'name' => 'slim-app',
                    'path' => isset($_ENV['docker']) ? 'php://stdout' : __DIR__ . '/../logs/app.log',
                    'level' => Logger::DEBUG,
                ],
            ]);
        }
    ]);
};
