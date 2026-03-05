<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\VisitSession;

use App\Application\Actions\Action;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;
use Slim\Exception\HttpBadRequestException;

class CreateVisitSessionAction extends Action
{
    private VisitSessionRepositoryInterface $visitSessionRepository;

    public function __construct(LoggerInterface $logger, VisitSessionRepositoryInterface $visitSessionRepository)
    {
        parent::__construct($logger);
        $this->visitSessionRepository = $visitSessionRepository;
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

        // Optional fields
        $sessionData = [
            'doctor_name' => $data['doctor_name'] ?? null,
            'notes'       => $data['notes'] ?? null,
        ];

        $session = $this->visitSessionRepository->create(
            $repId,
            $organizationId,
            $sessionData,
            $data['material_ids']
        );

        // Get materials for this session
        $materials = $this->visitSessionRepository->getSessionMaterials($session->getId());

        return $this->respondWithData([
            'session'   => $session,
            'materials' => $materials,
        ])->withStatus(201);
    }
}
