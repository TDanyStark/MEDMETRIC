<?php

declare(strict_types=1);

namespace App\Application\Actions\Doctor;

use App\Application\Actions\Action;
use App\Domain\Doctor\DoctorRepositoryInterface;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use App\Infrastructure\Region\RegionCatalog;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * POST /v1/doctors
 */
class CreateDoctorAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private DoctorRepositoryInterface $doctorRepository,
        private RepAccessRepositoryInterface $repAccessRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $data         = (array) $this->getFormData();
        $authUser     = $this->request->getAttribute('auth_user');
        $role         = $authUser['role'] ?? null;
        $isSuperadmin = $authUser !== null && $role === 'superadmin';

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

        // A rep can never self-assign or hand a doctor off to another rep at
        // creation time — mirrors the hardening already enforced on
        // UpdateDoctorAction. Only org_admin/manager may set assigned_rep_id;
        // for those roles the value is validated against RepAccessRepository
        // below so a client can't smuggle a cross-organization/out-of-scope
        // rep id straight into the write.
        if ($role === 'rep') {
            unset($data['assigned_rep_id']);
        } elseif (array_key_exists('assigned_rep_id', $data)) {
            $rawRepId = $data['assigned_rep_id'];
            if ($rawRepId === null || $rawRepId === '') {
                $data['assigned_rep_id'] = null;
            } else {
                $repId     = (int) $rawRepId;
                $managerId = $role === 'manager' ? (int) $authUser['id'] : null;
                if (!$this->repAccessRepository->isRepAssignable($repId, $organizationId, $managerId)) {
                    return $this->respondWithData(
                        ['error' => 'El representante seleccionado no es válido para esta organización.'],
                        422
                    );
                }
                $data['assigned_rep_id'] = $repId;
            }
        }

        // Region MUST be normalized to a canonical CHILE_REGIONS value at
        // write time — an unmappable value is rejected (never silently
        // stored raw), per spec §"Canonical Region Diagnostic &
        // Normalization" — Scenario "Unmappable value at write time".
        if (!empty($data['region'])) {
            $normalizedRegion = RegionCatalog::normalizeRegion((string) $data['region']);
            if ($normalizedRegion === null) {
                return $this->respondWithData(
                    ['error' => "La región '{$data['region']}' no es una región de Chile reconocida."],
                    422
                );
            }
            $data['region'] = $normalizedRegion;
        }

        $doctor = $this->doctorRepository->create($organizationId, $data);

        return $this->respondWithData($doctor, 201);
    }
}
