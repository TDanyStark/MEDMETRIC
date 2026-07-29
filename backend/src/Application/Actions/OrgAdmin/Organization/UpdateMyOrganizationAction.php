<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Organization;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\Organization\OrganizationRepositoryInterface;
use App\Infrastructure\Config\TimezoneConfig;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * PUT /v1/org-admin/organization — the authenticated org_admin changes
 * THEIR OWN organization's timezone. Scope is deliberately minimal (only
 * `timezone`): org_admin already has no name/slug/active management
 * surface for their own organization (that remains superadmin-only), and
 * this endpoint does not add one.
 *
 * Authorization is structural, not just role-gated: the target
 * organization id is resolved EXCLUSIVELY from the authenticated user's
 * JWT-derived organization_id (there is no {id} route param and any
 * organization_id/id present in the request body is ignored), so an
 * org_admin has no way to address a different organization through this
 * endpoint regardless of payload content.
 */
class UpdateMyOrganizationAction extends Action
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

        $body = $this->getFormData();
        $timezone = isset($body['timezone']) ? trim((string) $body['timezone']) : '';

        if ($timezone === '' || !in_array($timezone, TimezoneConfig::LATAM_ZONES, true)) {
            $error = new ActionError(
                ActionError::VALIDATION_ERROR,
                "Invalid timezone '{$timezone}'. Must be one of the supported zones (see GET /v1/timezones)."
            );
            return $this->respond(new ActionPayload(422, null, $error));
        }

        $organization = $this->organizationRepository->update($organizationId, ['timezone' => $timezone]);

        $this->logger->info('Organization timezone updated by org_admin', [
            'organization_id' => $organizationId,
        ]);

        return $this->respondWithData($organization, 200, 'Zona horaria actualizada correctamente.');
    }
}
