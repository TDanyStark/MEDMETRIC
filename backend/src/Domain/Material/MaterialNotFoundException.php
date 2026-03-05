<?php

declare(strict_types=1);

namespace App\Domain\Material;

use App\Domain\DomainException\DomainRecordNotFoundException;

class MaterialNotFoundException extends DomainRecordNotFoundException
{
    public function __construct(int $id)
    {
        parent::__construct("Material with ID {$id} not found");
    }
}
