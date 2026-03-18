<?php

declare(strict_types=1);

namespace App\Application\Actions\Public\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Get material cover image
 * 
 * GET /api/v1/public/material/{id}/cover
 */
class GetMaterialCoverAction extends Action
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
        $materialId = (int) $this->resolveArg('id');

        try {
            $material = $this->materialRepository->findById($materialId);
        } catch (\Exception $e) {
            return $this->respondWithData(['error' => 'Material not found'], 404);
        }

        $coverPath = $material->getCoverPath();

        if (empty($coverPath)) {
            return $this->respondWithData(['error' => 'Cover image not found'], 404);
        }

        // Return a redirect to the direct CloudFront URL (or local URL)
        $url = $this->storageService->getUrl($coverPath);
        
        return $this->response
            ->withHeader('Location', $url)
            ->withStatus(302);
    }
}
