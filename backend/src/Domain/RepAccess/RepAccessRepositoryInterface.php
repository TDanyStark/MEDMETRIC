<?php

declare(strict_types=1);

namespace App\Domain\RepAccess;

interface RepAccessRepositoryInterface
{
    public function findAllByManager(int $managerId, ?string $search = null, ?bool $active = null, int $page = 1): array;
    public function findByManagerAndRep(int $managerId, int $repId): ?RepAccess;
    public function assign(int $managerId, int $repId): RepAccess;
    public function remove(int $managerId, int $repId): void;
    public function toggleActive(int $managerId, int $repId, bool $active): RepAccess;
    public function getAvailableRepsForManager(int $managerId, int $organizationId, ?string $search = null): array;
}
