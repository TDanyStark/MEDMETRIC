<?php

declare(strict_types=1);

namespace App\Application\Actions\Auth;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class MeAction extends Action
{
    public function __construct(LoggerInterface $logger)
    {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        // The JwtMiddleware already decoded the token and attached the user
        // to the request attribute 'auth_user'.
        $authUser = $this->request->getAttribute('auth_user');

        if ($authUser === null) {
            $error = new ActionError(ActionError::UNAUTHENTICATED, 'Not authenticated.');
            return $this->respond(new ActionPayload(401, null, $error));
        }

        return $this->respondWithData((array) $authUser);
    }
}
