<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Auth;

use App\Domain\Auth\AuthRepositoryInterface;
use App\Infrastructure\Database\Connection;
use PDO;

class DbAuthRepository implements AuthRepositoryInterface
{
    /**
     * Shared projection for every "fetch the authenticating user" query.
     *
     * LEFT JOIN (not JOIN) on organizations is mandatory: superadmins have
     * organization_id = NULL, so an inner join would silently drop their row
     * and break authentication. With LEFT JOIN they get organization_name = NULL.
     */
    private const USER_SELECT =
        'SELECT u.id, u.email, u.name, u.password_hash, u.active, u.organization_id,
                r.name AS role,
                o.name AS organization_name,
                o.timezone AS organization_timezone
         FROM   users u
         JOIN   roles r ON r.id = u.role_id
         LEFT JOIN organizations o ON o.id = u.organization_id';

    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    /**
     * Find a user by email joining roles (role name) and organizations (org name).
     * Returns the full row (including password_hash) or null.
     */
    public function findByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare(
            self::USER_SELECT . ' WHERE u.email = :email LIMIT 1'
        );

        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Find a user by primary key. Same column set as findByEmail().
     * Used by /auth/me to re-hydrate the session straight from the DB
     * instead of echoing back a possibly stale JWT payload.
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            self::USER_SELECT . ' WHERE u.id = :id LIMIT 1'
        );

        $stmt->execute([':id' => $id]);
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
