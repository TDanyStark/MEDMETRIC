<?php

declare(strict_types=1);

namespace App\Application\Actions\Metrics;

use App\Application\Actions\Action;
use App\Domain\Metrics\MetricsRepositoryInterface;
use Psr\Log\LoggerInterface;

abstract class MetricsAction extends Action
{
    protected MetricsRepositoryInterface $metricsRepository;

    public function __construct(LoggerInterface $logger, MetricsRepositoryInterface $metricsRepository)
    {
        parent::__construct($logger);
        $this->metricsRepository = $metricsRepository;
    }

    /**
     * Read a query param that may be a comma-separated list or repeated array
     * (e.g. "ids=1,2,3" or "ids[]=1&ids[]=2") and return a clean list of
     * positive integers.
     *
     * @return int[]
     */
    protected function queryIdList(string $key): array
    {
        $raw = $this->request->getQueryParams()[$key] ?? null;
        if ($raw === null || $raw === '') {
            return [];
        }

        $parts = is_array($raw) ? $raw : explode(',', (string) $raw);
        $ids = [];
        foreach ($parts as $part) {
            $id = (int) trim((string) $part);
            if ($id > 0) {
                $ids[] = $id;
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * Build the common scope + filter array shared by all metrics endpoints.
     * Reads material_id and rep_id (CSV/array) plus optional date range.
     */
    protected function buildCommonFilters(): array
    {
        $filters = [];

        $materialIds = $this->queryIdList('material_id');
        if (!empty($materialIds)) {
            $filters['material_ids'] = $materialIds;
        }

        $repIds = $this->queryIdList('rep_id');
        if (!empty($repIds)) {
            $filters['rep_ids'] = $repIds;
        }

        $startDate = $this->request->getQueryParams()['start_date'] ?? null;
        if ($startDate !== null && $startDate !== '') {
            $filters['start_date'] = $startDate;
        }

        $endDate = $this->request->getQueryParams()['end_date'] ?? null;
        if ($endDate !== null && $endDate !== '') {
            $filters['end_date'] = $endDate;
        }

        return $filters;
    }
}
