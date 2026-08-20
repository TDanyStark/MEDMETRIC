<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /v1/rep/metrics/summary
 *
 * Headline counters for the authenticated rep's own visit sessions.
 * `repId` is resolved SOLELY from the JWT (RepMetricsAction::resolveRepId());
 * `start_date`/`end_date` are the only accepted query params and can only
 * narrow the window, never change whose data is returned.
 */
class SummaryAction extends RepMetricsAction
{
    protected function action(): Response
    {
        $repId = $this->resolveRepId();
        $filters = $this->dateRangeFilters();
        $timezone = $this->resolveTimezone();

        $data = $this->repMetricsRepository->summary($repId, $filters, $timezone);

        return $this->respondWithData($data);
    }
}
