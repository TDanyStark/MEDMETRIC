<?php

declare(strict_types=1);

namespace App\Domain\VisitSession;

interface VisitSessionRepositoryInterface
{
    public function findAllByRep(int $repId, int $page = 1): array;
    public function findByIdAndRep(int $id, int $repId): VisitSession;
    public function findByDoctorToken(string $token): ?VisitSession;
    public function create(int $repId, int $organizationId, array $data, array $materialIds): VisitSession;
    public function getSessionMaterials(int $sessionId): array;
    public function addMaterials(int $sessionId, int $repId, array $materialIds): array;
}
