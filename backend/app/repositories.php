<?php

declare(strict_types=1);

use App\Domain\Auth\AuthRepositoryInterface;
use App\Domain\User\UserRepository;
use App\Infrastructure\Persistence\Auth\DbAuthRepository;
use App\Infrastructure\Persistence\User\InMemoryUserRepository;
use DI\ContainerBuilder;

return function (ContainerBuilder $containerBuilder) {
    $containerBuilder->addDefinitions([
        // Legacy in-memory user repository (kept for reference; replaced in future phases)
        UserRepository::class => \DI\autowire(InMemoryUserRepository::class),

        // Auth repository — DB-backed
        AuthRepositoryInterface::class => \DI\autowire(DbAuthRepository::class),
    ]);
};
