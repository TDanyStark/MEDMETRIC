<?php

declare(strict_types=1);

namespace App\Domain\Organization;

use JsonSerializable;

class Organization implements JsonSerializable
{
    public function __construct(
        private int    $id,
        private string $name,
        private string $slug,
        private bool   $active,
        private string $createdAt,
        private string $updatedAt
    ) {}

    public function getId(): int        { return $this->id; }
    public function getName(): string   { return $this->name; }
    public function getSlug(): string   { return $this->slug; }
    public function isActive(): bool    { return $this->active; }
    public function getCreatedAt(): string { return $this->createdAt; }
    public function getUpdatedAt(): string { return $this->updatedAt; }

    public function jsonSerialize(): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'slug'       => $this->slug,
            'active'     => $this->active,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
        ];
    }

    public static function fromRow(array $row): self
    {
        return new self(
            id:        (int)  $row['id'],
            name:      $row['name'],
            slug:      $row['slug'],
            active:    (bool) $row['active'],
            createdAt: $row['created_at'],
            updatedAt: $row['updated_at'],
        );
    }
}
