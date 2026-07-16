<?php

declare(strict_types=1);

namespace App\Application\Middleware;

use App\Application\Services\Http\MultipartFormDataParser;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface as Middleware;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Psr7\UploadedFile;

/**
 * Fixes a well-known PHP limitation: `$_POST`/`$_FILES` (and therefore
 * Slim's request-from-globals population of `getParsedBody()` /
 * `getUploadedFiles()` for non-JSON bodies) are ONLY populated
 * automatically by PHP for POST requests. For PUT/PATCH requests with a
 * `multipart/form-data` body, PHP leaves the raw body entirely unparsed
 * in `php://input`, so both `getParsedBody()` and `getUploadedFiles()`
 * silently return empty — every PUT-with-file-upload endpoint in this
 * API was returning 422 "No data provided" because of this.
 *
 * This middleware manually parses that raw body for PUT/PATCH requests
 * carrying a `multipart/form-data` Content-Type, and populates:
 *   - the PSR-7 request's parsed body (`withParsedBody`) and uploaded
 *     files (`withUploadedFiles`) — the idiomatic PSR-7 way to read it, and
 *   - the `$_POST` superglobal, since the existing Action classes in this
 *     codebase read `$_POST` directly as their fallback for non-JSON
 *     bodies (mirroring what PHP itself does natively for POST requests).
 *
 * Populating both means this fixes every current PUT+multipart endpoint
 * without touching any Action code, AND any future endpoint that reads
 * either `$_POST` or `getParsedBody()`/`getUploadedFiles()` will work
 * correctly too.
 *
 * GET/POST/DELETE requests (and PUT/PATCH requests with JSON or
 * urlencoded bodies) are completely unaffected — this middleware is a
 * no-op unless the method is PUT/PATCH AND the Content-Type is
 * multipart/form-data.
 */
class MultipartFormDataMiddleware implements Middleware
{
    private const HANDLED_METHODS = ['PUT', 'PATCH'];

    public function process(Request $request, RequestHandler $handler): Response
    {
        if (!in_array($request->getMethod(), self::HANDLED_METHODS, true)) {
            return $handler->handle($request);
        }

        $contentType = $request->getHeaderLine('Content-Type');

        if (!str_contains(strtolower($contentType), 'multipart/form-data')) {
            return $handler->handle($request);
        }

        $boundary = MultipartFormDataParser::extractBoundary($contentType);

        if ($boundary === '') {
            return $handler->handle($request);
        }

        $rawBody = (string) $request->getBody();

        if ($rawBody === '') {
            return $handler->handle($request);
        }

        $parsed = MultipartFormDataParser::parse($rawBody, $boundary);

        // Mirror PHP's own POST behavior for the Actions that read $_POST
        // directly as their non-JSON fallback.
        $_POST = $parsed['fields'];

        $uploadedFiles = [];
        foreach ($parsed['files'] as $fieldName => $file) {
            $uploadedFiles[$fieldName] = new UploadedFile(
                $file['tmp_name'] !== '' ? $file['tmp_name'] : 'php://temp',
                $file['name'],
                $file['type'],
                $file['size'],
                $file['error'],
                false
            );
        }

        $request = $request
            ->withParsedBody($parsed['fields'])
            ->withUploadedFiles($uploadedFiles);

        return $handler->handle($request);
    }
}
