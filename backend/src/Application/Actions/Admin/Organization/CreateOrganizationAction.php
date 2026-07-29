<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\Organization;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\Organization\OrganizationRepositoryInterface;
use App\Infrastructure\Config\TimezoneConfig;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class CreateOrganizationAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private OrganizationRepositoryInterface $organizationRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $body = $this->getFormData();

        $name   = trim((string) ($body['name']   ?? ''));
        $slug   = trim((string) ($body['slug']   ?? ''));
        $active = isset($body['active']) ? (bool) $body['active'] : true;

        // Timezone is optional on create: omitted/empty -> null, which lets
        // the DB column DEFAULT ('America/Santiago') apply. When provided,
        // it must be one of the curated allow-list zones — a typo must be
        // rejected, never silently coerced to the default.
        $timezone = isset($body['timezone']) ? trim((string) $body['timezone']) : null;
        if ($timezone === '') {
            $timezone = null;
        }

        // Validation
        if ($name === '') {
            $error = new ActionError(ActionError::VALIDATION_ERROR, 'Organization name is required.');
            return $this->respond(new ActionPayload(422, null, $error));
        }

        if ($timezone !== null && !in_array($timezone, TimezoneConfig::LATAM_ZONES, true)) {
            $error = new ActionError(
                ActionError::VALIDATION_ERROR,
                "Invalid timezone '{$timezone}'. Must be one of the supported zones (see GET /v1/timezones)."
            );
            return $this->respond(new ActionPayload(422, null, $error));
        }

        if ($slug === '') {
            // Auto-generate slug from name
            $slug = $this->generateSlug($name);
        }

        if ($this->organizationRepository->slugExists($slug)) {
            $error = new ActionError(ActionError::VALIDATION_ERROR, "Slug '{$slug}' is already taken.");
            return $this->respond(new ActionPayload(422, null, $error));
        }

        $organization = $this->organizationRepository->create($name, $slug, $active, $timezone);

        $this->logger->info('Organization created', ['id' => $organization->getId(), 'name' => $name]);

        return $this->respondWithData($organization, 201, 'Organization created successfully.');
    }

    private function generateSlug(string $name): string
    {
        $slug = strtolower($name);
        $slug = preg_replace('/[^a-z0-9\s-]/', '', $slug);
        $slug = preg_replace('/[\s-]+/', '-', $slug);

        return trim($slug, '-');
    }
}
