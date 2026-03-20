<?php

declare(strict_types=1);

namespace App\Application\Actions\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Preview material resource for staff consumption (manager/rep) without metrics.
 * 
 * Shared between manager and rep routes.
 */
class PreviewMaterialAction extends Action
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
        $user = $this->getAuthUser();

        if (!$user) {
            return $this->respondWithData(['error' => 'No autenticado'], 401);
        }

        // Find material
        try {
            $material = $this->materialRepository->findById($materialId);
        } catch (\Exception $e) {
            return $this->respondWithData(['error' => 'Material no encontrado'], 404);
        }

        // Security: Ensure material belongs to the user's organization
        if ($material->getOrganizationId() !== $user->getOrganizationId()) {
            return $this->respondWithData([
                'error' => 'No tienes permiso para previsualizar este material',
            ], 403);
        }

        // Staff (managers/reps) can preview both draft and approved materials
        
        $type = $material->getType();

        return match ($type) {
            'pdf'   => $this->servePdf($material),
            'video' => $this->serveVideo($material),
            'link'  => $this->serveLink($material),
            default => $this->respondWithData(['error' => 'Tipo de material desconocido'], 400),
        };
    }

    private function servePdf($material): Response
    {
        $storagePath = $material->getStoragePath();

        if (empty($storagePath)) {
            return $this->respondWithData([
                'error' => 'Ruta del archivo PDF no encontrada',
            ], 404);
        }

        $url = $this->storageService->getUrl($storagePath);

        // We return as a resource object similar to the public one to be consistent
        return $this->respondWithData([
            'type' => 'pdf',
            'url'  => $url,
            'title' => $material->getTitle(),
            'description' => $material->getDescription(),
        ]);
    }

    private function serveVideo($material): Response
    {
        $externalUrl = $material->getExternalUrl();

        if (empty($externalUrl)) {
            return $this->respondWithData([
                'error' => 'URL del video no encontrada',
            ], 404);
        }

        return $this->respondWithData([
            'type'         => 'video',
            'url'          => $externalUrl,
            'embed_url'    => $this->getYoutubeEmbedUrl($externalUrl),
            'title'        => $material->getTitle(),
            'description'  => $material->getDescription(),
        ]);
    }

    private function serveLink($material): Response
    {
        $externalUrl = $material->getExternalUrl();

        if (empty($externalUrl)) {
            return $this->respondWithData([
                'error' => 'URL del enlace no encontrada',
            ], 404);
        }

        return $this->respondWithData([
            'type'         => 'link',
            'url'          => $externalUrl,
            'title'        => $material->getTitle(),
            'description'  => $material->getDescription(),
        ]);
    }

    private function getYoutubeEmbedUrl(string $url): ?string
    {
        // Extract video ID from various YouTube URL formats
        $patterns = [
            '/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/',
            '/youtu\.be\/([a-zA-Z0-9_-]+)/',
            '/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $url, $matches)) {
                return 'https://www.youtube.com/embed/' . $matches[1];
            }
        }

        return null;
    }
}
