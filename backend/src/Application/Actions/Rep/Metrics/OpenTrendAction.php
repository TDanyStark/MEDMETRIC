<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /v1/rep/metrics/open-trend?start_date&end_date
 *
 * Daily trend of sessions created vs. sessions viewed by the doctor, for
 * the authenticated rep only. Flat array response (not paginated) —
 * `sessions_created`/`sessions_viewed` are two INDEPENDENT series (never
 * stacked — spec "Chart Data Correctness").
 */
class OpenTrendAction extends RepMetricsAction
{
    protected function action(): Response
    {
        $repId = $this->resolveRepId();
        $filters = $this->dateRangeFilters();
        $timezone = $this->resolveTimezone();

        $data = $this->repMetricsRepository->openTrend($repId, $filters, $timezone);

        return $this->respondWithData($data);
    }
}
