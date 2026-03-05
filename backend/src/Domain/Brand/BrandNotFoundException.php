<?php

declare(strict_types=1);

namespace App\Domain\Brand;

use App\Domain\DomainException\DomainRecordNotFoundException;

class BrandNotFoundException extends DomainRecordNotFoundException
{
    public function __construct(int $id)
    {
        parent::__construct("Brand with ID {$id} not found");
    }
}
