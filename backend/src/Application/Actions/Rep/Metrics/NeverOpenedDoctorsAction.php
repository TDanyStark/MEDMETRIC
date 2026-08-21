<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /v1/rep/metrics/never-opened-doctors?page&q&start_date&end_date
 *
 * Paginated "médicos que nunca abrieron" — one row per DISTINCT DOCTOR,
 * deduplicated by `doctor_id` (fix sdd/group-by-id-not-name). Replaces the
 * frontend's previous use of `sessions()?status=never`, which returned one
 * row per SESSION and displayed the raw `doctor_name` text snapshot — with
 * several organizations having doctors that share the exact same name,
 * that could visually merge/confuse distinct people. `sessions()` itself
 * is left untouched (still session-level, still used for other statuses/
 * filters and covered by RepMetricsIsolationTest) — this is a NEW,
 * dedicated endpoint rather than a breaking change to an existing one.
 *
 * See `RepMetricsRepositoryInterface::neverOpenedDoctors()` for the full
 * dedup/identity rationale and the "tarjeta == tabla" invariant against
 * `summary()['doctors_never_opened']`.
 */
class NeverOpenedDoctorsAction extends RepMetricsAction
{
    protected function action(): Response
    {
        $repId = $this->resolveRepId();
        $params = $this->request->getQueryParams();

        $filters = $this->dateRangeFilters();

        if (!empty($params['q'])) {
            $filters['q'] = trim((string) $params['q']);
        }

        $page = $this->queryPage();
        $timezone = $this->resolveTimezone();

        $data = $this->repMetricsRepository->neverOpenedDoctors($repId, $filters, $page, $timezone);

        return $this->respondWithData($data);
    }
}
