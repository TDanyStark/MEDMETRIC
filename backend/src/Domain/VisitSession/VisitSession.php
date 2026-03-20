<?php

declare(strict_types=1);

namespace App\Domain\VisitSession;

use JsonSerializable;

class VisitSession implements JsonSerializable
{
    public function __construct(
        private int     $id,
        private int     $organizationId,
        private int     $repId,
        private string  $doctorToken,
        private ?string $doctorName,
        private ?string $notes,
        private bool    $active,
        private string  $createdAt,
        private string  $updatedAt,
        private ?string $repName = null
    ) {}

    public function getId(): int              { return $this->id; }
    public function getOrganizationId(): int    { return $this->organizationId; }
    public function getRepId(): int           { return $this->repId; }
    public function getDoctorToken(): string  { return $this->doctorToken; }
    public function getDoctorName(): ?string  { return $this->doctorName; }
    public function getNotes(): ?string       { return $this->notes; }
    public function isActive(): bool          { return $this->active; }
    public function getCreatedAt(): string    { return $this->createdAt; }
    public function getUpdatedAt(): string    { return $this->updatedAt; }
    public function getRepName(): ?string     { return $this->repName; }

    public function isClosed(): bool { return !$this->active; }

    public function jsonSerialize(): array
    {
        return [
            'id'              => $this->id,
            'organization_id' => $this->organizationId,
            'rep_id'          => $this->repId,
            'doctor_token'    => $this->doctorToken,
            'doctor_name'     => $this->doctorName,
            'notes'           => $this->notes,
            'active'          => $this->active,
            'created_at'      => $this->createdAt,
            'updated_at'      => $this->updatedAt,
            'rep_name'        => $this->repName,
        ];
    }

    public static function fromRow(array $row): self
    {
        return new self(
            id:             (int) $row['id'],
            organizationId: (int) $row['organization_id'],
            repId:          (int) $row['rep_id'],
            doctorToken:    $row['doctor_token'],
            doctorName:     $row['doctor_name'] ?? null,
            notes:          $row['notes'] ?? null,
            active:         (bool) $row['active'],
            createdAt:      $row['created_at'],
            updatedAt:      $row['updated_at'],
            repName:        $row['rep_name'] ?? null,
        );
    }
}
