<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Auth;

use App\Domain\Auth\AuthRepositoryInterface;
use App\Infrastructure\Database\Connection;
use PDO;

class DbAuthRepository implements AuthRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    /**
     * Find a user by email joining the roles table to get the role name.
     * Returns the full row (including password_hash) or null.
     */
    public function findByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT u.id, u.email, u.name, u.password_hash, u.active, u.organization_id,
                    r.name AS role
            FROM   users u
            JOIN   roles r ON r.id = u.role_id
            WHERE  u.email = :email
            LIMIT  1'
        );

        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Set last_login_at to now for the given user id.
     */
    public function updateLastLogin(int $userId): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE users SET last_login_at = NOW() WHERE id = :id'
        );

        $stmt->execute([':id' => $userId]);
    }

    /**
     * Update the password hash for a user.
     */
    public function updatePassword(int $userId, string $passwordHash): void
    {
        $stmt = $this->pdo->prepare(
            'UPDATE users SET password_hash = :hash WHERE id = :id'
        );

        $stmt->execute([
            ':hash' => $passwordHash,
            ':id' => $userId,
        ]);
    }
}
