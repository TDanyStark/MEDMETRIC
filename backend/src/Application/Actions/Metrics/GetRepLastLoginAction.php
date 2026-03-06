<?php

declare(strict_types=1);

namespace App\Application\Actions\Metrics;

use Psr\Http\Message\ResponseInterface as Response;

class GetRepLastLoginAction extends MetricsAction
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

        $metrics = $this->metricsRepository->getRepLastLoginMetrics($organizationId, $managerId);

        return $this->respondWithData($metrics);
    }
}
