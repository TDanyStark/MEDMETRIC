<?php

declare(strict_types=1);

namespace App\Domain\MaterialStudy;

interface MaterialStudyRepositoryInterface
{
    /**
     * Find all studies belonging to a single material, ordered by created_at ASC
     */
    public function findAllByMaterial(int $materialId): array;

    /**
     * Find all studies for a batch of material ids in one query, keyed by material_id.
     * Used to avoid N+1 queries when attaching studies to material lists.
     *
     * @param int[] $materialIds
     * @return array<int, MaterialStudy[]>
     */
    public function findAllByMaterialIds(array $materialIds): array;

    /**
     * Find a study by id, scoped to a material belonging to the given organization
     */
    public function findByOrganizationAndId(int $organizationId, int $id): MaterialStudy;

    /**
     * Find a study by id, scoped to a material managed by the given manager
     * (via manager_brands, active=1). No status filter — managers can manage
     * studies even when the parent material is approved.
     */
    public function findByManagerAndId(int $managerId, int $id): MaterialStudy;

    public function findById(int $id): MaterialStudy;

    public function create(array $data): MaterialStudy;

    public function update(int $id, array $data): MaterialStudy;

    public function delete(int $id): void;
}
