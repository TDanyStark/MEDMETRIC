<?php

declare(strict_types=1);

namespace App\Application\Middleware;

use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Application\Services\JwtService;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;

/**
 * JWT Authentication Middleware.
 *
 * Validates the Bearer token from the Authorization header.
 * On success, attaches the decoded user payload to the request
 * attribute 'auth_user' (as an associative array).
 * On failure, immediately returns a 401 JSON response.
 */
class JwtMiddleware implements MiddlewareInterface
{
    public function __construct(
        private JwtService $jwtService,
        private ResponseFactoryInterface $responseFactory
    ) {}

    public function process(Request $request, Handler $handler): Response
    {
        $authHeader = $request->getHeaderLine('Authorization');

        if (!str_starts_with($authHeader, 'Bearer ')) {
            return $this->unauthorized('Missing or invalid Authorization header.');
        }

        $token = substr($authHeader, 7);

        try {
            $decoded = $this->jwtService->decode($token);
            // Attach the user sub-object as an array to the request
            $authUser = (array) $decoded->user;
            $request  = $request->withAttribute('auth_user', $authUser);
        } catch (\Exception $e) {
            return $this->unauthorized('Token invalid or expired.');
        }

        return $handler->handle($request);
    }

    private function unauthorized(string $description): Response
    {
        $error   = new ActionError(ActionError::UNAUTHENTICATED, $description);
        $payload = new ActionPayload(401, null, $error);
        $json    = json_encode($payload, JSON_UNESCAPED_SLASHES);

        $response = $this->responseFactory->createResponse(401);
        $response->getBody()->write((string) $json);

        return $response->withHeader('Content-Type', 'application/json');
    }
}
