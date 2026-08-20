<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /v1/rep/metrics/top-materials?page&q&start_date&end_date
 *
 * Paginated list of materials the authenticated rep has included in their
 * own visit sessions, most doctor-opened first. Flat pagination envelope
 * (PaginationConfig::PAGE_SIZE) — {items,total,page,per_page,last_page}.
 */
class TopMaterialsAction extends RepMetricsAction
{
    protected function action(): Response
    {
        $repId = $this->resolveRepId();
        $filters = $this->dateRangeFilters();

        $q = $this->request->getQueryParams()['q'] ?? null;
        if ($q !== null && $q !== '') {
            $filters['q'] = trim((string) $q);
        }

        $page = $this->queryPage();
        $timezone = $this->resolveTimezone();

        $data = $this->repMetricsRepository->topMaterials($repId, $filters, $page, $timezone);

        return $this->respondWithData($data);
    }
}
