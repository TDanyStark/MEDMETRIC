<?php

declare(strict_types=1);

namespace App\Application\Actions\Public\Session;

use App\Application\Actions\Action;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use App\Application\Services\Storage\StorageServiceInterface;
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
    private StorageServiceInterface $storageService;
    private MaterialStudyRepositoryInterface $studyRepository;

    public function __construct(
        LoggerInterface $logger,
        VisitSessionRepositoryInterface $visitSessionRepository,
        MaterialRepositoryInterface $materialRepository,
        StorageServiceInterface $storageService,
        MaterialStudyRepositoryInterface $studyRepository
    ) {
        parent::__construct($logger);
        $this->visitSessionRepository = $visitSessionRepository;
        $this->materialRepository = $materialRepository;
        $this->storageService = $storageService;
        $this->studyRepository = $studyRepository;
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

        // Filter only approved materials and add cover_url
        $approvedMaterials = [];
        foreach ($materials as $material) {
            if ($material['status'] === 'approved') {
                $material['cover_url'] = !empty($material['cover_path']) 
                    ? $this->storageService->getUrl($material['cover_path']) 
                    : null;
                $approvedMaterials[] = $material;
            }
        }

        // Nest each material's studies automatically (no rep-selection step,
        // per explicit requirement) — additive field only, existing payload
        // shape (session, materials[], material_count) is unchanged.
        $materialIds = array_map(fn ($material) => (int) $material['id'], $approvedMaterials);
        $studiesByMaterial = $this->studyRepository->findAllByMaterialIds($materialIds);
        foreach ($approvedMaterials as &$material) {
            $material['studies'] = $studiesByMaterial[(int) $material['id']] ?? [];
        }
        unset($material);

        return $this->respondWithData([
            'session' => [
                'id'           => $session->getId(),
                'doctor_token' => $session->getDoctorToken(),
                'doctor_name'  => $session->getDoctorName(),
                'rep_name'     => $session->getRepName(),
                'notes'        => $session->getNotes(),
                'created_at'   => $session->getCreatedAt(),
            ],
            'materials' => $approvedMaterials,
            'material_count' => count($approvedMaterials),
        ]);
    }
}
