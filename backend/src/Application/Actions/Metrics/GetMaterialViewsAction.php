<?php

declare(strict_types=1);

namespace App\Application\Actions\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

class GetMaterialViewsAction extends MetricsAction
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

        $timezone = $this->resolveOrgTimezone($this->organizationRepository, $authUser ? $authUser->getOrganizationId() : null);

        $metrics = $this->metricsRepository->getMaterialViewsMetrics($organizationId, $managerId, $filters, $timezone);

        return $this->respondWithData($metrics);
    }
}
