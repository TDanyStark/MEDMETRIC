<?php

declare(strict_types=1);

namespace App\Domain\Doctor;

interface DoctorRepositoryInterface
{
    public function create(int $organizationId, array $data): Doctor;

    /**
     * @param int|null $restrictRepId When provided (role==='rep'), the update is
     *   scoped to doctors owned by this rep: if the doctor exists but
     *   assigned_rep_id !== $restrictRepId, a DoctorNotFoundException is thrown
     *   (same not-found path as org mismatch) instead of leaking existence.
     */
    public function update(int $id, int $organizationId, array $data, ?int $restrictRepId = null): Doctor;

    public function findById(int $id, int $organizationId): ?Doctor;

    /**
     * Lightweight lookup for the search/typeahead endpoint.
     * Searches by name/document/institution using LIKE.
     *
     * @param int|null $restrictRepId When provided (role==='rep'), results are
     *   further restricted to doctors with assigned_rep_id = $restrictRepId.
     * @return Doctor[]
     */
    public function search(int $organizationId, string $q, int $limit = 20, ?int $restrictRepId = null): array;

    /**
     * Paginated listing with optional filters.
     *
     * @param array{q?: ?string, region?: ?string, category?: ?string, assigned_rep_id?: ?int} $filters
     * @param int|null $restrictRepId When provided (role==='rep'), forces
     *   assigned_rep_id = $restrictRepId regardless of $filters, overriding any
     *   client-supplied value.
     */
    public function findAllByOrg(int $organizationId, array $filters, int $page, ?int $restrictRepId = null): array;

    /**
     * Idempotent upsert used by the Kardex import: matches on
     * (organization_id, external_id). Inserts a new doctor if no match exists,
     * otherwise updates the existing one with the provided data.
     */
    public function upsertByExternalId(int $organizationId, string $externalId, array $data): Doctor;

    /**
     * Sets last_visit_date = CURDATE() for the given doctor.
     */
    public function touchLastVisit(int $id): void;
}
