<?php

declare(strict_types=1);

namespace App\Domain\MaterialStudy;

use App\Domain\DomainException\DomainRecordNotFoundException;

class MaterialStudyNotFoundException extends DomainRecordNotFoundException
{
    public function __construct(int $id)
    {
        parent::__construct("Material study with ID {$id} not found");
    }
}
