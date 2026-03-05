<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\User;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\AdminUser\AdminUserRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Update Org Admin (for Super Admin)
 * Updates an existing org_admin user
 */
class UpdateOrgAdminAction extends Action
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

        // Verify the user exists and is an org_admin
        $existingUser = $this->adminUserRepository->findById($userId);
        if ($existingUser === null) {
            $error = new ActionError(ActionError::RESOURCE_NOT_FOUND, 'User not found.');
            return $this->respond(new ActionPayload(404, null, $error));
        }

        if ($existingUser->getRole() !== 'org_admin') {
            $error = new ActionError(ActionError::VALIDATION_ERROR, 'User is not an Organization Admin.');
            return $this->respond(new ActionPayload(422, null, $error));
        }

        $body = $this->getFormData();

        $updates = [];

        // Optional fields
        if (isset($body['name'])) {
            $name = trim((string) $body['name']);
            if ($name !== '') {
                $updates['name'] = $name;
            }
        }

        if (isset($body['email'])) {
            $email = trim((string) $body['email']);
            if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                // Check email uniqueness if changed
                if ($email !== $existingUser->getEmail() && $this->adminUserRepository->emailExists($email)) {
                    $error = new ActionError(ActionError::VALIDATION_ERROR, "Email '{$email}' is already registered.");
                    return $this->respond(new ActionPayload(422, null, $error));
                }
                $updates['email'] = $email;
            }
        }

        if (isset($body['password']) && $body['password'] !== '') {
            $password = trim((string) $body['password']);
            if (strlen($password) < 8) {
                $error = new ActionError(ActionError::VALIDATION_ERROR, 'Password must be at least 8 characters.');
                return $this->respond(new ActionPayload(422, null, $error));
            }
            $updates['password'] = $password;
        }

        // Superadmin can change organization assignment
        if (isset($body['organization_id'])) {
            $updates['organization_id'] = (int) $body['organization_id'];
        }

        if (isset($body['active'])) {
            $updates['active'] = (bool) $body['active'];
        }

        if (empty($updates)) {
            return $this->respondWithData($existingUser, 200, 'No changes to apply.');
        }

        $updatedUser = $this->adminUserRepository->update($userId, $updates);

        $this->logger->info('Org Admin updated by superadmin', ['user_id' => $userId, 'updates' => array_keys($updates)]);

        return $this->respondWithData($updatedUser, 200, 'Organization Admin updated successfully.');
    }
}
