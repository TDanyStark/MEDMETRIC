<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /v1/rep/metrics/sessions?page&q&status&session_id&material_id&start_date&end_date
 *
 * Paginated list of the authenticated rep's own visit sessions with view
 * and comment metrics attached. Every filter here (including `session_id`
 * / `material_id`) can only NARROW the `vs.rep_id = :rep` base predicate —
 * a session_id belonging to another rep yields an empty page, never that
 * rep's data (spec "Rep Data Isolation" — "Manipulación de query param").
 */
class SessionsAction extends RepMetricsAction
{
    protected function action(): Response
    {
        $repId = $this->resolveRepId();
        $params = $this->request->getQueryParams();

        $filters = $this->dateRangeFilters();

        if (!empty($params['q'])) {
            $filters['q'] = trim((string) $params['q']);
        }

        if (!empty($params['status']) && in_array($params['status'], ['all', 'viewed', 'never'], true)) {
            $filters['status'] = (string) $params['status'];
        }

        if (!empty($params['session_id'])) {
            $filters['session_id'] = (int) $params['session_id'];
        }

        if (!empty($params['material_id'])) {
            $filters['material_id'] = (int) $params['material_id'];
        }

        $page = $this->queryPage();
        $timezone = $this->resolveTimezone();

        $data = $this->repMetricsRepository->sessions($repId, $filters, $page, $timezone);

        return $this->respondWithData($data);
    }
}
