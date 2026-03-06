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
        
        // Get current user from JWT
        $authUser = $this->request->getAttribute('auth_user');

        // If user is org_admin, force filter by their organization
        if ($authUser !== null && $authUser['role'] === 'org_admin') {
            $organizationId = $authUser['organization_id'] ?? null;
            // org_admin can only view manager and rep roles (not other org_admins or superadmin)
            if ($role === null || !in_array($role, ['manager', 'rep'], true)) {
                $role = ['manager', 'rep']; // Only return manager and rep roles for org_admin
            }
        } elseif (isset($queryParams['organization_id']) && $queryParams['organization_id'] !== '') {
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
