<?php

declare(strict_types=1);

namespace App\Domain\Auth;

interface AuthRepositoryInterface
{
    /**
     * Find a user by email and return a full row (including password_hash).
     * Returns null if not found.
     */
    public function findByEmail(string $email): ?array;

    /**
     * Update the last_login_at timestamp for a user.
     */
    public function updateLastLogin(int $userId): void;
}
