<?php

declare(strict_types=1);

namespace App\Application\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use stdClass;

class JwtService
{
    private string $secret;
    private string $algorithm = 'HS256';

    // TTL in seconds per role
    private const TTL_REP   = 86400;       // 1 day  (visitador medico)
    private const TTL_OTHER = 604800;      // 7 days (admin / manager)

    public function __construct()
    {
        $this->secret = $_ENV['JWT_SECRET'] ?? 'change_me_in_production';
    }

    /**
     * Generate a signed JWT for the given user payload.
     *
     * @param array{id:int, email:string, name:string, role:string, organization_id:int} $user
     */
    public function generate(array $user): string
    {
        $ttl = $user['role'] === 'rep' ? self::TTL_REP : self::TTL_OTHER;
        $now = time();

        $payload = [
            'iss' => 'medmetric',
            'iat' => $now,
            'exp' => $now + $ttl,
            'sub' => (string) $user['id'],
            'user' => [
                'id'              => $user['id'],
                'email'           => $user['email'],
                'name'            => $user['name'],
                'role'            => $user['role'],
                'organization_id' => $user['organization_id'],
            ],
        ];

        return JWT::encode($payload, $this->secret, $this->algorithm);
    }

    /**
     * Decode and validate a JWT string.
     * Returns the decoded stdClass payload or throws on failure.
     *
     * @throws \Firebase\JWT\ExpiredException
     * @throws \Firebase\JWT\SignatureInvalidException
     * @throws \UnexpectedValueException
     */
    public function decode(string $token): stdClass
    {
        return JWT::decode($token, new Key($this->secret, $this->algorithm));
    }
}
