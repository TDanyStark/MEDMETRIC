<?php

declare(strict_types=1);

namespace App\Domain\Organization;

interface OrganizationRepositoryInterface
{
    /**
     * Return all organizations with optional filtering and pagination.
     *
     * @return array{items: Organization[], total: int, page: int, per_page: int, last_page: int}
     */
    public function findAll(?string $search = null, int $page = 1): array;

    /**
     * Find a single organization by ID.
     *
     * @throws OrganizationNotFoundException
     */
    public function findById(int $id): Organization;

    /**
     * Create a new organization. Returns the created entity.
     */
    public function create(string $name, string $slug, bool $active): Organization;

    /**
     * Update an existing organization. Returns the updated entity.
     *
     * @throws OrganizationNotFoundException
     */
    public function update(int $id, array $data): Organization;

    /**
     * Check whether a slug is already taken (optionally excluding a given id).
     */
    public function slugExists(string $slug, ?int $excludeId = null): bool;
}
