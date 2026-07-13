<?php

declare(strict_types=1);

namespace App\Application\Services\Material;

use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Runs GhostScript PDF compression AFTER the material has already been
 * created/updated and the HTTP response already sent to the client (see
 * BackgroundProcessLauncher and bin/compress_material.php). If compression
 * produces a smaller file, swaps the material's storage_path to the
 * compressed key and deletes the heavier original from storage.
 *
 * Shared by both the OrgAdmin and Manager Create/Update material Actions so
 * this orchestration isn't duplicated per role.
 */
class DeferredPdfCompressionService
{
    public function __construct(
        private StorageServiceInterface $storageService,
        private MaterialRepositoryInterface $materialRepository,
        private LoggerInterface $logger
    ) {
    }

    public function compressAndReplace(
        int $materialId,
        string $tmpPath,
        string $rawKey,
        string $path,
        ?string $originalFilename
    ): void {
        $checkedAt = (new \DateTimeImmutable())->format('Y-m-d H:i:s');

        try {
            $compressedKey = $this->storageService->compressAndReplacePdf($tmpPath, $rawKey, $path, $originalFilename);

            if ($compressedKey === null) {
                // GhostScript unavailable/failed (falls back to a plain
                // copy) or compression produced no real gain — the raw
                // upload stays as the final file. Not an error, just
                // nothing worth swapping.
                $this->markStatus($materialId, 'skipped', null, $checkedAt);
                return;
            }

            // Guard against a race where the material's file was replaced
            // again (e.g. a newer edit) while this background compression
            // was still running — don't clobber that newer file, and leave
            // its (newer) status alone.
            $material = $this->materialRepository->findById($materialId);
            if ($material->getStoragePath() !== $rawKey) {
                $this->storageService->delete($compressedKey);
                return;
            }

            $this->materialRepository->update($materialId, ['storage_path' => $compressedKey]);
            $this->storageService->delete($rawKey);
            $this->markStatus($materialId, 'compressed', null, $checkedAt);

            $this->logger->info('Material PDF compressed in background', [
                'material_id'    => $materialId,
                'raw_key'        => $rawKey,
                'compressed_key' => $compressedKey,
            ]);
        } catch (Throwable $e) {
            $this->markStatus($materialId, 'failed', substr($e->getMessage(), 0, 255), $checkedAt);

            $this->logger->error('Background PDF compression failed', [
                'material_id' => $materialId,
                'error'       => $e->getMessage(),
            ]);
        }
    }

    /**
     * Best-effort status write — if even this fails (e.g. DB unreachable),
     * there's nothing more we can do from a detached background process, so
     * swallow it silently rather than crash.
     */
    private function markStatus(int $materialId, string $status, ?string $error, string $checkedAt): void
    {
        try {
            $this->materialRepository->update($materialId, [
                'pdf_compression_status'     => $status,
                'pdf_compression_error'      => $error,
                'pdf_compression_checked_at' => $checkedAt,
            ]);
        } catch (Throwable) {
            // Nothing left to do — no one is listening for this response.
        }
    }
}
