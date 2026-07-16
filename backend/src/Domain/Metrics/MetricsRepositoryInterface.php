<?php

declare(strict_types=1);

namespace App\Domain\Metrics;

interface MetricsRepositoryInterface
{
    /**
     * @return array
     */
    public function getMaterialViewsMetrics(int $organizationId, ?int $managerId, array $filters = []): array;

    /**
     * @return array
     */
    public function getRepLastLoginMetrics(int $organizationId, ?int $managerId, array $filters = []): array;

    public function getTopMaterialsMetrics(int $organizationId, ?int $managerId, array $filters = [], int $limit = 10): array;

    /**
     * @return array
     */
    public function getMaterialViewsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1): array;

    /**
     * Adoption metrics per representative: how many distinct materials each rep
     * has opened, total views, last activity and adoption percentage.
     *
     * @return array
     */
    public function getRepAdoptionMetrics(int $organizationId, ?int $managerId, array $filters = []): array;

    /**
     * Study views metrics — fully separate report from material metrics
     * (getTopMaterialsMetrics/getRepAdoptionMetrics are never modified to
     * include this data; see design.md "Metrics integration" decision).
     *
     * @return array
     */
    public function getStudyViewsMetrics(int $organizationId, ?int $managerId, array $filters = []): array;
}
