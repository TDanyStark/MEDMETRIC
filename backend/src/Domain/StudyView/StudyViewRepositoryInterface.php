<?php

declare(strict_types=1);

namespace App\Domain\StudyView;

interface StudyViewRepositoryInterface
{
    /**
     * Create a new study view record when a viewer opens a study
     */
    public function createView(array $data): int;

    /**
     * Find a view by ID
     */
    public function findById(int $id): ?array;

    /**
     * Check if a study's parent material is part of a visit session
     */
    public function isStudyInSession(int $studyId, int $sessionId): bool;

    /**
     * Get all views for a study with optional filters
     */
    public function findByStudy(int $studyId, ?string $viewerType = null, int $page = 1): array;

    /**
     * Batch count of views per study id, for a set of study ids. Used only for
     * material-detail view_count — never blended into material metrics.
     *
     * @param int[] $studyIds
     * @return array<int, int> map of study_id => view count
     */
    public function countByStudyIds(array $studyIds): array;
}
