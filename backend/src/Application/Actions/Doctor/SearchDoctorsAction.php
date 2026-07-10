<?php

declare(strict_types=1);

namespace App\Application\Actions\Doctor;

use App\Application\Actions\Action;
use App\Domain\Doctor\DoctorRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Lightweight typeahead/select search used when creating a visit session.
 * GET /v1/doctors/search?q=...
 */
class SearchDoctorsAction extends Action
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

        $q = trim((string) ($queryParams['q'] ?? ''));

        $doctors = $this->doctorRepository->search($organizationId, $q, 20);

        $items = array_map(fn($doctor) => $doctor->toSearchResult(), $doctors);

        return $this->respondWithData($items);
    }
}
