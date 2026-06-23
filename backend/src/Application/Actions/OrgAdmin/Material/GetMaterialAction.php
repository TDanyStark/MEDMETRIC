<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialNotFoundException;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class GetMaterialAction extends Action
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

        try {
            $material = $this->materialRepository->findByOrganizationAndId($organizationId, $materialId);
        } catch (MaterialNotFoundException $e) {
            return $this->respondWithData(['error' => 'Material not found'], 404);
        }

        if ($material->getCoverPath()) {
            $material->setCoverUrl($this->storageService->getUrl($material->getCoverPath()));
        }

        return $this->respondWithData($material);
    }
}
