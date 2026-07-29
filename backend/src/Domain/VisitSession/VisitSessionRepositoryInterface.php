<?php

declare(strict_types=1);

namespace App\Domain\VisitSession;

use App\Infrastructure\Config\TimezoneConfig;

interface VisitSessionRepositoryInterface
{
    /**
     * $timezone is the caller's organization IANA identifier, used to
     * convert the org-local $date filter into a UTC range (see
     * App\Infrastructure\Support\OrgDateRange).
     */
    public function findAllByRep(int $repId, int $page = 1, ?string $q = null, ?string $date = null, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;
    public function findByIdAndRep(int $id, int $repId): VisitSession;
    public function findByDoctorToken(string $token): ?VisitSession;
    public function create(int $repId, int $organizationId, array $data, array $materialIds): VisitSession;
    public function getSessionMaterials(int $sessionId): array;
    public function addMaterials(int $sessionId, int $repId, array $materialIds): array;
}
