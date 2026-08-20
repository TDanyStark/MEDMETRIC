<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /v1/rep/metrics/device-split?start_date&end_date
 *
 * Mobile vs. desktop split of doctor material opens for the authenticated
 * rep only. Classification happens server-side
 * (App\Infrastructure\Support\DeviceClassifier) — the raw `user_agent`
 * value is never included in the response (spec "Doctor Privacy").
 */
class DeviceSplitAction extends RepMetricsAction
{
    protected function action(): Response
    {
        $repId = $this->resolveRepId();
        $filters = $this->dateRangeFilters();
        $timezone = $this->resolveTimezone();

        $data = $this->repMetricsRepository->deviceSplit($repId, $filters, $timezone);

        return $this->respondWithData($data);
    }
}
