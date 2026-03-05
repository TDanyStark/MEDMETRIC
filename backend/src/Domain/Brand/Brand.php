<?php

declare(strict_types=1);

namespace App\Domain\Brand;

use JsonSerializable;

class Brand implements JsonSerializable
{
    public function __construct(
        private int     $id,
        private int     $organizationId,
        private int     $managerId,
        private string  $name,
        private ?string $description,
        private bool    $active,
        private string  $createdAt,
        private string  $updatedAt
    ) {}

    public function getId(): int           { return $this->id; }
    public function getOrganizationId(): int { return $this->organizationId; }
    public function getManagerId(): int    { return $this->managerId; }
    public function getName(): string     { return $this->name; }
    public function getDescription(): ?string { return $this->description; }
    public function isActive(): bool      { return $this->active; }
    public function getCreatedAt(): string { return $this->createdAt; }
    public function getUpdatedAt(): string { return $this->updatedAt; }

    public function jsonSerialize(): array
    {
        return [
            'id'              => $this->id,
            'organization_id' => $this->organizationId,
            'manager_id'      => $this->managerId,
            'name'            => $this->name,
            'description'     => $this->description,
            'active'          => $this->active,
            'created_at'      => $this->createdAt,
            'updated_at'      => $this->updatedAt,
        ];
    }

    public static function fromRow(array $row): self
    {
        return new self(
            id:             (int) $row['id'],
            organizationId: (int) $row['organization_id'],
            managerId:      (int) $row['manager_id'],
            name:           $row['name'],
            description:    $row['description'] ?? null,
            active:         (bool) $row['active'],
            createdAt:      $row['created_at'],
            updatedAt:      $row['updated_at'],
        );
    }
}
