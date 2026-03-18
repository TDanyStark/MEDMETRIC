<?php

declare(strict_types=1);

namespace App\Application\Services\Storage;

use Psr\Http\Message\UploadedFileInterface;

class LocalStorageService extends AbstractStorageService
{
    private string $basePath;

    public function __construct(PdfProcessorService $pdfProcessor)
    {
        parent::__construct($pdfProcessor);
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

        $filename = $this->generateFilename($file->getClientFilename());
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

        $filename = $this->generateFilename($file->getClientFilename());
        $filename = pathinfo($filename, PATHINFO_FILENAME) . '.avif';
        $destination = $dir . '/' . $filename;

        $this->withProcessedImageAsAvif($file, $width, $height, function (string $tmpOutput) use ($destination) {
            copy($tmpOutput, $destination);
        });

        return $relativePath . '/' . $filename;
    }
}
