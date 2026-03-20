<?php

declare(strict_types=1);

namespace App\Application\Actions\Auth;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\Auth\AuthRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ChangePasswordAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private AuthRepositoryInterface $authRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');

        if ($authUser === null) {
            $error = new ActionError(ActionError::UNAUTHENTICATED, 'Not authenticated.');
            return $this->respond(new ActionPayload(401, null, $error));
        }

        $body = $this->getFormData();
        $currentPassword = (string) ($body['current_password'] ?? '');
        $newPassword     = (string) ($body['new_password']     ?? '');

        if ($currentPassword === '' || $newPassword === '') {
            $error = new ActionError(ActionError::BAD_REQUEST, 'Current and new password are required.');
            return $this->respond(new ActionPayload(400, null, $error));
        }

        // Fetch user from DB to get the current password hash
        $user = $this->authRepository->findByEmail($authUser['email']);

        if ($user === null) {
            $error = new ActionError(ActionError::RESOURCE_NOT_FOUND, 'User not found.');
            return $this->respond(new ActionPayload(404, null, $error));
        }

        // Verify current password
        if (!password_verify($currentPassword, $user['password_hash'])) {
            $error = new ActionError(ActionError::UNAUTHENTICATED, 'Current password is incorrect.');
            return $this->respond(new ActionPayload(401, null, $error));
        }

        // Hash new password
        $newPasswordHash = password_hash($newPassword, PASSWORD_BCRYPT);

        // Update password
        $this->authRepository->updatePassword((int) $user['id'], $newPasswordHash);

        $this->logger->info('Password changed successfully', ['user_id' => $user['id']]);

        return $this->respondWithData(['message' => 'Password changed successfully']);
    }
}
