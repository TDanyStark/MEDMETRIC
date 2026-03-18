<?php

declare(strict_types=1);

namespace App\Application\Actions\Public\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\Material;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialView\MaterialViewRepositoryInterface;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Get material resource for consumption
 * - PDF: Stream file content
 * - Video: Return YouTube URL
 * - Link: Register event and return redirect URL
 * 
 * GET /api/v1/public/material/{id}/resource
 */
class GetMaterialResourceAction extends Action
{
    private MaterialRepositoryInterface $materialRepository;
    private MaterialViewRepositoryInterface $materialViewRepository;
    private VisitSessionRepositoryInterface $visitSessionRepository;
    private StorageServiceInterface $storageService;

    public function __construct(
        LoggerInterface $logger,
        MaterialRepositoryInterface $materialRepository,
        MaterialViewRepositoryInterface $materialViewRepository,
        VisitSessionRepositoryInterface $visitSessionRepository,
        StorageServiceInterface $storageService
    ) {
        parent::__construct($logger);
        $this->materialRepository = $materialRepository;
        $this->materialViewRepository = $materialViewRepository;
        $this->visitSessionRepository = $visitSessionRepository;
        $this->storageService = $storageService;
    }

    protected function action(): Response
    {
        $materialId = (int) $this->resolveArg('id');
        $queryParams = $this->request->getQueryParams();

        // Verify material exists and is approved
        try {
            $material = $this->materialRepository->findById($materialId);
            if ($material->getStatus() !== 'approved') {
                return $this->respondWithData([
                    'error' => 'Material is not available',
                ], 403);
            }
        } catch (\Exception $e) {
            return $this->respondWithData([
                'error' => 'Material not found',
            ], 404);
        }

        // Validate session token if provided (for doctor access)
        $sessionId = null;
        if (!empty($queryParams['session_token'])) {
            $session = $this->visitSessionRepository->findByDoctorToken($queryParams['session_token']);
            if ($session) {
                // Verify material is in this session
                if (!$this->materialViewRepository->isMaterialInSession($materialId, $session->getId())) {
                    return $this->respondWithData([
                        'error' => 'Material not available in this session',
                    ], 403);
                }
                $sessionId = $session->getId();
            }
        }

        $type = $material->getType();

        // Record view metrics for all types when accessed via this endpoint
        $this->recordResourceView($material, $sessionId);

        return match ($type) {
            'pdf'   => $this->servePdf($material),
            'video' => $this->serveVideo($material),
            'link'  => $this->serveLink($material, $queryParams),
            default => $this->respondWithData(['error' => 'Unknown material type'], 400),
        };
    }

    private function recordResourceView(Material $material, ?int $sessionId): void
    {
        try {
            $serverParams = $this->request->getServerParams();
            $userAgent = $serverParams['HTTP_USER_AGENT'] ?? null;
            $ipAddress = $this->getClientIp();

            $this->materialViewRepository->createView([
                'material_id'      => $material->getId(),
                'visit_session_id' => $sessionId,
                'viewer_type'      => 'doctor', // Default to doctor for resource endpoint
                'viewer_id'        => null,
                'user_agent'       => $userAgent,
                'ip_address'       => $ipAddress,
            ]);
        } catch (\Exception $e) {
            $this->logger->error('Failed to record resource view', [
                'material_id' => $material->getId(),
                'error'       => $e->getMessage(),
            ]);
        }
    }

    private function servePdf(Material $material): Response
    {
        $storagePath = $material->getStoragePath();

        if (empty($storagePath)) {
            return $this->respondWithData([
                'error' => 'PDF file path not found',
            ], 404);
        }

        // Return a 302 redirect to the CloudFront URL
        $url = $this->storageService->getUrl($storagePath);

        return $this->response
            ->withHeader('Location', $url)
            ->withStatus(302);
    }

    private function serveVideo($material): Response
    {
        $externalUrl = $material->getExternalUrl();

        if (empty($externalUrl)) {
            return $this->respondWithData([
                'error' => 'Video URL not found',
            ], 404);
        }

        // Return video URL for embedding
        return $this->respondWithData([
            'type'         => 'video',
            'url'          => $externalUrl,
            'embed_url'    => $this->getYoutubeEmbedUrl($externalUrl),
            'title'        => $material->getTitle(),
            'description'  => $material->getDescription(),
        ]);
    }

    private function serveLink($material, array $queryParams): Response
    {
        $externalUrl = $material->getExternalUrl();

        if (empty($externalUrl)) {
            return $this->respondWithData([
                'error' => 'Link URL not found',
            ], 404);
        }

        // For links, we return the URL and let frontend handle it
        return $this->respondWithData([
            'type'         => 'link',
            'url'          => $externalUrl,
            'title'        => $material->getTitle(),
            'description'  => $material->getDescription(),
            'redirect'     => true,
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
