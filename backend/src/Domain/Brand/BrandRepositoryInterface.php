<?php

declare(strict_types=1);

namespace App\Domain\Brand;

interface BrandRepositoryInterface
{
    public function findAllByManager(int $managerId, ?string $search = null, int $page = 1): array;
    public function findById(int $id): Brand;
    public function create(int $organizationId, int $managerId, string $name, ?string $description): Brand;
    public function update(int $id, array $data): Brand;
    public function delete(int $id): void;
    public function findByManagerAndId(int $managerId, int $id): Brand;
}
