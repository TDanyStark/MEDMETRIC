<?php

declare(strict_types=1);

namespace App\Domain\AdminUser;

interface AdminUserRepositoryInterface
{
    /**
     * Return all users with organization and role info, with filtering and pagination.
     *
     * @param string|array|null $role Single role name or array of role names to filter by
     * @return array{items: AdminUser[], total: int, page: int, per_page: int, last_page: int}
     */
    public function findAll($role = null, ?int $organizationId = null, ?string $search = null, int $page = 1): array;

    /**
     * Find a single user by ID.
     *
     * @throws AdminUserNotFoundException
     */
    public function findById(int $id): AdminUser;

    /**
     * Create a new user. Returns the created entity.
     */
    public function create(array $data): AdminUser;

    /**
     * Update an existing user. Returns the updated entity.
     *
     * @throws AdminUserNotFoundException
     */
    public function update(int $id, array $data): AdminUser;

    /**
     * Check whether an email is already taken (optionally excluding a given id).
     */
    public function emailExists(string $email, ?int $excludeId = null): bool;

    /**
     * Return all roles as id => name map.
     */
    public function findAllRoles(): array;

    /**
     * Get managers for a given organization (for subscription management).
     *
     * @return AdminUser[]
     */
    public function findManagersByOrganization(int $organizationId): array;

    /**
     * Subscribe a rep to a manager.
     */
    public function subscribeRepToManager(int $repId, int $managerId): void;

    /**
     * Unsubscribe a rep from a manager.
     */
    public function unsubscribeRepFromManager(int $repId, int $managerId): void;

    /**
     * Get manager subscriptions for a rep.
     *
     * @return array
     */
    public function getRepSubscriptions(int $repId): array;
}
