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
        $authUser = $this->request->getAttribute('auth_user');
        $organizationId = (int) ($authUser['organization_id'] ?? 0);
        $role = $authUser['role'] ?? null;
        
        $managerId = null;
        if ($role === 'manager') {
            $managerId = (int) ($authUser['id'] ?? 0);
        }

        $limit = (int) ($this->request->getQueryParams()['limit'] ?? 10);
        if ($limit > 50) {
            $limit = 50;
        }

        $metrics = $this->metricsRepository->getTopMaterialsMetrics($organizationId, $managerId, [], $limit);

        return $this->respondWithData($metrics);
    }
}
