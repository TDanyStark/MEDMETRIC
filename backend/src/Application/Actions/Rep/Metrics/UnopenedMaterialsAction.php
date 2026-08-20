<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /v1/rep/metrics/unopened-materials?page&start_date&end_date
 *
 * Paginated (session, material) breakdown of the "materiales sin abrir"
 * stat chip in `summary()` (`materials_unopened`) — lets the rep see WHICH
 * materials are behind that number, not just the count. NEW endpoint
 * rather than an extension of `sessions()`: a session-level row cannot
 * represent "2 materials opened, 1 not" for the same session. See
 * `RepMetricsRepositoryInterface::unopenedMaterials()` for the full
 * rationale, including why this is intentionally NOT a subset of
 * `sessions()?status=never` ("médicos que nunca abrieron").
 */
class UnopenedMaterialsAction extends RepMetricsAction
{
    protected function action(): Response
    {
        $repId = $this->resolveRepId();
        $filters = $this->dateRangeFilters();
        $page = $this->queryPage();
        $timezone = $this->resolveTimezone();

        $data = $this->repMetricsRepository->unopenedMaterials($repId, $filters, $page, $timezone);

        return $this->respondWithData($data);
    }
}
