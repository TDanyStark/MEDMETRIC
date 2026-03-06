<?php

declare(strict_types=1);

namespace App\Application\Actions\Public\Material;

use App\Application\Actions\Action;
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

    public function __construct(
        LoggerInterface $logger,
        MaterialRepositoryInterface $materialRepository
    ) {
        parent::__construct($logger);
        $this->materialRepository = $materialRepository;
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
            // Return a placeholder or 404
            return $this->respondWithData(['error' => 'Cover image not found'], 404);
        }

        $fullPath = dirname(__DIR__, 5) . '/storage/materials/' . ltrim($coverPath, '/');

        if (!file_exists($fullPath)) {
            return $this->respondWithData(['error' => 'Cover image file not found on storage'], 404);
        }

        $fileSize = filesize($fullPath);
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($fullPath);

        $stream = fopen($fullPath, 'r');

        return $this->response
            ->withHeader('Content-Type', $mimeType)
            ->withHeader('Content-Length', (string) $fileSize)
            ->withBody(new \Slim\Psr7\Stream($stream));
    }
}
