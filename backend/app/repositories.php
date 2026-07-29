<?php

declare(strict_types=1);

use App\Domain\AdminUser\AdminUserRepositoryInterface;
use App\Domain\Auth\AuthRepositoryInterface;
use App\Domain\MaterialView\MaterialViewRepositoryInterface;
use App\Domain\Organization\OrganizationRepositoryInterface;
use App\Domain\StudyView\StudyViewRepositoryInterface;
use App\Domain\User\UserRepository;
use App\Domain\VisitSessionComment\VisitSessionCommentRepositoryInterface;
use App\Infrastructure\Persistence\AdminUser\DbAdminUserRepository;
use App\Infrastructure\Persistence\Auth\DbAuthRepository;
use App\Infrastructure\Persistence\MaterialView\DbMaterialViewRepository;
use App\Infrastructure\Persistence\Organization\DbOrganizationRepository;
use App\Infrastructure\Persistence\StudyView\DbStudyViewRepository;
use App\Infrastructure\Persistence\User\InMemoryUserRepository;
use App\Infrastructure\Persistence\VisitSessionComment\DbVisitSessionCommentRepository;
use App\Domain\Metrics\MetricsRepositoryInterface;
use App\Infrastructure\Persistence\Metrics\DbMetricsRepository;
use DI\ContainerBuilder;

return function (ContainerBuilder $containerBuilder) {
    $containerBuilder->addDefinitions([
        // Legacy in-memory user repository (kept for reference; replaced in future phases)
        UserRepository::class => \DI\autowire(InMemoryUserRepository::class),

        // Auth repository — DB-backed
        AuthRepositoryInterface::class => \DI\autowire(DbAuthRepository::class),

        // Organization repository — DB-backed (Phase 3)
        OrganizationRepositoryInterface::class => \DI\autowire(DbOrganizationRepository::class),

        // Admin user repository — DB-backed (Phase 3)
        AdminUserRepositoryInterface::class => \DI\autowire(DbAdminUserRepository::class),

        // Material View repository — DB-backed (Phase 7)
        MaterialViewRepositoryInterface::class => \DI\autowire(DbMaterialViewRepository::class),

        // Study View repository — DB-backed (material-studies change)
        StudyViewRepositoryInterface::class => \DI\autowire(DbStudyViewRepository::class),

        // Metrics repository
        MetricsRepositoryInterface::class => \DI\autowire(DbMetricsRepository::class),

        // Visit session comments repository — DB-backed (visit-comments change)
        VisitSessionCommentRepositoryInterface::class => \DI\autowire(DbVisitSessionCommentRepository::class),
    ]);
};
