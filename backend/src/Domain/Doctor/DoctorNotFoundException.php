<?php

declare(strict_types=1);

namespace App\Domain\Doctor;

use App\Domain\DomainException\DomainRecordNotFoundException;

class DoctorNotFoundException extends DomainRecordNotFoundException
{
    public function __construct(int $id)
    {
        parent::__construct("Doctor with ID {$id} not found");
    }
}
