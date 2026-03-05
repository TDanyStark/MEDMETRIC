<?php

declare(strict_types=1);

namespace App\Domain\MaterialView;

interface MaterialViewRepositoryInterface
{
    /**
     * Create a new material view record when a viewer opens a material
     */
    public function createView(array $data): int;

    /**
     * Find a view by ID
     */
    public function findById(int $id): ?array;

    /**
     * Check if a material is part of a visit session
     */
    public function isMaterialInSession(int $materialId, int $sessionId): bool;

    /**
     * Get all views for a material with optional filters
     */
    public function findByMaterial(int $materialId, ?string $viewerType = null, int $page = 1): array;
}
