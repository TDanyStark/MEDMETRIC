<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\Brand;

use App\Application\Actions\Action;
use App\Domain\Brand\BrandRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListBrandsAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private BrandRepositoryInterface $brandRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $queryParams = $this->request->getQueryParams();
        
        $organizationId = null;
        if (isset($queryParams['organization_id']) && $queryParams['organization_id'] !== '') {
            $organizationId = (int) $queryParams['organization_id'];
        }

        $search = $queryParams['q'] ?? null;
        if ($search === '') $search = null;

        $page = (int) ($queryParams['page'] ?? 1);
        if ($page < 1) $page = 1;

        $result = $this->brandRepository->findAll($organizationId, $search, $page);

        return $this->respondWithData($result);
    }
}
