<?php

declare(strict_types=1);

namespace App\Application\Actions\Doctor;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Role-aware representative typeahead for the /doctors filter.
 * GET /v1/doctors/reps/search?q=
 *
 * - org_admin: all reps in their organization.
 * - manager:   only reps actively subscribed to them (rep_manager_access.active = 1).
 * - rep:       denied — a rep has no need to filter doctors by other reps
 *              (ListDoctorsAction already hard-scopes them to their own).
 */
class RepSearchAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private RepAccessRepositoryInterface $repAccessRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $role     = $authUser['role'] ?? null;

        if ($role === 'rep') {
            return $this->respond(new ActionPayload(
                403,
                null,
                new ActionError(ActionError::INSUFFICIENT_PRIVILEGES, 'No autorizado.')
            ));
        }

        $organizationId = (int) ($authUser['organization_id'] ?? 0);
        if (empty($organizationId)) {
            return $this->respondWithData(['error' => 'organization_id is required'], 422);
        }

        $q = trim((string) ($this->request->getQueryParams()['q'] ?? ''));

        $reps = match ($role) {
            'org_admin' => $this->repAccessRepository->findRepsByOrg($organizationId, $q, 20),
            'manager'   => $this->repAccessRepository->getSubscribedRepsForManager((int) $authUser['id'], $q, 20),
            default     => [],
        };

        return $this->respondWithData($reps);
    }
}
