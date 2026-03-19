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
     * Generate a unique filename while preserving the original name.
     *
     * A short suffix (unix timestamp + 4 random hex bytes) is appended before
     * the extension so that re-uploading the same file always produces a new
     * S3 key.  Without this, CloudFront would serve the old cached object
     * instead of the freshly uploaded one.
     *
     * Example: "report.pdf" → "report_1742398800_a3f9bc12.pdf"
     */
    protected function generateFilename(?string $originalFilename): string
    {
        $unique = time() . '_' . bin2hex(random_bytes(4));

        if (empty($originalFilename)) {
            return $unique . '.bin';
        }

        $base     = basename($originalFilename);
        $ext      = pathinfo($base, PATHINFO_EXTENSION);
        $nameOnly = pathinfo($base, PATHINFO_FILENAME);

        $safeName = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $nameOnly);

        return $safeName . '_' . $unique . ($ext ? '.' . $ext : '');
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
