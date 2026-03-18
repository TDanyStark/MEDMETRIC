<?php

declare(strict_types=1);

namespace App\Application\Services\Storage;

use Psr\Http\Message\UploadedFileInterface;

interface StorageServiceInterface
{
    public function store(UploadedFileInterface $file, string $path): string;
    public function storePdf(UploadedFileInterface $file, string $path): string;
    public function delete(string $path): bool;
    public function getUrl(string $path): string;
    public function exists(string $path): bool;
    public function storeImageAsAvif(UploadedFileInterface $file, string $path, int $width = 1200, int $height = 675): string;
    public function getStream(string $path);
    public function getMimeType(string $path): ?string;
    public function getFileSize(string $path): ?int;
}
