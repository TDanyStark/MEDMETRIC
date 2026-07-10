<?php

declare(strict_types=1);

namespace App\Application\Actions\Doctor;

use App\Application\Actions\Action;
use App\Domain\Doctor\DoctorRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * PUT /v1/doctors/{id}
 */
class UpdateDoctorAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private DoctorRepositoryInterface $doctorRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $doctorId       = (int) $this->resolveArg('id');
        $data           = (array) $this->getFormData();
        $authUser       = $this->request->getAttribute('auth_user');
        $organizationId = (int) ($authUser['organization_id'] ?? 0);

        if (empty($data)) {
            return $this->respondWithData(['error' => 'No data provided'], 422);
        }

        if (isset($data['name'])) {
            $name = trim((string) $data['name']);
            if ($name === '') {
                return $this->respondWithData(['error' => 'El nombre del doctor es requerido'], 422);
            }
            $data['name'] = $name;
        }

        // update() is scoped by organization_id: throws DoctorNotFoundException
        // (-> 404 via Action base class) if the doctor doesn't belong to this org.
        $doctor = $this->doctorRepository->update($doctorId, $organizationId, $data);

        return $this->respondWithData($doctor);
    }
}
