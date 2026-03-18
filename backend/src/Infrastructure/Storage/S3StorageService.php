<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

use Aws\S3\S3Client;
use Psr\Http\Message\UploadedFileInterface;

/**
 * Stores files in AWS S3 and serves them via CloudFront.
 *
 * Configuration (from $_ENV):
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION,
 *   AWS_BUCKET, CLOUDFRONT_DOMAIN
 */
class S3StorageService extends AbstractStorageService
{
    private S3Client $s3;
    private string $bucket;
    private string $cloudfrontDomain;

    public function __construct(
        PdfProcessorService $pdfProcessor,
        ImageProcessorService $imageProcessor
    ) {
        parent::__construct($pdfProcessor, $imageProcessor);
        $this->bucket = $_ENV['AWS_BUCKET'] ?? '';
        $this->cloudfrontDomain = rtrim($_ENV['CLOUDFRONT_DOMAIN'] ?? '', '/');

        $config = [
            'version' => 'latest',
            'region'  => $_ENV['AWS_REGION'] ?? 'us-east-1',
        ];

        // Only set credentials explicitly if provided (falls back to IAM role / instance profile)
        if (!empty($_ENV['AWS_ACCESS_KEY_ID']) && !empty($_ENV['AWS_SECRET_ACCESS_KEY'])) {
            $config['credentials'] = [
                'key'    => $_ENV['AWS_ACCESS_KEY_ID'],
                'secret' => $_ENV['AWS_SECRET_ACCESS_KEY'],
            ];
        }

        $this->s3 = new S3Client($config);
    }

    /**
     * Upload any file directly to S3 (non-PDF files: images, etc.)
     */
    public function store(UploadedFileInterface $file, string $path): string
    {
        $key = $this->buildKey($path, $file->getClientFilename());

        $this->s3->putObject([
            'Bucket'      => $this->bucket,
            'Key'         => $key,
            'Body'        => $file->getStream(),
            'ContentType' => $file->getClientMediaType() ?? 'application/octet-stream',
        ]);

        return $key;
    }

    /**
     * Process PDF with Imagick (compress + resize) then upload to S3.
     */
    public function storePdf(UploadedFileInterface $file, string $path): string
    {
        return $this->withProcessedPdf($file, function (string $tmpOutput) use ($path, $file) {
            $key = $this->buildKey($path, $file->getClientFilename());

            $this->s3->putObject([
                'Bucket'      => $this->bucket,
                'Key'         => $key,
                'Body'        => fopen($tmpOutput, 'rb'),
                'ContentType' => 'application/pdf',
            ]);

            return $key;
        });
    }

    /**
     * Process image with Imagick, convert to AVIF and upload to S3.
     */
    public function storeImageAsAvif(
        UploadedFileInterface $file,
        string $path,
        int $width  = 1200,
        int $height = 675
    ): string {
        return $this->withProcessedImageAsAvif($file, $width, $height, function (string $tmpOutput) use ($path, $file) {
            $originalName = $file->getClientFilename();
            $basename     = $originalName
                ? pathinfo($originalName, PATHINFO_FILENAME) . '.avif'
                : uniqid('img_', true) . '.avif';

            $key = $this->buildKey($path, $basename);

            $this->s3->putObject([
                'Bucket'      => $this->bucket,
                'Key'         => $key,
                'Body'        => fopen($tmpOutput, 'rb'),
                'ContentType' => 'image/avif',
            ]);

            return $key;
        });
    }

    public function delete(string $path): bool
    {
        try {
            $this->s3->deleteObject([
                'Bucket' => $this->bucket,
                'Key'    => ltrim($path, '/'),
            ]);
            return true;
        } catch (\Exception) {
            return false;
        }
    }

    /**
     * Returns the public CloudFront URL for a given S3 key/path.
     */
    public function getUrl(string $path): string
    {
        return $this->cloudfrontDomain . '/' . ltrim($path, '/');
    }

    public function exists(string $path): bool
    {
        try {
            $this->s3->headObject([
                'Bucket' => $this->bucket,
                'Key'    => ltrim($path, '/'),
            ]);
            return true;
        } catch (\Exception) {
            return false;
        }
    }

    public function getStream(string $path)
    {
        try {
            $result = $this->s3->getObject([
                'Bucket' => $this->bucket,
                'Key'    => ltrim($path, '/'),
            ]);
            return $result['Body']->detach();
        } catch (\Exception) {
            return null;
        }
    }

    public function getMimeType(string $path): ?string
    {
        try {
            $result = $this->s3->headObject([
                'Bucket' => $this->bucket,
                'Key'    => ltrim($path, '/'),
            ]);
            return $result['ContentType'] ?? null;
        } catch (\Exception) {
            return null;
        }
    }

    public function getFileSize(string $path): ?int
    {
        try {
            $result = $this->s3->headObject([
                'Bucket' => $this->bucket,
                'Key'    => ltrim($path, '/'),
            ]);
            return (int) ($result['ContentLength'] ?? 0);
        } catch (\Exception) {
            return null;
        }
    }

    // -------------------------------------------------------------------------

    private function buildKey(string $path, ?string $originalFilename): string
    {
        $relativePath = ltrim($path, '/');
        $filename     = $this->generateFilename($originalFilename);
        return $relativePath . '/' . $filename;
    }
}
