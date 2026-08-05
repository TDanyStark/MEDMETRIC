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
 * PUT /v1/doctors/{id}
 */
class UpdateDoctorAction extends Action
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
        $doctorId       = (int) $this->resolveArg('id');
        $data           = (array) $this->getFormData();
        $authUser       = $this->request->getAttribute('auth_user');
        $role           = $authUser['role'] ?? null;
        $organizationId = (int) ($authUser['organization_id'] ?? 0);
        $isRep          = $role === 'rep';

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

        // A rep can never reassign a doctor's ownership via the payload — the
        // ownership guard below only checks the EXISTING assigned_rep_id, so
        // without this a rep could still smuggle assigned_rep_id through to
        // reassign one of their own doctors to an arbitrary other rep.
        // org_admin/manager MAY reassign, but the target rep is validated
        // against RepAccessRepository so a cross-organization/out-of-scope
        // id can never be persisted (an empty/null value clears the
        // assignment and needs no validation).
        if ($isRep) {
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
        // Normalization" — Scenario "Unmappable value at write time". An
        // explicit empty string clears the region (allowed as-is, not a
        // rejection); the key is simply absent when the field isn't sent.
        if (array_key_exists('region', $data) && $data['region'] !== null && trim((string) $data['region']) !== '') {
            $normalizedRegion = RegionCatalog::normalizeRegion((string) $data['region']);
            if ($normalizedRegion === null) {
                return $this->respondWithData(
                    ['error' => "La región '{$data['region']}' no es una región de Chile reconocida."],
                    422
                );
            }
            $data['region'] = $normalizedRegion;
        }

        // update() is scoped by organization_id: throws DoctorNotFoundException
        // (-> 404 via Action base class) if the doctor doesn't belong to this org.
        // For reps, $restrictRepId additionally requires the doctor's EXISTING
        // assigned_rep_id (from the DB, not any client-supplied payload value)
        // to match authUser.id, or the same 404 is thrown — a rep can never
        // edit, or learn the existence of, another rep's doctor.
        $restrictRepId = $isRep ? (int) $authUser['id'] : null;

        $doctor = $this->doctorRepository->update($doctorId, $organizationId, $data, $restrictRepId);

        return $this->respondWithData($doctor);
    }
}
