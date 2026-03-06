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
        $authUser = $this->request->getAttribute('auth_user');
        $organizationId = (int) ($authUser['organization_id'] ?? 0);
        $role = $authUser['role'] ?? null;

        $managerId = null;
        if ($role === 'manager') {
            $managerId = (int) ($authUser['id'] ?? 0);
        }

        $metrics = $this->metricsRepository->getMaterialViewsMetrics($organizationId, $managerId);

        return $this->respondWithData($metrics);
    }
}
