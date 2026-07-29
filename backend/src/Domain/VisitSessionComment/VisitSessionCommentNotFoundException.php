<?php

declare(strict_types=1);

namespace App\Domain\VisitSessionComment;

use App\Domain\DomainException\DomainRecordNotFoundException;

class VisitSessionCommentNotFoundException extends DomainRecordNotFoundException
{
    public function __construct(int $id, ?string $message = null)
    {
        if ($message === null) {
            $message = "Visit session comment with ID {$id} not found";
        }
        parent::__construct($message);
    }
}
