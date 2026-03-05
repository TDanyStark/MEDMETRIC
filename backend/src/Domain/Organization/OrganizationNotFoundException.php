<?php

declare(strict_types=1);

namespace App\Domain\Organization;

use App\Domain\DomainException\DomainRecordNotFoundException;

class OrganizationNotFoundException extends DomainRecordNotFoundException
{
    public function __construct(int $id)
    {
        parent::__construct("Organization with id `{$id}` not found.");
    }
}
