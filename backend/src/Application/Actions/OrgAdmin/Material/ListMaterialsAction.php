<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListMaterialsAction extends Action
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

        $queryParams = $this->request->getQueryParams();

        $search = $queryParams['q'] ?? null;
        if ($search === '') $search = null;

        $status = $queryParams['status'] ?? null;
        if ($status === '') $status = null;

        $type = $queryParams['type'] ?? null;
        if ($type === '') $type = null;

        $brandId = isset($queryParams['brand_id']) && $queryParams['brand_id'] !== ''
            ? (int) $queryParams['brand_id']
            : null;

        $managerId = isset($queryParams['manager_id']) && $queryParams['manager_id'] !== ''
            ? (int) $queryParams['manager_id']
            : null;

        $page = (int) ($queryParams['page'] ?? 1);
        if ($page < 1) $page = 1;

        $result = $this->materialRepository->findAllByOrganization(
            $organizationId,
            $search,
            $status,
            $type,
            $brandId,
            $managerId,
            $page
        );

        // Decorate cover URLs
        foreach ($result['items'] as $material) {
            if ($material->getCoverPath()) {
                $material->setCoverUrl($this->storageService->getUrl($material->getCoverPath()));
            }
        }

        return $this->respondWithData($result);
    }
}
