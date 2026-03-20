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

        $materialId = $this->request->getQueryParams()['material_id'] ?? null;
        $startDate = $this->request->getQueryParams()['start_date'] ?? null;
        $endDate = $this->request->getQueryParams()['end_date'] ?? null;
        $q = $this->request->getQueryParams()['q'] ?? null;

        $filters = [];
        if ($materialId !== null && $materialId !== '') {
            $filters['material_id'] = (int)$materialId;
        }
        if ($startDate !== null && $startDate !== '') {
            $filters['start_date'] = $startDate;
        }
        if ($endDate !== null && $endDate !== '') {
            $filters['end_date'] = $endDate;
        }
        if ($q !== null && $q !== '') {
            $filters['q'] = trim($q);
        }

        $metrics = $this->metricsRepository->getTopMaterialsMetrics($organizationId, $managerId, $filters, $limit);

        return $this->respondWithData($metrics);
    }
}
