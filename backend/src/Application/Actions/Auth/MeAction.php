<?php

declare(strict_types=1);

namespace App\Application\Actions\Auth;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\Auth\AuthRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class MeAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private AuthRepositoryInterface $authRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        // The JwtMiddleware already decoded the token and attached the user
        // to the request attribute 'auth_user'.
        $authUser = $this->request->getAttribute('auth_user');

        if ($authUser === null || !isset($authUser['id'])) {
            return $this->unauthenticated('Not authenticated.');
        }

        // Re-query by primary key instead of echoing the decoded JWT back.
        // This lets the session self-heal: tokens issued before a claim was
        // added (e.g. organization_name) are re-hydrated on the next app
        // bootstrap, and stale name/role values are refreshed after an admin
        // edit. Cost is a single PK-indexed SELECT per bootstrap, not per request.
        $user = $this->authRepository->findById((int) $authUser['id']);

        if ($user === null) {
            return $this->unauthenticated('User no longer exists.');
        }

        if (!(bool) $user['active']) {
            return $this->unauthenticated('Account is inactive.');
        }

        // SECURITY: the repository row contains password_hash. Project field by
        // field — never return the row, spread it, or cast it.
        return $this->respondWithData([
            'id'                => (int) $user['id'],
            'email'             => $user['email'],
            'name'              => $user['name'],
            'role'              => $user['role'],
            'organization_id'   => $user['organization_id'] !== null ? (int) $user['organization_id'] : null,
            'organization_name' => $user['organization_name'] ?? null,
            'organization_timezone' => $user['organization_timezone'] ?? null,
        ]);
    }

    private function unauthenticated(string $description): Response
    {
        $error = new ActionError(ActionError::UNAUTHENTICATED, $description);
        return $this->respond(new ActionPayload(401, null, $error));
    }
}
