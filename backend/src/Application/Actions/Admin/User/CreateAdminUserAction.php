<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\User;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\AdminUser\AdminUserRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class CreateAdminUserAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private AdminUserRepositoryInterface $adminUserRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $body = $this->getFormData();

        // Required fields
        $name           = trim((string) ($body['name']            ?? ''));
        $email          = trim((string) ($body['email']           ?? ''));
        $password       = trim((string) ($body['password']        ?? ''));
        $organizationId = isset($body['organization_id']) ? (int) $body['organization_id'] : 0;
        $roleId         = isset($body['role_id'])         ? (int) $body['role_id']         : 0;

        // Validation
        $errors = [];

        if ($name === '')           { $errors[] = 'Name is required.'; }
        if ($email === '')          { $errors[] = 'Email is required.'; }
        if ($password === '')       { $errors[] = 'Password is required.'; }
        if ($organizationId === 0)  { $errors[] = 'Organization is required.'; }
        if ($roleId === 0)          { $errors[] = 'Role is required.'; }

        if (!empty($errors)) {
            $error = new ActionError(ActionError::VALIDATION_ERROR, implode(' ', $errors));
            return $this->respond(new ActionPayload(422, null, $error));
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $error = new ActionError(ActionError::VALIDATION_ERROR, 'Invalid email format.');
            return $this->respond(new ActionPayload(422, null, $error));
        }

        if (strlen($password) < 8) {
            $error = new ActionError(ActionError::VALIDATION_ERROR, 'Password must be at least 8 characters.');
            return $this->respond(new ActionPayload(422, null, $error));
        }

        if ($this->adminUserRepository->emailExists($email)) {
            $error = new ActionError(ActionError::VALIDATION_ERROR, "Email '{$email}' is already registered.");
            return $this->respond(new ActionPayload(422, null, $error));
        }

        $user = $this->adminUserRepository->create([
            'name'            => $name,
            'email'           => $email,
            'password'        => $password,
            'organization_id' => $organizationId,
            'role_id'         => $roleId,
            'active'          => isset($body['active']) ? (bool) $body['active'] : true,
        ]);

        $this->logger->info('User created by admin', ['user_id' => $user->getId(), 'email' => $email]);

        return $this->respondWithData($user, 201, 'User created successfully.');
    }
}
