<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\Organization;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\Organization\OrganizationRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class UpdateOrganizationAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private OrganizationRepositoryInterface $organizationRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $id   = (int) $this->resolveArg('id');
        $body = $this->getFormData();

        // Validate slug uniqueness if provided
        if (!empty($body['slug'])) {
            $slug = trim((string) $body['slug']);

            if ($this->organizationRepository->slugExists($slug, $id)) {
                $error = new ActionError(ActionError::VALIDATION_ERROR, "Slug '{$slug}' is already taken.");
                return $this->respond(new ActionPayload(422, null, $error));
            }

            $body['slug'] = $slug;
        }

        if (isset($body['name'])) {
            $body['name'] = trim((string) $body['name']);

            if ($body['name'] === '') {
                $error = new ActionError(ActionError::VALIDATION_ERROR, 'Organization name cannot be empty.');
                return $this->respond(new ActionPayload(422, null, $error));
            }
        }

        $organization = $this->organizationRepository->update($id, (array) $body);

        $this->logger->info('Organization updated', ['id' => $id]);

        return $this->respondWithData($organization, 200, 'Organization updated successfully.');
    }
}
