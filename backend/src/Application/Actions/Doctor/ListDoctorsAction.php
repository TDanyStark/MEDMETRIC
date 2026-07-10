<?php

declare(strict_types=1);

namespace App\Application\Actions\Doctor;

use App\Application\Actions\Action;
use App\Domain\Doctor\DoctorRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Paginated doctor directory listing.
 * GET /v1/doctors?q=&region=&category=&assigned_rep_id=&page=
 */
class ListDoctorsAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private DoctorRepositoryInterface $doctorRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $queryParams  = $this->request->getQueryParams();
        $authUser     = $this->request->getAttribute('auth_user');
        $isSuperadmin = $authUser !== null && $authUser['role'] === 'superadmin';

        $organizationId = $isSuperadmin
            ? (int) ($queryParams['organization_id'] ?? 0)
            : (int) ($authUser['organization_id'] ?? 0);

        if (empty($organizationId)) {
            return $this->respondWithData(['error' => 'organization_id is required'], 422);
        }

        $page = (int) ($queryParams['page'] ?? 1);
        if ($page < 1) {
            $page = 1;
        }

        $filters = [
            'q'               => $queryParams['q'] ?? null,
            'region'          => $queryParams['region'] ?? null,
            'category'        => $queryParams['category'] ?? null,
            'assigned_rep_id' => isset($queryParams['assigned_rep_id']) && $queryParams['assigned_rep_id'] !== ''
                ? (int) $queryParams['assigned_rep_id']
                : null,
        ];

        $result = $this->doctorRepository->findAllByOrg($organizationId, $filters, $page);

        return $this->respondWithData($result);
    }
}
