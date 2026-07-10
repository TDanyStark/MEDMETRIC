<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class DeleteMaterialAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialRepositoryInterface $materialRepository,
        private StorageServiceInterface $storageService
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $organizationId = (int) $authUser['organization_id'];
        $materialId = (int) $this->resolveArg('id');

        // Scoped to organization (throws MaterialNotFoundException -> 404 if outside org)
        $material = $this->materialRepository->findByOrganizationAndId($organizationId, $materialId);

        // Delete the DB row first. If this fails (e.g. FK constraint violation),
        // the stored files are left untouched so nothing is orphaned.
        $this->materialRepository->delete($materialId);

        // Only clean up stored files after the DB delete succeeded.
        if ($material->getStoragePath()) {
            $this->storageService->delete($material->getStoragePath());
        }
        if ($material->getCoverPath()) {
            $this->storageService->delete($material->getCoverPath());
        }

        return $this->respondWithData(['message' => 'Material deleted successfully']);
    }
}
