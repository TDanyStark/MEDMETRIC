<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

use Psr\Http\Message\UploadedFileInterface;

class LocalStorageService extends AbstractStorageService
{
    private string $basePath;

    public function __construct(
        PdfProcessorService $pdfProcessor,
        ImageProcessorService $imageProcessor
    ) {
        parent::__construct($pdfProcessor, $imageProcessor);
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

    public function storePdf(UploadedFileInterface $file, string $path): string
    {
        $relativePath = ltrim($path, '/');
        $dir = $this->basePath . '/' . $relativePath;

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $originalName = $file->getClientFilename();
        $filename = $this->generateFilename($originalName);
        $destination = $dir . '/' . $filename;

        $this->withProcessedPdf($file, function (string $tmpOutput) use ($destination) {
            copy($tmpOutput, $destination);
        });

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

    public function storeImageAsAvif(
        UploadedFileInterface $file,
        string $path,
        int $width = 1200,
        int $height = 675
    ): string {
        $relativePath = ltrim($path, '/');
        $dir = $this->basePath . '/' . $relativePath;

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $originalName = $file->getClientFilename();
        $filename = $this->generateFilename($originalName);
        $filename = pathinfo($filename, PATHINFO_FILENAME) . '.avif';
        $destination = $dir . '/' . $filename;

        $this->withProcessedImageAsAvif($file, $width, $height, function (string $tmpOutput) use ($destination) {
            copy($tmpOutput, $destination);
        });

        return $relativePath . '/' . $filename;
    }

    public function getStream(string $path)
    {
        $fullPath = $this->basePath . '/' . ltrim($path, '/');
        if (!file_exists($fullPath)) {
            return null;
        }
        return fopen($fullPath, 'r');
    }

    public function getMimeType(string $path): ?string
    {
        $fullPath = $this->basePath . '/' . ltrim($path, '/');
        if (!file_exists($fullPath)) {
            return null;
        }
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        return $finfo->file($fullPath);
    }

    public function getFileSize(string $path): ?int
    {
        $fullPath = $this->basePath . '/' . ltrim($path, '/');
        if (!file_exists($fullPath)) {
            return null;
        }
        return (int) filesize($fullPath);
    }
}
