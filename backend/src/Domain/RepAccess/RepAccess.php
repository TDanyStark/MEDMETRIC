<?php

declare(strict_types=1);

namespace App\Domain\RepAccess;

use JsonSerializable;

class RepAccess implements JsonSerializable
{
    public function __construct(
        private int     $id,
        private int     $repId,
        private int     $managerId,
        private bool    $active,
        private string  $createdAt,
        private string  $updatedAt,
        private ?string $repName = null,
        private ?string $repEmail = null
    ) {}

    public function getId(): int      { return $this->id; }
    public function getRepId(): int    { return $this->repId; }
    public function getManagerId(): int { return $this->managerId; }
    public function isActive(): bool   { return $this->active; }
    public function getCreatedAt(): string { return $this->createdAt; }
    public function getUpdatedAt(): string { return $this->updatedAt; }
    public function getRepName(): ?string { return $this->repName; }
    public function getRepEmail(): ?string { return $this->repEmail; }

    public function jsonSerialize(): array
    {
        return [
            'id'         => $this->id,
            'rep_id'     => $this->repId,
            'manager_id' => $this->managerId,
            'active'     => $this->active,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'rep'        => [
                'id'    => $this->repId,
                'name'  => $this->repName,
                'email' => $this->repEmail,
            ],
        ];
    }

    public static function fromRow(array $row): self
    {
        return new self(
            id:        (int) $row['id'],
            repId:     (int) $row['rep_id'],
            managerId: (int) $row['manager_id'],
            active:    (bool) $row['active'],
            createdAt: $row['created_at'],
            updatedAt: $row['updated_at'],
            repName:   $row['rep_name'] ?? null,
            repEmail:  $row['rep_email'] ?? null,
        );
    }
}
