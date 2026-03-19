<?php

declare(strict_types=1);

namespace App\Infrastructure\Storage;

/**
 * Compresses PDF files using GhostScript when available.
 *
 * WHY IMAGICK IS NOT USED FOR PDFs:
 *   Imagick cannot render PDF pages on its own — it internally shells out to
 *   GhostScript (gs) to rasterise each page. If GhostScript is not installed
 *   on the server (common on shared hosting like Hostinger), Imagick falls back
 *   to a very low-resolution (~25 DPI) built-in parser, producing output like
 *   403×2400px instead of the expected 2420×14000px. This is worse than
 *   uploading the original file unchanged.
 *
 * Processing strategy:
 *   1. GhostScript via exec()  — best quality, keeps vectors/fonts intact,
 *                                  only downsamples embedded raster images.
 *                                  Requires: exec() enabled + gs on PATH.
 *   2. Copy as-is              — 100% original quality, no compression.
 *                                  Used when GhostScript is unavailable.
 */
class PdfProcessorService
{
    /** GhostScript PDFSETTINGS preset (/ebook = 150 dpi, ideal for tablets/mobile). */
    private const GS_PRESET = '/ebook';

    /**
     * Processes a PDF file at $sourcePath and writes the result to $outputPath.
     *
     * @throws \RuntimeException When the fallback copy also fails.
     */
    public function process(string $sourcePath, string $outputPath): void
    {
        // 1. Try GhostScript compression (requires exec() + gs binary)
        if ($this->isExecAvailable() && $this->tryGhostScript($sourcePath, $outputPath)) {
            return;
        }

        // 2. Fallback: copy original at full quality (no degradation)
        if (!copy($sourcePath, $outputPath)) {
            throw new \RuntimeException(
                "PdfProcessorService: could not write PDF to {$outputPath}"
            );
        }
    }

    // -------------------------------------------------------------------------

    private function tryGhostScript(string $sourcePath, string $outputPath): bool
    {
        $gs = $this->findGhostScriptBinary();
        if ($gs === null) {
            return false;
        }

        $cmd = implode(' ', [
            escapeshellarg($gs),
            '-q',
            '-dBATCH',
            '-dNOPAUSE',
            '-dSAFER',
            '-sDEVICE=pdfwrite',
            '-dPDFSETTINGS=' . self::GS_PRESET,
            '-dCompatibilityLevel=1.5',
            '-dCompressFonts=true',
            '-dSubsetFonts=true',
            // Color images — downsample to 150 DPI (standard for /ebook)
            '-dColorImageDownsampleType=/Bicubic',
            '-dColorImageResolution=150',
            '-dAutoFilterColorImages=true', // Let GS decide the best filter
            // Grayscale images
            '-dGrayImageDownsampleType=/Bicubic',
            '-dGrayImageResolution=150',
            '-dAutoFilterGrayImages=true',
            // Monochrome / line art — keep at 600 for crisp text
            '-dMonoImageDownsampleType=/Subsample',
            '-dMonoImageResolution=600',
            '-sOutputFile=' . escapeshellarg($outputPath),
            escapeshellarg($sourcePath),
        ]);

        exec($cmd . ' 2>&1', $out, $exitCode);

        if ($exitCode !== 0 || !file_exists($outputPath) || filesize($outputPath) === 0) {
            if (file_exists($outputPath)) {
                unlink($outputPath);
            }
            return false;
        }

        return true;
    }

    private function findGhostScriptBinary(): ?string
    {
        // Common names used on different OS
        $names = ['gs', 'gswin64c', 'gswin32c'];

        // Try PATH lookup first (works most of the time)
        foreach ($names as $bin) {
            $whereCmd = (PHP_OS_FAMILY === 'Windows') ? "where {$bin}" : "which {$bin}";
            exec($whereCmd . ' 2>&1', $out, $code);
            if ($code === 0 && !empty($out[0])) {
                return trim($out[0]);
            }
            $out = [];
        }

        // Fallback: probe common absolute paths (Hostinger / cPanel shared hosts
        // sometimes install gs outside the web user's PATH)
        $absolutePaths = [
            '/usr/bin/gs',
            '/usr/local/bin/gs',
            '/usr/bin/ghostscript',
            '/usr/local/bin/ghostscript',
            '/opt/remi/php74/root/usr/bin/gs',
            '/opt/cpanel/ea-php80/root/usr/bin/gs',
        ];

        foreach ($absolutePaths as $path) {
            if (is_executable($path)) {
                return $path;
            }
        }

        return null;
    }

    private function isExecAvailable(): bool
    {
        if (!function_exists('exec')) {
            return false;
        }
        $disabled = array_map('trim', explode(',', ini_get('disable_functions')));
        return !in_array('exec', $disabled, true);
    }
}

