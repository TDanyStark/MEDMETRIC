<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\User;

use App\Application\Actions\Action;
use App\Domain\AdminUser\AdminUserRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListAdminUsersAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private AdminUserRepositoryInterface $adminUserRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $queryParams    = $this->request->getQueryParams();
        
        $role           = $queryParams['role'] ?? null;
        if ($role === '') $role = null;

        $organizationId = null;
        if (isset($queryParams['organization_id']) && $queryParams['organization_id'] !== '') {
            $organizationId = (int) $queryParams['organization_id'];
        }

        $search         = $queryParams['q'] ?? null;
        if ($search === '') $search = null;

        $page           = (int) ($queryParams['page'] ?? 1);
        if ($page < 1) $page = 1;

        $result = $this->adminUserRepository->findAll($role, $organizationId, $search, $page);

        return $this->respondWithData($result);
    }
}
