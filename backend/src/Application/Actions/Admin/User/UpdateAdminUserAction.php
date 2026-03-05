<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\User;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\AdminUser\AdminUserRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class UpdateAdminUserAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private AdminUserRepositoryInterface $adminUserRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $userId = (int) $this->resolveArg('id');
        $body = $this->getFormData();

        // Get current user from JWT
        $authUser = $this->request->getAttribute('auth_user');
        $isOrgAdmin = $authUser !== null && $authUser['role'] === 'org_admin';

        // Load existing user
        try {
            $existingUser = $this->adminUserRepository->findById($userId);
        } catch (\App\Domain\AdminUser\AdminUserNotFoundException $e) {
            $error = new ActionError(ActionError::RESOURCE_NOT_FOUND, 'User not found.');
            return $this->respond(new ActionPayload(404, null, $error));
        }

        // If org_admin, verify the user belongs to their organization
        if ($isOrgAdmin) {
            if ($existingUser->getOrganizationId() !== ($authUser['organization_id'] ?? null)) {
                $error = new ActionError(ActionError::INSUFFICIENT_PRIVILEGES, 'You can only manage users from your organization.');
                return $this->respond(new ActionPayload(403, null, $error));
            }
            // org_admin cannot edit org_admins or superadmins
            if (!in_array($existingUser->getRole(), ['manager', 'rep'], true)) {
                $error = new ActionError(ActionError::INSUFFICIENT_PRIVILEGES, 'You can only edit managers or representatives.');
                return $this->respond(new ActionPayload(403, null, $error));
            }
        }

        $updates = [];

        // Optional fields
        if (isset($body['name'])) {
            $name = trim((string) $body['name']);
            if ($name === '') {
                $error = new ActionError(ActionError::VALIDATION_ERROR, 'Name cannot be empty.');
                return $this->respond(new ActionPayload(422, null, $error));
            }
            $updates['name'] = $name;
        }

        if (isset($body['email'])) {
            $email = trim((string) $body['email']);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $error = new ActionError(ActionError::VALIDATION_ERROR, 'Invalid email format.');
                return $this->respond(new ActionPayload(422, null, $error));
            }
            // Check email uniqueness if changed
            if ($email !== $existingUser->getEmail() && $this->adminUserRepository->emailExists($email, $userId)) {
                $error = new ActionError(ActionError::VALIDATION_ERROR, "Email '{$email}' is already registered.");
                return $this->respond(new ActionPayload(422, null, $error));
            }
            $updates['email'] = $email;
        }

        if (isset($body['password']) && $body['password'] !== '') {
            $password = trim((string) $body['password']);
            if (strlen($password) < 8) {
                $error = new ActionError(ActionError::VALIDATION_ERROR, 'Password must be at least 8 characters.');
                return $this->respond(new ActionPayload(422, null, $error));
            }
            $updates['password'] = $password;
        }

        // Only superadmin can change organization and role
        if (!$isOrgAdmin) {
            if (isset($body['organization_id'])) {
                $updates['organization_id'] = (int) $body['organization_id'];
            }
            if (isset($body['role_id'])) {
                $updates['role_id'] = (int) $body['role_id'];
            }
        }

        if (isset($body['active'])) {
            $updates['active'] = (bool) $body['active'];
        }

        if (empty($updates)) {
            return $this->respondWithData($existingUser, 200, 'No changes to apply.');
        }

        $updatedUser = $this->adminUserRepository->update($userId, $updates);

        $this->logger->info('User updated', ['user_id' => $userId, 'updated_by_role' => $authUser['role'] ?? 'unknown']);

        return $this->respondWithData($updatedUser, 200, 'User updated successfully.');
    }
}
