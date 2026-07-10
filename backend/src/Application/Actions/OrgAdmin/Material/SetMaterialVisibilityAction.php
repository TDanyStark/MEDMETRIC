<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Material;

use App\Application\Actions\Action;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class SetMaterialVisibilityAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialRepositoryInterface $materialRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $organizationId = (int) $authUser['organization_id'];
        $materialId = (int) $this->resolveArg('id');

        // Scoped to organization
        $material = $this->materialRepository->findByOrganizationAndId($organizationId, $materialId);

        if (!$material->isApproved()) {
            return $this->respondWithData(['error' => 'Solo los materiales aprobados pueden cambiar su visibilidad'], 422);
        }

        $data = $this->getFormData() ?? [];
        $isVisible = (bool) ($data['is_visible'] ?? false);

        $this->materialRepository->setVisibility($materialId, $isVisible);

        $updatedMaterial = $this->materialRepository->findByOrganizationAndId($organizationId, $materialId);

        return $this->respondWithData($updatedMaterial);
    }
}
