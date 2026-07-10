<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\VisitSession;

use App\Application\Actions\Action;
use App\Domain\Doctor\DoctorRepositoryInterface;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;

class CreateVisitSessionAction extends Action
{
    private VisitSessionRepositoryInterface $visitSessionRepository;
    private DoctorRepositoryInterface $doctorRepository;

    public function __construct(
        LoggerInterface $logger,
        VisitSessionRepositoryInterface $visitSessionRepository,
        DoctorRepositoryInterface $doctorRepository
    ) {
        parent::__construct($logger);
        $this->visitSessionRepository = $visitSessionRepository;
        $this->doctorRepository = $doctorRepository;
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $repId = (int) $authUser['id'];
        $organizationId = (int) $authUser['organization_id'];
        
        $data = $this->getFormData();
        
        // Validate required fields
        if (empty($data['material_ids']) || !is_array($data['material_ids'])) {
            throw new HttpBadRequestException($this->request, 'Material IDs are required and must be an array');
        }

        if (empty($data['doctor_id']) || !is_numeric($data['doctor_id'])) {
            throw new HttpBadRequestException($this->request, 'doctor_id is required and must be numeric');
        }

        $doctorId = (int) $data['doctor_id'];

        // Scoped to organization: returns null if the doctor doesn't exist or
        // belongs to a different organization.
        $doctor = $this->doctorRepository->findById($doctorId, $organizationId);
        if ($doctor === null) {
            throw new HttpNotFoundException($this->request, 'Doctor not found in your organization.');
        }

        $sessionData = [
            'doctor_id'   => $doctor->getId(),
            // Snapshot the name at creation time so historical sessions/metrics
            // keep working even if the doctor record is later renamed/deactivated.
            'doctor_name' => $doctor->getName(),
            'notes'       => $data['notes'] ?? null,
        ];

        $session = $this->visitSessionRepository->create(
            $repId,
            $organizationId,
            $sessionData,
            $data['material_ids']
        );

        $this->doctorRepository->touchLastVisit($doctorId);

        // Get materials for this session
        $materials = $this->visitSessionRepository->getSessionMaterials($session->getId());

        return $this->respondWithData([
            'session'   => $session,
            'materials' => $materials,
        ])->withStatus(201);
    }
}
