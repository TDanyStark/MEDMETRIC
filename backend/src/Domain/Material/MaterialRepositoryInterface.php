<?php

declare(strict_types=1);

namespace App\Domain\Material;

interface MaterialRepositoryInterface
{
    public function findAllByManager(int $managerId, ?string $search = null, ?string $status = null, ?string $type = null, int $page = 1): array;
    public function findAllByOrganization(int $organizationId, ?string $search = null, ?string $status = null, ?string $type = null, ?int $brandId = null, ?int $managerId = null, int $page = 1): array;
    public function findByOrganizationAndId(int $organizationId, int $id): Material;
    public function findById(int $id): Material;
    public function create(array $data): Material;
    public function update(int $id, array $data): Material;
    public function delete(int $id): void;
    public function findByManagerAndId(int $managerId, int $id): Material;
    public function approve(int $id, int $approvedBy): Material;
    public function findAllApprovedByRep(int $repId, ?string $search = null, ?string $type = null, int $page = 1, ?int $managerId = null, ?int $brandId = null): array;
}
