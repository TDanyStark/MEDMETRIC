<?php

declare(strict_types=1);

namespace App\Application\Actions\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * GET /metrics/top-materials-list
 *
 * Paginated sibling of GetTopMaterialsAction, exclusive to the "Detalle de
 * materiales" table. GetTopMaterialsAction/getTopMaterialsMetrics keep
 * feeding the TopMaterialsChart unchanged.
 */
class GetTopMaterialsListAction extends MetricsAction
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

        $q = $this->request->getQueryParams()['q'] ?? null;
        if ($q !== null && $q !== '') {
            $filters['q'] = trim($q);
        }

        $page = (int)($this->request->getQueryParams()['page'] ?? 1);

        $timezone = $this->resolveOrgTimezone($this->organizationRepository, $authUser ? $authUser->getOrganizationId() : null);

        $metrics = $this->metricsRepository->getTopMaterialsList($organizationId, $managerId, $filters, $page, $timezone);

        return $this->respondWithData($metrics);
    }
}
