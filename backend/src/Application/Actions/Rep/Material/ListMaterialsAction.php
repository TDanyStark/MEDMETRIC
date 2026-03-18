<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Material;

use App\Application\Actions\Action;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Application\Services\Storage\StorageServiceInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListMaterialsAction extends Action
{
    private MaterialRepositoryInterface $materialRepository;
    private StorageServiceInterface $storageService;

    public function __construct(
        LoggerInterface $logger, 
        MaterialRepositoryInterface $materialRepository,
        StorageServiceInterface $storageService
    ) {
        parent::__construct($logger);
        $this->materialRepository = $materialRepository;
        $this->storageService = $storageService;
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $repId = (int) $authUser['id'];
        
        $params = $this->request->getQueryParams();
        $search = $params['q'] ?? null;
        $type = $params['type'] ?? null;
        $page = (int) ($params['page'] ?? 1);
        $managerId = isset($params['manager_id']) ? (int) $params['manager_id'] : null;
        $brandId = isset($params['brand_id']) ? (int) $params['brand_id'] : null;

        // Get only approved materials from subscribed managers
        $result = $this->materialRepository->findAllApprovedByRep($repId, $search, $type, $page, $managerId, $brandId);

        // Decorate materials with cover_url
        foreach ($result['items'] as $material) {
            if ($material->getCoverPath()) {
                $material->setCoverUrl($this->storageService->getUrl($material->getCoverPath()));
            }
        }

        return $this->respondWithData($result);
    }
}
