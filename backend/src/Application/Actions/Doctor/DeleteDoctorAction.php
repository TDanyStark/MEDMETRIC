<?php

declare(strict_types=1);

namespace App\Application\Actions\Doctor;

use App\Application\Actions\Action;
use App\Domain\Doctor\DoctorRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * DELETE /v1/doctors/{id}
 *
 * Soft delete (active = 0): doctors are frequently referenced by historical
 * visit_sessions.doctor_id (FK ON DELETE RESTRICT), so a hard DELETE would
 * either fail or destroy metrics history. Restricted to org_admin at the
 * route level via DoctorAccessConfig::DELETE_ROLES.
 */
class DeleteDoctorAction extends Action
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
        $authUser       = $this->request->getAttribute('auth_user');
        $organizationId = (int) ($authUser['organization_id'] ?? 0);

        $this->doctorRepository->update($doctorId, $organizationId, ['active' => false]);

        return $this->respondWithData(['message' => 'Doctor deleted successfully']);
    }
}
