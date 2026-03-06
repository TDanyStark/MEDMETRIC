<?php

declare(strict_types=1);

namespace App\Domain\Auth;

use JsonSerializable;

/**
 * Represents an authenticated user's identity.
 * This is the domain object used after successful login / token verification.
 */
class AuthUser implements JsonSerializable
{
    public function __construct(
        private int       $id,
        private string    $email,
        private string    $name,
        private string    $role,
        private ?int      $organizationId,
        private bool      $active
    ) {}

    public function getId(): int
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function getOrganizationId(): ?int
    {
        return $this->organizationId;
    }

    public function isActive(): bool
    {
        return $this->active;
    }

    public function toArray(): array
    {
        return [
            'id'              => $this->id,
            'email'           => $this->email,
            'name'            => $this->name,
            'role'            => $this->role,
            'organization_id' => $this->organizationId,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            (int) ($data['id'] ?? 0),
            (string) ($data['email'] ?? ''),
            (string) ($data['name'] ?? ''),
            (string) ($data['role'] ?? ''),
            isset($data['organization_id']) ? (int) $data['organization_id'] : null,
            (bool) ($data['active'] ?? true)
        );
    }

    #[\ReturnTypeWillChange]
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
