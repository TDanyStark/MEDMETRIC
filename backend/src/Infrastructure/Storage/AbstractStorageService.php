<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

use App\Application\Services\Storage\StorageServiceInterface;
use Psr\Http\Message\UploadedFileInterface;

abstract class AbstractStorageService implements StorageServiceInterface
{
    public function __construct(
        protected PdfProcessorService $pdfProcessor,
        protected ImageProcessorService $imageProcessor
    ) {
    }

    /**
     * Generate a filename while preserving the original name if possible.
     */
    protected function generateFilename(?string $originalFilename): string
    {
        if (empty($originalFilename)) {
            return bin2hex(random_bytes(16)) . '.bin';
        }

        // Sanitize the filename to be safe for file systems and cloud storage
        // Keep the original name as per user request
        return preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $originalFilename);
    }

    /**
     * Get a temporary file path.
     */
    protected function getTempPath(string $prefix, string $extension = ''): string
    {
        return sys_get_temp_dir() . '/' . uniqid($prefix, true) . ($extension ? '.' . ltrim($extension, '.') : '');
    }

    /**
     * Helper to wrap a processing step with temporary files.
     */
    protected function withProcessed(
        UploadedFileInterface $file,
        string $outputExtension,
        callable $processor,
        callable $finalAction
    ): mixed {
        return $this->withTemporaryFile($file, function (string $tmpInput) use ($outputExtension, $processor, $finalAction) {
            $tmpOutput = $this->getTempPath('processed_out_', $outputExtension);
            try {
                $processor($tmpInput, $tmpOutput);
                return $finalAction($tmpOutput);
            } finally {
                if (file_exists($tmpOutput)) {
                    unlink($tmpOutput);
                }
            }
        });
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
        return $this->withProcessed(
            $file,
            'pdf',
            fn(string $src, string $dst) => $this->pdfProcessor->process($src, $dst),
            $callback
        );
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
        return $this->withProcessed(
            $file,
            'avif',
            fn(string $src, string $dst) => $this->imageProcessor->processToAvif($src, $dst, $width, $height),
            $callback
        );
    }
}
