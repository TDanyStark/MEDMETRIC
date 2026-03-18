<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

/**
 * Processes image files using Imagick.
 * - Resizes images to fit within specified dimensions.
 * - Converts images to AVIF format.
 * - Compresses images for web delivery.
 */
class ImageProcessorService
{
    /**
     * Processes an image file at $sourcePath, converts to AVIF, and writes to $outputPath.
     *
     * @param string $sourcePath Absolute path to the original image.
     * @param string $outputPath Absolute path where the processed AVIF will be written.
     * @param int $width Target width.
     * @param int $height Target height.
     * @throws \ImagickException
     */
    public function processToAvif(string $sourcePath, string $outputPath, int $width, int $height): void
    {
        $imagick = new \Imagick($sourcePath);
        
        // Use cropThumbnailImage to maintain aspect ratio while filling the dimensions
        $imagick->cropThumbnailImage($width, $height);
        
        $imagick->setImageFormat('avif');
        $imagick->setCompressionQuality(60);
        
        $imagick->writeImage($outputPath);
        
        $imagick->clear();
        $imagick->destroy();
    }
}
