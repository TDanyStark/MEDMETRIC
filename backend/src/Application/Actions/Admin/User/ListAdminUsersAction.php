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
        $role           = $queryParams['role']            ?? null;
        $organizationId = isset($queryParams['organization_id'])
            ? (int) $queryParams['organization_id']
            : null;

        $users = $this->adminUserRepository->findAll($role, $organizationId);

        return $this->respondWithData($users);
    }
}
