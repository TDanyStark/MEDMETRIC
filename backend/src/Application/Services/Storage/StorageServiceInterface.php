<?php

declare(strict_types=1);

namespace App\Application\Services\Storage;

use Psr\Http\Message\UploadedFileInterface;

interface StorageServiceInterface
{
    public function store(UploadedFileInterface $file, string $path): string;
    public function storePdf(UploadedFileInterface $file, string $path): string;

    /**
     * Upload the PDF as-is (fast) and keep the local temp file around so it
     * can be compressed later, outside the request/response cycle.
     *
     * @return array{key: string, tmpPath: string, originalFilename: ?string}
     */
    public function storePdfDeferred(UploadedFileInterface $file, string $path): array;

    /**
     * Compress the PDF at $tmpPath with GhostScript and, if that produces a
     * smaller valid file, upload it under a new key. Always deletes
     * $tmpPath (and any intermediate temp file) when done. Does NOT delete
     * $rawKey — the caller decides when it's safe to do that (e.g. after
     * persisting the new key).
     *
     * @return string|null The new key if the file was replaced, null if
     *                      compression was unavailable/failed/produced no
     *                      gain (the raw upload remains the final file).
     */
    public function compressAndReplacePdf(string $tmpPath, string $rawKey, string $path, ?string $originalFilename): ?string;

    public function delete(string $path): bool;
    public function getUrl(string $path): string;
    public function exists(string $path): bool;
    public function storeImageAsAvif(UploadedFileInterface $file, string $path, int $width = 1200, int $height = 675): string;
    public function getStream(string $path);
    public function getMimeType(string $path): ?string;
    public function getFileSize(string $path): ?int;
}
