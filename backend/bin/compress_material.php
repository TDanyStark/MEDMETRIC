<?php

declare(strict_types=1);

/**
 * CLI entry point run as a detached background process by
 * BackgroundProcessLauncher::launchPdfCompression() right after a material's
 * PDF has been uploaded as-is. Compresses it with GhostScript and, if that
 * produces a smaller file, replaces it in storage and updates the material
 * row — all outside the original HTTP request/response lifecycle, so it
 * never risks a Gateway Timeout.
 *
 * Usage:
 *   php compress_material.php <materialId> <tmpPath> <rawKey> <path> [originalFilename]
 */

use App\Application\Services\Material\DeferredPdfCompressionService;
use DI\ContainerBuilder;
use Dotenv\Dotenv;

require __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

[, $materialId, $tmpPath, $rawKey, $path, $originalFilename] = $argv + [null, null, null, null, null, null];

if ($materialId === null || $tmpPath === null || $rawKey === null || $path === null) {
    fwrite(STDERR, "Usage: compress_material.php <materialId> <tmpPath> <rawKey> <path> [originalFilename]\n");
    exit(1);
}

$containerBuilder = new ContainerBuilder();

(require __DIR__ . '/../app/settings.php')($containerBuilder);
(require __DIR__ . '/../app/dependencies.php')($containerBuilder);
(require __DIR__ . '/../app/repositories.php')($containerBuilder);

$container = $containerBuilder->build();

/** @var DeferredPdfCompressionService $service */
$service = $container->get(DeferredPdfCompressionService::class);

$service->compressAndReplace(
    (int) $materialId,
    $tmpPath,
    $rawKey,
    $path,
    ($originalFilename === null || $originalFilename === '') ? null : $originalFilename
);
