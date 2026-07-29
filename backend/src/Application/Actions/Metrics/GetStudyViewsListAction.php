<?php

declare(strict_types=1);

namespace App\Application\Actions\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /metrics/study-views-list
 *
 * Paginated row-level detail for the "Registro de Visualizaciones de
 * Estudios" table. Mirrors GetMaterialViewsListAction's structure but reads
 * study_views / material_studies. Fully separate from
 * GetStudyViewsAction/getStudyViewsMetrics (the aggregated chart data),
 * which is never modified.
 */
class GetStudyViewsListAction extends MetricsAction
{
    /**
     * {@inheritdoc}
     */
    protected function action(): Response
    {
        $authUser = $this->getAuthUser();
        $organizationId = $authUser ? $authUser->getOrganizationId() : 0;
        $role = $authUser ? $authUser->getRole() : null;

        $managerId = null;
        if ($role === 'manager') {
            $managerId = $authUser ? $authUser->getId() : 0;
        }

        $filters = $this->buildCommonFilters();

        // study_id is a study-metrics-specific filter, not part of the
        // common filter set shared with material metrics endpoints.
        $studyIds = $this->queryIdList('study_id');
        if (!empty($studyIds)) {
            $filters['study_ids'] = $studyIds;
        }

        $page = (int)($this->request->getQueryParams()['page'] ?? 1);

        $timezone = $this->resolveOrgTimezone($this->organizationRepository, $authUser ? $authUser->getOrganizationId() : null);

        $metrics = $this->metricsRepository->getStudyViewsList($organizationId, $managerId, $filters, $page, $timezone);

        return $this->respondWithData($metrics);
    }
}
