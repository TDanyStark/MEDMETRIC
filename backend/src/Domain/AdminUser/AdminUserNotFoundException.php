<?php

declare(strict_types=1);

namespace App\Domain\AdminUser;

use App\Domain\DomainException\DomainRecordNotFoundException;

class AdminUserNotFoundException extends DomainRecordNotFoundException
{
    public function __construct(int $id)
    {
        parent::__construct("User with id `{$id}` not found.");
    }
}
