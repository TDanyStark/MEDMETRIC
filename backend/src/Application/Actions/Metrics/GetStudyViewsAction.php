<?php

declare(strict_types=1);

namespace App\Application\Actions\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /metrics/study-views
 *
 * Mirrors GetMaterialViewsAction's structure but queries study_views /
 * material_studies instead of material_views. This is a FULLY SEPARATE
 * report — never merged with material metrics data (design.md decision:
 * study_views.study_id FK is incompatible with material_views.material_id
 * NOT NULL, so this stays additive/parallel, not blended into
 * getTopMaterialsMetrics or getRepAdoptionMetrics).
 */
class GetStudyViewsAction extends MetricsAction
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

        $metrics = $this->metricsRepository->getStudyViewsMetrics($organizationId, $managerId, $filters);

        return $this->respondWithData($metrics);
    }
}
