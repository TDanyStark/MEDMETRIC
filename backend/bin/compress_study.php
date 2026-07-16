<?php

declare(strict_types=1);

/**
 * CLI entry point run as a detached background process by
 * BackgroundProcessLauncher::launchStudyCompression() right after a study's
 * PDF has been uploaded as-is. Compresses it with GhostScript and, if that
 * produces a smaller file, replaces it in storage and updates the study
 * row — all outside the original HTTP request/response lifecycle, so it
 * never risks a Gateway Timeout.
 *
 * Copy of bin/compress_material.php, wired to DeferredStudyCompressionService
 * instead of DeferredPdfCompressionService.
 *
 * Usage:
 *   php compress_study.php <studyId> <tmpPath> <rawKey> <path> [originalFilename]
 */

use App\Application\Services\MaterialStudy\DeferredStudyCompressionService;
use DI\ContainerBuilder;
use Dotenv\Dotenv;

require __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

[, $studyId, $tmpPath, $rawKey, $path, $originalFilename] = $argv + [null, null, null, null, null, null];

if ($studyId === null || $tmpPath === null || $rawKey === null || $path === null) {
    fwrite(STDERR, "Usage: compress_study.php <studyId> <tmpPath> <rawKey> <path> [originalFilename]\n");
    exit(1);
}

$containerBuilder = new ContainerBuilder();

(require __DIR__ . '/../app/settings.php')($containerBuilder);
(require __DIR__ . '/../app/dependencies.php')($containerBuilder);
(require __DIR__ . '/../app/repositories.php')($containerBuilder);

$container = $containerBuilder->build();

/** @var DeferredStudyCompressionService $service */
$service = $container->get(DeferredStudyCompressionService::class);

$service->compressAndReplace(
    (int) $studyId,
    $tmpPath,
    $rawKey,
    $path,
    ($originalFilename === null || $originalFilename === '') ? null : $originalFilename
);
