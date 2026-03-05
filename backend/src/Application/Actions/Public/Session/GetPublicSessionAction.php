<?php

declare(strict_types=1);

namespace App\Application\Actions\Public\Session;

use App\Application\Actions\Action;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Get public session information by doctor token
 * Returns session details with materials for the doctor view
 */
class GetPublicSessionAction extends Action
{
    private VisitSessionRepositoryInterface $visitSessionRepository;
    private MaterialRepositoryInterface $materialRepository;

    public function __construct(
        LoggerInterface $logger,
        VisitSessionRepositoryInterface $visitSessionRepository,
        MaterialRepositoryInterface $materialRepository
    ) {
        parent::__construct($logger);
        $this->visitSessionRepository = $visitSessionRepository;
        $this->materialRepository = $materialRepository;
    }

    protected function action(): Response
    {
        $token = $this->resolveArg('token');

        // Find session by token
        $session = $this->visitSessionRepository->findByDoctorToken($token);

        if (!$session) {
            return $this->respondWithData([
                'error' => 'Session not found or inactive',
            ], 404);
        }

        // Get materials for this session
        $materials = $this->visitSessionRepository->getSessionMaterials($session->getId());

        // Filter only approved materials
        $approvedMaterials = array_filter($materials, function ($material) {
            return $material['status'] === 'approved';
        });

        // Re-index array
        $approvedMaterials = array_values($approvedMaterials);

        return $this->respondWithData([
            'session' => [
                'id'           => $session->getId(),
                'doctor_token' => $session->getDoctorToken(),
                'doctor_name'  => $session->getDoctorName(),
                'notes'        => $session->getNotes(),
                'created_at'   => $session->getCreatedAt(),
            ],
            'materials' => $approvedMaterials,
            'material_count' => count($approvedMaterials),
        ]);
    }
}
