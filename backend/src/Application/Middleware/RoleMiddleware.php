<?php

declare(strict_types=1);

namespace App\Application\Middleware;

use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

/**
 * Role-based access control middleware.
 *
 * Usage in routes:
 *   ->add(new RoleMiddleware($responseFactory, ['admin']))
 *   ->add(new RoleMiddleware($responseFactory, ['admin', 'manager']))
 *
 * Requires JwtMiddleware to run first (sets 'auth_user' request attribute).
 */
class RoleMiddleware implements MiddlewareInterface
{
    /**
     * @param string[] $allowedRoles
     */
    public function __construct(
        private ResponseFactoryInterface $responseFactory,
        private array $allowedRoles
    ) {}

    public function process(Request $request, Handler $handler): Response
    {
        $authUser = $request->getAttribute('auth_user');

        if ($authUser === null) {
            return $this->forbidden('Not authenticated.');
        }

        $role = $authUser['role'] ?? '';

        if (!in_array($role, $this->allowedRoles, true)) {
            return $this->forbidden(
                sprintf('Access denied. Required role(s): %s.', implode(', ', $this->allowedRoles))
            );
        }

        return $handler->handle($request);
    }

    private function forbidden(string $description): Response
    {
        $error   = new ActionError(ActionError::INSUFFICIENT_PRIVILEGES, $description);
        $payload = new ActionPayload(403, null, $error);
        $json    = json_encode($payload, JSON_UNESCAPED_SLASHES);

        $response = $this->responseFactory->createResponse(403);
        $response->getBody()->write((string) $json);

        return $response->withHeader('Content-Type', 'application/json');
    }
}
