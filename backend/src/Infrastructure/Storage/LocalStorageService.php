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

    /**
     * Store the PDF as-is (no synchronous GhostScript compression).
     * See S3StorageService::storePdf() for why this was removed from the
     * synchronous request path.
     */
    public function storePdf(UploadedFileInterface $file, string $path): string
    {
        return $this->store($file, $path);
    }

    /**
     * Upload the PDF as-is (same as storePdf()) but keep the local temp
     * file around and return it, so a background step can compress it
     * later via compressAndReplacePdf() without blocking the response.
     */
    public function storePdfDeferred(UploadedFileInterface $file, string $path): array
    {
        $relativePath = ltrim($path, '/');
        $dir = $this->basePath . '/' . $relativePath;

        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $originalName = $file->getClientFilename();
        $filename = $this->generateFilename($originalName);
        $destination = $dir . '/' . $filename;

        $tmpPath = $this->moveToTemp($file);
        copy($tmpPath, $destination);

        return ['key' => $relativePath . '/' . $filename, 'tmpPath' => $tmpPath, 'originalFilename' => $originalName];
    }

    /**
     * Compress $tmpPath with GhostScript and, if it actually produced a
     * smaller file, store it under a new key. Cleans up all temp files
     * unconditionally. Never deletes $rawKey — the caller does that once
     * it has safely switched over.
     */
    public function compressAndReplacePdf(string $tmpPath, string $rawKey, string $path, ?string $originalFilename): ?string
    {
        if (!file_exists($tmpPath)) {
            return null;
        }

        $tmpOutput = $this->getTempPath('processed_out_', 'pdf');

        try {
            $this->pdfProcessor->process($tmpPath, $tmpOutput);

            if (!file_exists($tmpOutput) || filesize($tmpOutput) === 0 || filesize($tmpOutput) >= filesize($tmpPath)) {
                return null;
            }

            $relativePath = ltrim($path, '/');
            $dir = $this->basePath . '/' . $relativePath;
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            $filename = $this->generateFilename($originalFilename);
            $destination = $dir . '/' . $filename;
            copy($tmpOutput, $destination);

            return $relativePath . '/' . $filename;
        } finally {
            if (file_exists($tmpOutput)) {
                unlink($tmpOutput);
            }
            if (file_exists($tmpPath)) {
                unlink($tmpPath);
            }
        }
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
