<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Brand;

use App\Application\Actions\Action;
use App\Domain\Brand\BrandRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListBrandsAction extends Action
{
    private BrandRepositoryInterface $brandRepository;

    public function __construct(LoggerInterface $logger, BrandRepositoryInterface $brandRepository)
    {
        parent::__construct($logger);
        $this->brandRepository = $brandRepository;
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        $search = $this->request->getQueryParams()['q'] ?? null;
        $page = (int) ($this->request->getQueryParams()['page'] ?? 1);

        $result = $this->brandRepository->findAllByManager($managerId, $search, $page);

        return $this->respondWithData($result);
    }
}
