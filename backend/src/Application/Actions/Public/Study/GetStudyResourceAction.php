<?php

declare(strict_types=1);

namespace App\Application\Actions\Public\Study;

use App\Application\Actions\Action;
use App\Application\Services\Auth\JwtServiceInterface;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialStudy\MaterialStudy;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use App\Domain\StudyView\StudyViewRepositoryInterface;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Get study resource for public (doctor) consumption
 * - PDF: 302 redirect to the storage URL
 * - Link: 302 redirect to the external URL
 * Both types record a study_views row before redirecting.
 *
 * GET /api/v1/public/study/{id}/resource
 *
 * Copy of Public\Material\GetMaterialResourceAction's viewer_type
 * anti-spoofing logic: a valid rep JWT server-side forces viewer_type='rep',
 * ignoring any client-supplied value; otherwise defaults to 'doctor'.
 */
class GetStudyResourceAction extends Action
{
    private MaterialStudyRepositoryInterface $studyRepository;
    private MaterialRepositoryInterface $materialRepository;
    private StudyViewRepositoryInterface $studyViewRepository;
    private VisitSessionRepositoryInterface $visitSessionRepository;
    private StorageServiceInterface $storageService;
    private JwtServiceInterface $jwtService;

    public function __construct(
        LoggerInterface $logger,
        MaterialStudyRepositoryInterface $studyRepository,
        MaterialRepositoryInterface $materialRepository,
        StudyViewRepositoryInterface $studyViewRepository,
        VisitSessionRepositoryInterface $visitSessionRepository,
        StorageServiceInterface $storageService,
        JwtServiceInterface $jwtService
    ) {
        parent::__construct($logger);
        $this->studyRepository = $studyRepository;
        $this->materialRepository = $materialRepository;
        $this->studyViewRepository = $studyViewRepository;
        $this->visitSessionRepository = $visitSessionRepository;
        $this->storageService = $storageService;
        $this->jwtService = $jwtService;
    }

    protected function action(): Response
    {
        $studyId = (int) $this->resolveArg('id');
        $queryParams = $this->request->getQueryParams();

        // Verify study exists
        try {
            $study = $this->studyRepository->findById($studyId);
        } catch (\Exception $e) {
            return $this->redirectToError('Estudio no encontrado', 'El recurso solicitado no existe o fue eliminado.');
        }

        // Verify the parent material exists, is approved and visible — a
        // study inherits its accessibility from the material it belongs to
        // (studies have no status/visibility of their own).
        try {
            $material = $this->materialRepository->findById($study->getMaterialId());
            if ($material->getStatus() !== 'approved' || !$material->isVisible()) {
                return $this->redirectToError('Estudio no disponible', 'Lo sentimos, este contenido ya no se encuentra accesible.');
            }
        } catch (\Exception $e) {
            return $this->redirectToError('Estudio no encontrado', 'El recurso solicitado no existe o fue eliminado.');
        }

        // Validate session token (MANDATORY for public access)
        $token = $queryParams['session_token'] ?? '';
        if (empty($token)) {
            return $this->redirectToError('Link inválido', 'Falta el token de seguridad para visualizar este estudio.');
        }

        $session = $this->visitSessionRepository->findByDoctorToken($token);
        if (!$session) {
            return $this->redirectToError('Link expirado', 'Esta sesión de visita ya no es válida o el enlace ha caducado.');
        }

        // Verify the study's parent material is in this session
        if (!$this->studyViewRepository->isStudyInSession($studyId, $session->getId())) {
            return $this->redirectToError('Acceso denegado', 'Este estudio no forma parte de la sesión de visita autorizada.');
        }

        $sessionId = $session->getId();

        $type = $study->getType();

        // Security check: If there's a valid rep session in headers, FORCE viewer_type = 'rep'
        // This prevents the representative from spoofing being a doctor in their own browser.
        $viewerType = 'doctor';
        $viewerId = null;

        $authHeader = $this->request->getHeaderLine('Authorization');
        if (str_starts_with($authHeader, 'Bearer ')) {
            $tokenStr = substr($authHeader, 7);
            try {
                $decoded = $this->jwtService->decode($tokenStr);
                $viewerType = 'rep';
                $viewerId = $decoded->user->id ?? null;
            } catch (\Exception $e) {
                // Invalid token? Default back to URL param logic or doctor
                $requestedType = $queryParams['viewer_type'] ?? 'doctor';
                $viewerType = ($requestedType === 'doctor') ? 'doctor' : 'rep';
            }
        } else {
            // No auth header, use URL parameter
            $requestedType = $queryParams['viewer_type'] ?? 'doctor';
            $viewerType = ($requestedType === 'doctor') ? 'doctor' : 'rep';
        }

        // If it's a representative view but we didn't get an ID from JWT,
        // try to get it from the visit session context (optional fallback)
        if ($viewerType === 'rep' && $viewerId === null && $session !== null) {
            $viewerId = $session->getRepId();
        }

        // Record view metrics for all types when accessed via this endpoint
        $this->recordResourceView($study, $sessionId, $viewerType, $viewerId);

        return match ($type) {
            'pdf'   => $this->servePdf($study),
            'link'  => $this->serveLink($study),
            default => $this->redirectToError('Error de sistema', 'El tipo de estudio no es compatible con el reproductor.'),
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

    private function recordResourceView(MaterialStudy $study, ?int $sessionId, string $viewerType = 'doctor', ?int $viewerId = null): void
    {
        try {
            $serverParams = $this->request->getServerParams();
            $userAgent = $serverParams['HTTP_USER_AGENT'] ?? null;
            $ipAddress = $this->getClientIp();

            $this->studyViewRepository->createView([
                'study_id'         => $study->getId(),
                'visit_session_id' => $sessionId,
                'viewer_type'      => $viewerType,
                'viewer_id'        => $viewerId,
                'user_agent'       => $userAgent,
                'ip_address'       => $ipAddress,
            ]);
        } catch (\Exception $e) {
            $this->logger->error('Failed to record study resource view', [
                'study_id' => $study->getId(),
                'error'    => $e->getMessage(),
            ]);
        }
    }

    private function servePdf(MaterialStudy $study): Response
    {
        $storagePath = $study->getStoragePath();

        if (empty($storagePath)) {
            return $this->respondWithData([
                'error' => 'PDF file path not found',
            ], 404);
        }

        // Return a 302 redirect to the storage URL
        $url = $this->storageService->getUrl($storagePath);

        return $this->response
            ->withHeader('Location', $url)
            ->withStatus(302);
    }

    private function serveLink(MaterialStudy $study): Response
    {
        $externalUrl = $study->getExternalUrl();

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
}
