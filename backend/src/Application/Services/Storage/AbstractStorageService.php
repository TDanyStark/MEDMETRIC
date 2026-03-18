<?php

declare(strict_types=1);

namespace App\Application\Services\Storage;

use Psr\Http\Message\UploadedFileInterface;

abstract class AbstractStorageService implements StorageServiceInterface
{
    public function __construct(protected PdfProcessorService $pdfProcessor)
    {
    }

    /**
     * Generate a unique filename while preserving the original extension.
     */
    protected function generateFilename(?string $originalFilename): string
    {
        $extension = $originalFilename ? pathinfo($originalFilename, PATHINFO_EXTENSION) : 'bin';
        return bin2hex(random_bytes(16)) . '.' . $extension;
    }

    /**
     * Get a temporary file path.
     */
    protected function getTempPath(string $prefix, string $extension = ''): string
    {
        return sys_get_temp_dir() . '/' . uniqid($prefix, true) . ($extension ? '.' . ltrim($extension, '.') : '');
    }

    /**
     * Execute a callback with a temporary file created from the uploaded file.
     * The temporary file is automatically deleted after the callback finishes.
     */
    protected function withTemporaryFile(UploadedFileInterface $file, callable $callback): mixed
    {
        $tmpPath = $this->getTempPath('storage_in_');
        $file->moveTo($tmpPath);

        try {
            return $callback($tmpPath);
        } finally {
            if (file_exists($tmpPath)) {
                unlink($tmpPath);
            }
        }
    }

    /**
     * Execute a callback with a processed PDF (compressed/resized).
     * The temporary files are automatically deleted after the callback finishes.
     */
    protected function withProcessedPdf(UploadedFileInterface $file, callable $callback): mixed
    {
        return $this->withTemporaryFile($file, function (string $tmpInput) use ($callback) {
            $tmpOutput = $this->getTempPath('pdf_out_', 'pdf');
            try {
                $this->pdfProcessor->process($tmpInput, $tmpOutput);
                return $callback($tmpOutput);
            } finally {
                if (file_exists($tmpOutput)) {
                    unlink($tmpOutput);
                }
            }
        });
    }

    /**
     * Execute a callback with a processed image converted to AVIF.
     * The temporary files are automatically deleted after the callback finishes.
     */
    protected function withProcessedImageAsAvif(
        UploadedFileInterface $file,
        int $width,
        int $height,
        callable $callback
    ): mixed {
        return $this->withTemporaryFile($file, function (string $tmpInput) use ($callback, $width, $height) {
            $tmpOutput = $this->getTempPath('img_out_', 'avif');
            try {
                $imagick = new \Imagick($tmpInput);
                $imagick->cropThumbnailImage($width, $height);
                $imagick->setImageFormat('avif');
                $imagick->setCompressionQuality(60);
                $imagick->writeImage($tmpOutput);
                $imagick->clear();
                $imagick->destroy();

                return $callback($tmpOutput);
            } finally {
                if (file_exists($tmpOutput)) {
                    unlink($tmpOutput);
                }
            }
        });
    }
}
