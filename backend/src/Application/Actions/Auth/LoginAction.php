<?php

declare(strict_types=1);

namespace App\Application\Actions\Auth;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Application\Services\JwtService;
use App\Domain\Auth\AuthRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpUnauthorizedException;

class LoginAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private AuthRepositoryInterface $authRepository,
        private JwtService $jwtService
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $body = $this->getFormData();

        $email    = trim((string) ($body['email']    ?? ''));
        $password = trim((string) ($body['password'] ?? ''));

        if ($email === '' || $password === '') {
            $error = new ActionError(ActionError::BAD_REQUEST, 'Email and password are required.');
            return $this->respond(new ActionPayload(400, null, $error));
        }

        $user = $this->authRepository->findByEmail($email);

        if ($user === null || !password_verify($password, $user['password_hash'])) {
            $error = new ActionError(ActionError::UNAUTHENTICATED, 'Invalid credentials.');
            return $this->respond(new ActionPayload(401, null, $error));
        }

        if (!(bool) $user['active']) {
            $error = new ActionError(ActionError::UNAUTHENTICATED, 'Account is inactive.');
            return $this->respond(new ActionPayload(401, null, $error));
        }

        // Update last_login_at
        $this->authRepository->updateLastLogin((int) $user['id']);

        $tokenPayload = [
            'id'              => (int)  $user['id'],
            'email'           => $user['email'],
            'name'            => $user['name'],
            'role'            => $user['role'],
            'organization_id' => (int)  $user['organization_id'],
        ];

        $token = $this->jwtService->generate($tokenPayload);

        $this->logger->info('Login successful', ['user_id' => $user['id'], 'role' => $user['role']]);

        return $this->respondWithData([
            'token' => $token,
            'user'  => [
                'id'              => (int)  $user['id'],
                'email'           => $user['email'],
                'name'            => $user['name'],
                'role'            => $user['role'],
                'organization_id' => (int)  $user['organization_id'],
            ],
        ]);
    }
}
