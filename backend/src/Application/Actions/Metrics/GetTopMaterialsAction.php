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
        $organizationId = (int) $this->request->getAttribute('user_organization_id');
        $role = $this->request->getAttribute('user_role');
        
        $managerId = null;
        if ($role === 'manager') {
            $managerId = (int) $this->request->getAttribute('user_id');
        }

        $limit = (int) ($this->request->getQueryParams()['limit'] ?? 10);
        if ($limit > 50) {
            $limit = 50;
        }

        $metrics = $this->metricsRepository->getTopMaterialsMetrics($organizationId, $managerId, [], $limit);

        return $this->respondWithData($metrics);
    }
}
