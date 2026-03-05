<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\Organization;

use App\Application\Actions\Action;
use App\Domain\Organization\OrganizationRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListOrganizationsAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private OrganizationRepositoryInterface $organizationRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $organizations = $this->organizationRepository->findAll();

        return $this->respondWithData($organizations);
    }
}
