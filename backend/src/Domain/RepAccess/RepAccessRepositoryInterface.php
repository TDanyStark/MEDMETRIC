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

    /**
     * Reps ACTIVELY subscribed to this manager (rma.active = 1) — the inverse
     * of getAvailableRepsForManager(), which returns unsubscribed reps. Used
     * by the /doctors representative-filter typeahead so a manager only sees
     * reps whose doctors they can actually filter by.
     *
     * @return array<int, array{id: int, name: string, email: string}>
     */
    public function getSubscribedRepsForManager(int $managerId, ?string $search = null, int $limit = 20): array;

    /**
     * All reps in the organization, regardless of subscription state. Used by
     * the /doctors representative-filter typeahead for org_admin, who is not
     * bound to any single manager's subscriptions.
     *
     * @return array<int, array{id: int, name: string, email: string}>
     */
    public function findRepsByOrg(int $organizationId, ?string $search = null, int $limit = 20): array;

    /**
     * True if $repId is a valid representative for assignment to a doctor,
     * scoped by the caller's role:
     *   - org_admin (managerId=null): $repId must be a role='rep' user in
     *     $organizationId — any org rep is assignable.
     *   - manager ($managerId set): $repId must be actively subscribed
     *     (rep_manager_access.active=1) to that manager AND in
     *     $organizationId — a manager can only assign reps they actually
     *     manage.
     * Used by Create/UpdateDoctorAction to reject cross-organization or
     * out-of-scope assigned_rep_id values before they are ever persisted.
     */
    public function isRepAssignable(int $repId, int $organizationId, ?int $managerId = null): bool;
}
