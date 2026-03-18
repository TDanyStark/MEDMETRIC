<?php

declare(strict_types=1);

namespace App\Infrastructure\Auth;

use App\Application\Services\Auth\JwtServiceInterface;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use stdClass;

class JwtService implements JwtServiceInterface
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
     * {@inheritdoc}
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
                'organization_id' => $user['organization_id'] ?? null,
            ],
        ];

        return JWT::encode($payload, $this->secret, $this->algorithm);
    }

    /**
     * {@inheritdoc}
     */
    public function decode(string $token): stdClass
    {
        return JWT::decode($token, new Key($this->secret, $this->algorithm));
    }
}
