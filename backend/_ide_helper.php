<?php
/**
 * Este archivo es solo para ayudar al autocompletado del IDE.
 * No se incluye en la ejecución real del código ni en producción.
 */

if (!class_exists('Imagick')) {
    class Imagick 
    {
        public const COMPRESSION_JPEG = 6;
        public const RESOLUTION_PIXELSPERINCH = 1;

        public function __construct(string $files = null) {}
        public function readImage(string $filename): bool { return true; }
        public function setImageFormat(string $format): bool { return true; }
        public function setCompressionQuality(int $quality): bool { return true; }
        public function setImageCompressionQuality(int $quality): bool { return true; }
        public function writeImage(string $filename): bool { return true; }
        public function clear(): bool { return true; }
        public function destroy(): bool { return true; }
        public function cropThumbnailImage(int $width, int $height): bool { return true; }
        public function setResolution(float $x, float $y): bool { return true; }
        public function getNumberImages(): int { return 0; }
        public function setIteratorIndex(int $index): bool { return true; }
        public function getImage(): Imagick { return $this; }
        public function setImageBackgroundColor(string $color): bool { return true; }
        public function flattenImages(): Imagick { return $this; }
        public function thumbnailImage(int $width, int $height, bool $bestfit = false, bool $fill = false): bool { return true; }
        public function setImageResolution(float $x, float $y): bool { return true; }
        public function setImageUnits(int $units): bool { return true; }
        public function setCompression(int $compression): bool { return true; }
        public function addImage(Imagick $source): bool { return true; }
        public function writeImages(string $filename, bool $adjoin): bool { return true; }
        public function getImageWidth(): int { return 0; }
        public function getImageHeight(): int { return 0; }
    }
}

if (!class_exists('ImagickException')) {
    class ImagickException extends Exception {}
}
