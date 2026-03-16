<?php

declare(strict_types=1);

namespace App\Domain\Brand;

interface BrandRepositoryInterface
{
    public function findAll(?int $organizationId = null, ?string $search = null, int $page = 1): array;
    public function findById(int $id): Brand;
    public function create(int $organizationId, string $name, ?string $description): Brand;
    public function update(int $id, array $data): Brand;
    public function delete(int $id): void;
    public function findByOrganizationAndName(int $organizationId, string $name): ?Brand;
    public function existsInOrganization(int $organizationId, string $name, ?int $excludeId = null): bool;
    
    // Manager brand assignments
    public function findAllByManager(int $managerId, ?string $search = null, int $page = 1): array;
    public function findByManagerAndId(int $managerId, int $brandId): Brand;
    public function assignToManager(int $managerId, int $brandId): void;
    public function removeFromManager(int $managerId, int $brandId): void;
    public function getManagerBrandIds(int $managerId): array;
    public function findAllAccessibleByRep(int $repId): array;
}
