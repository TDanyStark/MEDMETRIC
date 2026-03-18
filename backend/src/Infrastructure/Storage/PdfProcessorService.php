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
        // Set resolution BEFORE reading the PDF so GhostScript rasterises at the right PPI
        $pdf = new \Imagick();
        $pdf->setResolution(self::TARGET_PPI, self::TARGET_PPI);
        $pdf->readImage($sourcePath);

        $output = new \Imagick();
        $output->setResolution(self::TARGET_PPI, self::TARGET_PPI);

        // Process each page
        $pageCount = $pdf->getNumberImages();
        for ($i = 0; $i < $pageCount; $i++) {
            $pdf->setIteratorIndex($i);
            $page = $pdf->getImage(); // Get a copy of the current page

            // Flatten transparent backgrounds (PDFs may have transparency)
            $page->setImageBackgroundColor('white');
            // Using flattenImages() as it is present in _ide_helper.php
            $flat = $page->flattenImages(); 
            $page->destroy();
            $page = $flat;

            // Determine dimensions and orientation
            $w = $page->getImageWidth();
            $h = $page->getImageHeight();
            
            // Default target is Landscape (2420x1668)
            // If page is Portrait (Height > Width), swap targets (1668x2420)
            $isPortrait = $h > $w;
            $maxWidth  = $isPortrait ? self::MAX_HEIGHT : self::MAX_WIDTH;
            $maxHeight = $isPortrait ? self::MAX_WIDTH : self::MAX_HEIGHT;

            // Resize only if the page exceeds the max dimensions (never upscale)
            if ($w > $maxWidth || $h > $maxHeight) {
                // thumbnailImage with bestfit=true
                $page->thumbnailImage($maxWidth, $maxHeight, true);
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
        // writeImages with adjoin=true (2nd param) ensures all pages are in one PDF
        $output->writeImages($outputPath, true);
        $output->destroy();
    }
}

