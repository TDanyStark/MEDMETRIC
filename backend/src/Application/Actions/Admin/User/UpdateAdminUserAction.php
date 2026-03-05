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
        $id   = (int) $this->resolveArg('id');
        $body = (array) $this->getFormData();

        // Validate email uniqueness if changing
        if (!empty($body['email'])) {
            $email = trim((string) $body['email']);

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $error = new ActionError(ActionError::VALIDATION_ERROR, 'Invalid email format.');
                return $this->respond(new ActionPayload(422, null, $error));
            }

            if ($this->adminUserRepository->emailExists($email, $id)) {
                $error = new ActionError(ActionError::VALIDATION_ERROR, "Email '{$email}' is already registered.");
                return $this->respond(new ActionPayload(422, null, $error));
            }

            $body['email'] = $email;
        }

        // Validate password length if provided
        if (!empty($body['password']) && strlen($body['password']) < 8) {
            $error = new ActionError(ActionError::VALIDATION_ERROR, 'Password must be at least 8 characters.');
            return $this->respond(new ActionPayload(422, null, $error));
        }

        if (isset($body['name'])) {
            $body['name'] = trim((string) $body['name']);

            if ($body['name'] === '') {
                $error = new ActionError(ActionError::VALIDATION_ERROR, 'Name cannot be empty.');
                return $this->respond(new ActionPayload(422, null, $error));
            }
        }

        $user = $this->adminUserRepository->update($id, $body);

        $this->logger->info('User updated by admin', ['user_id' => $id]);

        return $this->respondWithData($user, 200, 'User updated successfully.');
    }
}
