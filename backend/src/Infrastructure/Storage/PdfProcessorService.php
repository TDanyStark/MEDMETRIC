<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

/**
 * Processes PDF files using Imagick to reduce file size.
 * - Rasterizes each page at 264 PPI
 * - Resizes pages to fit within 2420×1668 px (maintaining aspect ratio)
 * - Reassembles and compresses back to PDF
 *
 * Requires: Imagick PHP extension + GhostScript on the server.
 */
class PdfProcessorService
{
    private const MAX_WIDTH  = 2420;
    private const MAX_HEIGHT = 1668;
    private const TARGET_PPI = 264;

    /**
     * Processes a PDF file at $sourcePath and writes the result to $outputPath.
     *
     * @param  string $sourcePath  Absolute path to the original PDF.
     * @param  string $outputPath  Absolute path where the processed PDF will be written.
     * @throws \ImagickException
     */
    public function process(string $sourcePath, string $outputPath): void
    {
        $pdf = new \Imagick();

        // Set resolution BEFORE reading the PDF so GhostScript rasterises at the right PPI
        $pdf->setResolution(self::TARGET_PPI, self::TARGET_PPI);
        $pdf->readImage($sourcePath);

        $pageCount = $pdf->getNumberImages();

        $output = new \Imagick();
        $output->setResolution(self::TARGET_PPI, self::TARGET_PPI);

        for ($i = 0; $i < $pageCount; $i++) {
            $pdf->setIteratorIndex($i);
            $page = $pdf->getImage();

            // Flatten transparent backgrounds (PDFs may have transparency)
            $page->setImageBackgroundColor('white');
            $page->flattenImages();

            // Resize only if the page exceeds the max dimensions (never upscale)
            $w = $page->getImageWidth();
            $h = $page->getImageHeight();

            if ($w > self::MAX_WIDTH || $h > self::MAX_HEIGHT) {
                $page->thumbnailImage(self::MAX_WIDTH, self::MAX_HEIGHT, true, false);
            }

            // Set PPI metadata on each page
            $page->setImageResolution(self::TARGET_PPI, self::TARGET_PPI);
            $page->setImageUnits(\Imagick::RESOLUTION_PIXELSPERINCH);

            // Set PDF format and compression
            $page->setImageFormat('pdf');
            $page->setImageCompressionQuality(85);
            $page->setCompression(\Imagick::COMPRESSION_JPEG);

            $output->addImage($page);
            $page->destroy();
        }

        $pdf->destroy();

        $output->setImageFormat('pdf');
        $output->writeImages($outputPath, true);
        $output->destroy();
    }
}
