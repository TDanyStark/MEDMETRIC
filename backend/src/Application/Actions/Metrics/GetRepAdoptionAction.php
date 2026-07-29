<?php

declare(strict_types=1);

namespace App\Application\Actions\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

class GetRepAdoptionAction extends MetricsAction
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

        // rep-adoption ignores material_ids (it's per-rep) but uses rep_ids + dates.
        $filters = $this->buildCommonFilters();

        $page = (int)($this->request->getQueryParams()['page'] ?? 1);

        $timezone = $this->resolveOrgTimezone($this->organizationRepository, $authUser ? $authUser->getOrganizationId() : null);

        $metrics = $this->metricsRepository->getRepAdoptionMetrics($organizationId, $managerId, $filters, $page, $timezone);

        return $this->respondWithData($metrics);
    }
}
