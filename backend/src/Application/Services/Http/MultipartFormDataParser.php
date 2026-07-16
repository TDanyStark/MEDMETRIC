<?php

declare(strict_types=1);

namespace App\Application\Services\Http;

/**
 * Manually parses a raw `multipart/form-data` request body.
 *
 * PHP only auto-populates `$_POST`/`$_FILES` from a multipart body for
 * POST requests. For PUT/PATCH (or any other non-POST method), the raw
 * body sits entirely unparsed in `php://input` — this class fills that
 * gap so those methods can carry file uploads too.
 *
 * This is pure parsing logic with no PSR-7/Slim dependency, so it can be
 * unit-tested and reused from a middleware (preferred) or, if ever
 * needed, called directly from an Action.
 */
final class MultipartFormDataParser
{
    /**
     * @return array{fields: array<string, string>, files: array<string, array{name: string, type: string, tmp_name: string, error: int, size: int}>}
     */
    public static function parse(string $rawBody, string $boundary): array
    {
        $fields = [];
        $files = [];

        if ($boundary === '' || $rawBody === '') {
            return ['fields' => $fields, 'files' => $files];
        }

        $delimiter = '--' . $boundary;
        $parts = explode($delimiter, $rawBody);

        foreach ($parts as $rawPart) {
            $part = ltrim($rawPart, "\r\n");

            // Skip the preamble (content before the first boundary, empty
            // once trimmed) and the closing "--" marker of the last part.
            if ($part === '' || rtrim($part) === '--') {
                continue;
            }

            $headerBodySplit = explode("\r\n\r\n", $part, 2);
            if (count($headerBodySplit) !== 2) {
                continue;
            }

            [$rawHeaders, $content] = $headerBodySplit;

            // Strip the single trailing CRLF that precedes the next boundary.
            $content = preg_replace('/\r\n\z/', '', $content) ?? $content;

            [$name, $filename, $contentType] = self::parseHeaders($rawHeaders);

            if ($name === null) {
                continue;
            }

            if ($filename !== null) {
                $files[$name] = self::buildFileEntry($filename, $contentType, $content);
            } else {
                $fields[$name] = $content;
            }
        }

        return ['fields' => $fields, 'files' => $files];
    }

    /**
     * Extracts the multipart boundary token from a `Content-Type` header
     * value (e.g. `multipart/form-data; boundary=----WebKitFormBoundaryXYZ`).
     * Returns an empty string if none is found.
     */
    public static function extractBoundary(string $contentTypeHeader): string
    {
        if (preg_match('/boundary=(?:"([^"]+)"|([^;]+))/i', $contentTypeHeader, $matches)) {
            return trim($matches[1] !== '' ? $matches[1] : $matches[2]);
        }

        return '';
    }

    /**
     * @return array{0: string|null, 1: string|null, 2: string|null} [name, filename, contentType]
     */
    private static function parseHeaders(string $rawHeaders): array
    {
        $name = null;
        $filename = null;
        $contentType = null;

        foreach (explode("\r\n", $rawHeaders) as $headerLine) {
            if (stripos($headerLine, 'Content-Disposition:') === 0) {
                if (preg_match('/\bname="([^"]*)"/', $headerLine, $m)) {
                    $name = $m[1];
                }
                if (preg_match('/\bfilename="([^"]*)"/', $headerLine, $m)) {
                    $filename = $m[1];
                }
            } elseif (stripos($headerLine, 'Content-Type:') === 0) {
                $contentType = trim(substr($headerLine, strlen('Content-Type:')));
            }
        }

        return [$name, $filename, $contentType];
    }

    /**
     * @return array{name: string, type: string, tmp_name: string, error: int, size: int}
     */
    private static function buildFileEntry(string $filename, ?string $contentType, string $content): array
    {
        $type = $contentType ?? 'application/octet-stream';

        if ($filename === '') {
            // A file input was submitted with no file selected.
            return [
                'name' => '',
                'type' => $type,
                'tmp_name' => '',
                'error' => UPLOAD_ERR_NO_FILE,
                'size' => 0,
            ];
        }

        $tmpPath = tempnam(sys_get_temp_dir(), 'medmetric_put_upload_');

        if ($tmpPath === false || file_put_contents($tmpPath, $content) === false) {
            return [
                'name' => $filename,
                'type' => $type,
                'tmp_name' => '',
                'error' => UPLOAD_ERR_CANT_WRITE,
                'size' => 0,
            ];
        }

        return [
            'name' => $filename,
            'type' => $type,
            'tmp_name' => $tmpPath,
            'error' => UPLOAD_ERR_OK,
            'size' => strlen($content),
        ];
    }
}
