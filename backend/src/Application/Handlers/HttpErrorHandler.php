<?php

declare(strict_types=1);

namespace App\Application\Handlers;

use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use PDOException;
use Psr\Http\Message\ResponseInterface as Response;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpException;
use Slim\Exception\HttpForbiddenException;
use Slim\Exception\HttpMethodNotAllowedException;
use Slim\Exception\HttpNotFoundException;
use Slim\Exception\HttpNotImplementedException;
use Slim\Exception\HttpUnauthorizedException;
use Slim\Handlers\ErrorHandler as SlimErrorHandler;
use Throwable;

class HttpErrorHandler extends SlimErrorHandler
{
    /**
     * MySQL errno for foreign key constraint violations (RESTRICT/NO ACTION on delete/update).
     */
    private const MYSQL_FK_ERRNO = [1451, 1452];

    private const FK_CONSTRAINT_MESSAGE =
        'No se puede eliminar este elemento porque tiene datos relacionados. '
        . 'Intenta de nuevo o contacta soporte si el problema persiste.';

    /**
     * @inheritdoc
     */
    protected function respond(): Response
    {
        $exception = $this->exception;
        $statusCode = 500;
        $error = new ActionError(
            ActionError::SERVER_ERROR,
            'An internal error has occurred while processing your request.'
        );

        $fkViolation = $exception instanceof Throwable
            ? $this->findForeignKeyViolation($exception)
            : null;

        if ($fkViolation !== null) {
            // Log the real technical detail server-side, but never expose it to the client.
            $this->logger->error('Foreign key constraint violation', [
                'exception' => $fkViolation->getMessage(),
                'code' => $fkViolation->getCode(),
                'trace' => $fkViolation->getTraceAsString(),
            ]);

            $statusCode = 409;
            $error->setType(ActionError::VERIFICATION_ERROR);
            $error->setDescription(self::FK_CONSTRAINT_MESSAGE);

            $payload = new ActionPayload($statusCode, null, $error);
            $encodedPayload = json_encode($payload, JSON_PRETTY_PRINT);

            $response = $this->responseFactory->createResponse($statusCode);
            $response->getBody()->write($encodedPayload);

            return $response->withHeader('Content-Type', 'application/json');
        }

        if ($fkViolation === null && $exception instanceof Throwable && !($exception instanceof HttpException)) {
            // Any exception that isn't a known HttpException (4xx) or FK violation results in a
            // generic 500 response. Log it here so it stays traceable in app.log.
            $this->logger->error('Unhandled server error', [
                'exception' => $exception->getMessage(),
                'code' => $exception->getCode(),
                'trace' => $exception->getTraceAsString(),
            ]);
        }

        if ($exception instanceof HttpException) {
            $statusCode = $exception->getCode();
            $error->setDescription($exception->getMessage());

            if ($exception instanceof HttpNotFoundException) {
                $error->setType(ActionError::RESOURCE_NOT_FOUND);
            } elseif ($exception instanceof HttpMethodNotAllowedException) {
                $error->setType(ActionError::NOT_ALLOWED);
            } elseif ($exception instanceof HttpUnauthorizedException) {
                $error->setType(ActionError::UNAUTHENTICATED);
            } elseif ($exception instanceof HttpForbiddenException) {
                $error->setType(ActionError::INSUFFICIENT_PRIVILEGES);
            } elseif ($exception instanceof HttpBadRequestException) {
                $error->setType(ActionError::BAD_REQUEST);
            } elseif ($exception instanceof HttpNotImplementedException) {
                $error->setType(ActionError::NOT_IMPLEMENTED);
            }
        }

        if (
            !($exception instanceof HttpException)
            && $exception instanceof Throwable
            && !($exception instanceof PDOException)
            && $this->displayErrorDetails
        ) {
            // Never leak raw PDO/SQL exception messages to the client, even in debug mode.
            $error->setDescription($exception->getMessage());
        }

        $payload = new ActionPayload($statusCode, null, $error);
        $encodedPayload = json_encode($payload, JSON_PRETTY_PRINT);

        $response = $this->responseFactory->createResponse($statusCode);
        $response->getBody()->write($encodedPayload);

        return $response->withHeader('Content-Type', 'application/json');
    }

    /**
     * Walks the exception chain (including wrapped/previous exceptions) looking for a
     * PDOException that represents a foreign key constraint violation
     * (SQLSTATE 23000, MySQL errno 1451 "cannot delete or update a parent row" or
     * 1452 "cannot add or update a child row").
     */
    private function findForeignKeyViolation(Throwable $exception): ?PDOException
    {
        $current = $exception;

        while ($current !== null) {
            if ($current instanceof PDOException && $this->isForeignKeyViolation($current)) {
                return $current;
            }

            $current = $current->getPrevious();
        }

        return null;
    }

    private function isForeignKeyViolation(PDOException $exception): bool
    {
        if ($exception->getCode() === '23000') {
            return true;
        }

        foreach (self::MYSQL_FK_ERRNO as $errno) {
            if (str_contains($exception->getMessage(), (string) $errno)) {
                return true;
            }
        }

        $errorInfo = $exception->errorInfo ?? null;
        if (is_array($errorInfo)) {
            if (($errorInfo[0] ?? null) === '23000') {
                return true;
            }
            if (in_array($errorInfo[1] ?? null, self::MYSQL_FK_ERRNO, true)) {
                return true;
            }
        }

        return false;
    }
}
