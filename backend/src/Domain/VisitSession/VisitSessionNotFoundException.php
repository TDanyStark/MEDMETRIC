<?php

declare(strict_types=1);

namespace App\Domain\VisitSession;

use App\Domain\DomainException\DomainRecordNotFoundException;

class VisitSessionNotFoundException extends DomainRecordNotFoundException
{
    public function __construct(int $id, ?string $message = null)
    {
        if ($message === null) {
            $message = "Visit session with ID {$id} not found";
        }
        parent::__construct($message);
    }
    
    public static function byToken(string $token): self
    {
        return new self(0, "Visit session with token {$token} not found");
    }
}
