<?php

declare(strict_types=1);

namespace App\Application\Services\Storage;

use Psr\Http\Message\UploadedFileInterface;

class LocalStorageService implements StorageServiceInterface
{
    private string $basePath;

    public function __construct()
    {
        $this->basePath = dirname(__DIR__, 4) . '/storage/materials';
        
        if (!is_dir($this->basePath)) {
            mkdir($this->basePath, 0755, true);
        }
    }

    public function store(UploadedFileInterface $file, string $path): string
    {
        $relativePath = ltrim($path, '/');
        $dir = $this->basePath . '/' . $relativePath;

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $filename = $this->generateFilename($file->getClientFilename());
        $destination = $dir . '/' . $filename;

        $file->moveTo($destination);

        return $relativePath . '/' . $filename;
    }

    public function delete(string $path): bool
    {
        $fullPath = $this->basePath . '/' . ltrim($path, '/');
        
        if (file_exists($fullPath) && is_file($fullPath)) {
            return unlink($fullPath);
        }

        return false;
    }

    public function getUrl(string $path): string
    {
        $relativePath = ltrim($path, '/');
        return '/storage/materials/' . $relativePath;
    }

    public function exists(string $path): bool
    {
        $fullPath = $this->basePath . '/' . ltrim($path, '/');
        return file_exists($fullPath) && is_file($fullPath);
    }

    private function generateFilename(?string $originalFilename): string
    {
        if (!$originalFilename) {
            return uniqid('file_', true);
        }

        $extension = pathinfo($originalFilename, PATHINFO_EXTENSION);
        $basename = pathinfo($originalFilename, PATHINFO_FILENAME);
        
        $safeBasename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $basename);
        
        return $safeBasename . '_' . time() . '.' . $extension;
    }
}
