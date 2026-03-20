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
                return $this->redirectToError('Material no disponible', 'Lo sentimos, este contenido ya no se encuentra accesible.');
            }
        } catch (\Exception $e) {
            return $this->redirectToError('Material no encontrado', 'El recurso solicitado no existe o fue eliminado.');
        }

        // Validate session token (MANDATORY for public access)
        $token = $queryParams['session_token'] ?? '';
        if (empty($token)) {
            return $this->redirectToError('Link inválido', 'Falta el token de seguridad para visualizar este material.');
        }

        $session = $this->visitSessionRepository->findByDoctorToken($token);
        if (!$session) {
            return $this->redirectToError('Link expirado', 'Esta sesión de visita ya no es válida o el enlace ha caducado.');
        }

        // Verify material is in this session
        if (!$this->materialViewRepository->isMaterialInSession($materialId, $session->getId())) {
            return $this->redirectToError('Acceso denegado', 'Este material no forma parte de la sesión de visita autorizada.');
        }

        $sessionId = $session->getId();

        $type = $material->getType();

        // Determine viewer type: anything not explicitly 'doctor' is treated as 'rep'
        $requestedType = $queryParams['viewer_type'] ?? 'doctor';
        $viewerType = ($requestedType === 'doctor') ? 'doctor' : 'rep';
        $viewerId = null;

        // If it's a representative view, we always fetch their ID from the session context
        if ($viewerType === 'rep' && $session !== null) {
            $viewerId = $session->getRepId();
        }

        // Record view metrics for all types when accessed via this endpoint
        $this->recordResourceView($material, $sessionId, $viewerType, $viewerId);

        return match ($type) {
            'pdf'   => $this->servePdf($material),
            'video' => $this->serveVideo($material),
            'link'  => $this->serveLink($material, $queryParams),
            default => $this->redirectToError('Error de sistema', 'El tipo de material no es compatible con el reproductor.'),
        };
    }

    private function redirectToError(string $title, string $message): Response
    {
        $query = http_build_query([
            'title' => $title,
            'msg'   => $message
        ]);

        return $this->response
            ->withHeader('Location', '/public/error?' . $query)
            ->withStatus(302);
    }

    private function recordResourceView(Material $material, ?int $sessionId, string $viewerType = 'doctor', ?int $viewerId = null): void
    {
        try {
            $serverParams = $this->request->getServerParams();
            $userAgent = $serverParams['HTTP_USER_AGENT'] ?? null;
            $ipAddress = $this->getClientIp();

            $this->materialViewRepository->createView([
                'material_id'      => $material->getId(),
                'visit_session_id' => $sessionId,
                'viewer_type'      => $viewerType,
                'viewer_id'        => $viewerId,
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

        // Return a 302 redirect to the external video URL
        return $this->response
            ->withHeader('Location', $externalUrl)
            ->withStatus(302);
    }

    private function serveLink($material, array $queryParams): Response
    {
        $externalUrl = $material->getExternalUrl();

        if (empty($externalUrl)) {
            return $this->respondWithData([
                'error' => 'Link URL not found',
            ], 404);
        }

        // Return a 302 redirect to the external URL
        return $this->response
            ->withHeader('Location', $externalUrl)
            ->withStatus(302);
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
