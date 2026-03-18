<?php

declare(strict_types=1);

namespace App\Application\Services\Auth;

use stdClass;

interface JwtServiceInterface
{
    /**
     * Generate a signed JWT for the given user payload.
     *
     * @param array{id:int, email:string, name:string, role:string, organization_id:int|null} $user
     */
    public function generate(array $user): string;

    /**
     * Decode and validate a JWT string.
     * Returns the decoded stdClass payload or throws on failure.
     */
    public function decode(string $token): stdClass;
}
