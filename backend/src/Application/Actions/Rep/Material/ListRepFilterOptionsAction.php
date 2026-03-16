<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Material;

use App\Application\Actions\Action;
use App\Domain\AdminUser\AdminUserRepositoryInterface;
use App\Domain\Brand\BrandRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListRepFilterOptionsAction extends Action
{
    private AdminUserRepositoryInterface $adminUserRepository;
    private BrandRepositoryInterface $brandRepository;

    public function __construct(
        LoggerInterface $logger,
        AdminUserRepositoryInterface $adminUserRepository,
        BrandRepositoryInterface $brandRepository
    ) {
        parent::__construct($logger);
        $this->adminUserRepository = $adminUserRepository;
        $this->brandRepository = $brandRepository;
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $repId = (int) $authUser['id'];

        $managers = $this->adminUserRepository->getRepSubscriptions($repId);
        $brands = $this->brandRepository->findAllAccessibleByRep($repId);

        return $this->respondWithData([
            'managers' => $managers,
            'brands' => $brands,
        ]);
    }
}
