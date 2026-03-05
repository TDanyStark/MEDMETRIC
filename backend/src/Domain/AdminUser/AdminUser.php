<?php

declare(strict_types=1);

namespace App\Domain\AdminUser;

use JsonSerializable;

/**
 * Full user entity used by the admin module.
 * Excludes password_hash from serialization.
 */
class AdminUser implements JsonSerializable
{
    public function __construct(
        private int     $id,
        private int     $organizationId,
        private string  $organizationName,
        private int     $roleId,
        private string  $role,
        private string  $name,
        private string  $email,
        private bool    $active,
        private ?string $lastLoginAt,
        private string  $createdAt,
        private string  $updatedAt
    ) {}

    public function getId(): int               { return $this->id; }
    public function getOrganizationId(): int   { return $this->organizationId; }
    public function getOrganizationName(): string { return $this->organizationName; }
    public function getRoleId(): int           { return $this->roleId; }
    public function getRole(): string          { return $this->role; }
    public function getName(): string          { return $this->name; }
    public function getEmail(): string         { return $this->email; }
    public function isActive(): bool           { return $this->active; }
    public function getLastLoginAt(): ?string  { return $this->lastLoginAt; }
    public function getCreatedAt(): string     { return $this->createdAt; }
    public function getUpdatedAt(): string     { return $this->updatedAt; }

    public function jsonSerialize(): array
    {
        return [
            'id'                => $this->id,
            'organization_id'   => $this->organizationId,
            'organization_name' => $this->organizationName,
            'role_id'           => $this->roleId,
            'role'              => $this->role,
            'name'              => $this->name,
            'email'             => $this->email,
            'active'            => $this->active,
            'last_login_at'     => $this->lastLoginAt,
            'created_at'        => $this->createdAt,
            'updated_at'        => $this->updatedAt,
        ];
    }

    public static function fromRow(array $row): self
    {
        return new self(
            id:               (int)  $row['id'],
            organizationId:   (int)  $row['organization_id'],
            organizationName: $row['organization_name'],
            roleId:           (int)  $row['role_id'],
            role:             $row['role'],
            name:             $row['name'],
            email:            $row['email'],
            active:           (bool) $row['active'],
            lastLoginAt:      $row['last_login_at'] ?? null,
            createdAt:        $row['created_at'],
            updatedAt:        $row['updated_at'],
        );
    }
}
