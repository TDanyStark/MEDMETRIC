<?php

declare(strict_types=1);

namespace App\Application\Actions\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

class GetTopMaterialsAction extends MetricsAction
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

        $limit = (int) ($this->request->getQueryParams()['limit'] ?? 10);
        if ($limit > 50) {
            $limit = 50;
        }

        $filters = $this->buildCommonFilters();

        $q = $this->request->getQueryParams()['q'] ?? null;
        if ($q !== null && $q !== '') {
            $filters['q'] = trim($q);
        }

        $timezone = $this->resolveOrgTimezone($this->organizationRepository, $authUser ? $authUser->getOrganizationId() : null);

        $metrics = $this->metricsRepository->getTopMaterialsMetrics($organizationId, $managerId, $filters, $limit, $timezone);

        return $this->respondWithData($metrics);
    }
}
