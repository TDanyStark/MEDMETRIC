<?php

declare(strict_types=1);

namespace App\Application\Actions\Doctor;

use App\Application\Actions\Action;
use App\Domain\Doctor\DoctorRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Paginated doctor directory listing.
 * GET /v1/doctors?q=&rep_id=&page=
 *
 * `rep_id` is the current filter param (replaces the removed Region/Category
 * filters, per sdd/doctors-management-fixes). The legacy `assigned_rep_id`
 * param name is still accepted for backward compatibility with any existing
 * bookmarked/shared links.
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

        // rep_id is the current param name; assigned_rep_id is kept as a
        // fallback alias for backward compatibility.
        $repIdParam = $queryParams['rep_id'] ?? $queryParams['assigned_rep_id'] ?? null;

        $filters = [
            'q'               => $queryParams['q'] ?? null,
            'region'          => $queryParams['region'] ?? null,
            'category'        => $queryParams['category'] ?? null,
            'assigned_rep_id' => $repIdParam !== null && $repIdParam !== ''
                ? (int) $repIdParam
                : null,
        ];

        // Reps are hard-scoped to their own doctors from auth_user, never from
        // client-supplied assigned_rep_id/rep_id — this cannot be overridden.
        $restrictRepId = ($authUser['role'] ?? null) === 'rep' ? (int) $authUser['id'] : null;

        $result = $this->doctorRepository->findAllByOrg($organizationId, $filters, $page, $restrictRepId);

        return $this->respondWithData($result);
    }
}
