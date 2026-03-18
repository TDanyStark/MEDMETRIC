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

        if (empty($coverPath) || !$this->storageService->exists($coverPath)) {
            return $this->respondWithData(['error' => 'Cover image file not found on storage'], 404);
        }

        $stream = $this->storageService->getStream($coverPath);
        if (!$stream) {
            return $this->respondWithData(['error' => 'Could not open cover image stream'], 500);
        }

        $mimeType = $this->storageService->getMimeType($coverPath) ?? 'image/avif';
        $fileSize = $this->storageService->getFileSize($coverPath);

        $response = $this->response
            ->withHeader('Content-Type', $mimeType);

        if ($fileSize !== null) {
            $response = $response->withHeader('Content-Length', (string) $fileSize);
        }

        return $response->withBody(new \Slim\Psr7\Stream($stream));
    }
}
