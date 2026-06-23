<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Material;

use App\Application\Actions\Action;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ApproveMaterialAction extends Action
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
        $approverId = (int) $authUser['id'];
        $materialId = (int) $this->resolveArg('id');

        // Scoped to organization
        $material = $this->materialRepository->findByOrganizationAndId($organizationId, $materialId);

        if ($material->isApproved()) {
            return $this->respondWithData(['error' => 'Material is already approved'], 422);
        }

        $this->materialRepository->approve($materialId, $approverId);

        $approvedMaterial = $this->materialRepository->findByOrganizationAndId($organizationId, $materialId);

        return $this->respondWithData($approvedMaterial);
    }
}
