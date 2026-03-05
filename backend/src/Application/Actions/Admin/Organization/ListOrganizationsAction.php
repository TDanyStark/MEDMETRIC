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
        $queryParams = $this->request->getQueryParams();
        
        $search      = $queryParams['q'] ?? null;
        if ($search === '') $search = null;

        $page        = (int) ($queryParams['page'] ?? 1);
        if ($page < 1) $page = 1;

        $result = $this->organizationRepository->findAll($search, $page);

        return $this->respondWithData($result);
    }
}
