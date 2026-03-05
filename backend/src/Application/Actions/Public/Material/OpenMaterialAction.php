<?php

declare(strict_types=1);

namespace App\Application\Actions\Public\Material;

use App\Application\Actions\Action;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialView\MaterialViewRepositoryInterface;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Open a material and start tracking view metrics
 * POST /api/v1/public/material/{id}/open
 */
class OpenMaterialAction extends Action
{
    private MaterialRepositoryInterface $materialRepository;
    private MaterialViewRepositoryInterface $materialViewRepository;
    private VisitSessionRepositoryInterface $visitSessionRepository;

    public function __construct(
        LoggerInterface $logger,
        MaterialRepositoryInterface $materialRepository,
        MaterialViewRepositoryInterface $materialViewRepository,
        VisitSessionRepositoryInterface $visitSessionRepository
    ) {
        parent::__construct($logger);
        $this->materialRepository = $materialRepository;
        $this->materialViewRepository = $materialViewRepository;
        $this->visitSessionRepository = $visitSessionRepository;
    }

    protected function action(): Response
    {
        $materialId = (int) $this->resolveArg('id');
        $data = $this->getFormData() ?? [];

        // Validate session token if provided (for doctor access)
        $sessionId = null;
        if (!empty($data['session_token'])) {
            $session = $this->visitSessionRepository->findByDoctorToken($data['session_token']);
            if ($session) {
                // Verify material is in this session
                if ($this->materialViewRepository->isMaterialInSession($materialId, $session->getId())) {
                    $sessionId = $session->getId();
                } else {
                    return $this->respondWithData([
                        'error' => 'Material not available in this session',
                    ], 403);
                }
            }
        }

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

        // Get client info for tracking
        $serverParams = $this->request->getServerParams();
        $userAgent = $serverParams['HTTP_USER_AGENT'] ?? null;
        $ipAddress = $this->getClientIp();

        // Determine viewer type
        $viewerType = $data['viewer_type'] ?? 'doctor';
        $viewerId = $data['viewer_id'] ?? null;

        // Create view record
        $viewData = [
            'material_id'     => $materialId,
            'visit_session_id' => $sessionId,
            'viewer_type'      => $viewerType,
            'viewer_id'        => $viewerId,
            'user_agent'       => $userAgent,
            'ip_address'       => $ipAddress,
        ];

        $viewId = $this->materialViewRepository->createView($viewData);

        $this->logger->info('Material opened', [
            'view_id'      => $viewId,
            'material_id'  => $materialId,
            'session_id'   => $sessionId,
            'viewer_type'  => $viewerType,
            'ip_address' => $ipAddress,
        ]);

        return $this->respondWithData([
            'view_id'     => $viewId,
            'material_id' => $materialId,
            'opened_at'   => date('Y-m-d H:i:s'),
        ], 201);
    }

    private function getClientIp(): ?string
    {
        $serverParams = $this->request->getServerParams();

        $headers = [
            'HTTP_CF_CONNECTING_IP', // Cloudflare
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_FORWARDED',
            'HTTP_X_CLUSTER_CLIENT_IP',
            'HTTP_FORWARDED_FOR',
            'HTTP_FORWARDED',
            'REMOTE_ADDR',
        ];

        foreach ($headers as $header) {
            if (!empty($serverParams[$header])) {
                $ip = $serverParams[$header];
                if ($header === 'HTTP_X_FORWARDED_FOR' || $header === 'HTTP_X_CLUSTER_CLIENT_IP') {
                    // Take first IP in comma-separated list
                    $ips = explode(',', $ip);
                    $ip = trim($ips[0]);
                }

                // Validate IP
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }

        return $serverParams['REMOTE_ADDR'] ?? null;
    }
}
