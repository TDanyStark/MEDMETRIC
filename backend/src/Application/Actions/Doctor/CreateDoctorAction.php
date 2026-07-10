<?php

declare(strict_types=1);

namespace App\Application\Actions\Doctor;

use App\Application\Actions\Action;
use App\Domain\Doctor\DoctorRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * POST /v1/doctors
 */
class CreateDoctorAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private DoctorRepositoryInterface $doctorRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $data         = (array) $this->getFormData();
        $authUser     = $this->request->getAttribute('auth_user');
        $isSuperadmin = $authUser !== null && $authUser['role'] === 'superadmin';

        // Scoping mirrors CreateBrandAction: org_admin/manager/rep are locked to
        // their own organization; a superadmin (if ever added to MANAGE_ROLES)
        // may specify organization_id explicitly.
        $organizationId = $isSuperadmin
            ? (int) ($data['organization_id'] ?? 0)
            : (int) ($authUser['organization_id'] ?? 0);

        if (empty($organizationId)) {
            return $this->respondWithData(['error' => 'organization_id is required'], 422);
        }

        if (empty($data['name']) || trim((string) $data['name']) === '') {
            return $this->respondWithData(['error' => 'El nombre del doctor es requerido'], 422);
        }

        $data['name']          = trim((string) $data['name']);
        $data['created_by_id'] = (int) $authUser['id'];

        $doctor = $this->doctorRepository->create($organizationId, $data);

        return $this->respondWithData($doctor, 201);
    }
}
