<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Organization;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\Organization\OrganizationRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * GET /v1/org-admin/organization — return the authenticated org_admin's
 * OWN organization (id, name, slug, active, timezone, timestamps).
 *
 * The organization id is resolved EXCLUSIVELY from the authenticated
 * user's JWT-derived organization_id — never from a route param or the
 * request body — so there is no way for an org_admin to read another
 * organization through this endpoint.
 */
class GetMyOrganizationAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private OrganizationRepositoryInterface $organizationRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->getAuthUser();
        $organizationId = $authUser !== null ? $authUser->getOrganizationId() : null;

        if ($organizationId === null) {
            $error = new ActionError(ActionError::VALIDATION_ERROR, 'No organization associated with this account.');
            return $this->respond(new ActionPayload(422, null, $error));
        }

        $organization = $this->organizationRepository->findById($organizationId);

        return $this->respondWithData($organization);
    }
}
