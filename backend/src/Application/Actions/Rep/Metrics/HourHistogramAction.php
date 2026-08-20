<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /v1/rep/metrics/hour-histogram?start_date&end_date
 *
 * Hour-of-day (org-local, 0-23) histogram of doctor material opens for the
 * authenticated rep only. Always returns exactly 24 entries (0-filled).
 */
class HourHistogramAction extends RepMetricsAction
{
    protected function action(): Response
    {
        $repId = $this->resolveRepId();
        $filters = $this->dateRangeFilters();
        $timezone = $this->resolveTimezone();

        $data = $this->repMetricsRepository->hourHistogram($repId, $filters, $timezone);

        return $this->respondWithData($data);
    }
}
