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

    /**
     * @return array
     */
    public function getTopMaterialsMetrics(int $organizationId, ?int $managerId, array $filters = [], int $limit = 10): array;
}
