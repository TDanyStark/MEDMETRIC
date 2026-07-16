<?php

declare(strict_types=1);

namespace App\Application\Services\MaterialStudy;

use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Runs GhostScript PDF compression AFTER a study has already been
 * created/updated and the HTTP response already sent to the client (see
 * BackgroundProcessLauncher::launchStudyCompression() and
 * bin/compress_study.php). If compression produces a smaller file, swaps
 * the study's storage_path to the compressed key and deletes the heavier
 * original from storage.
 *
 * Direct copy of DeferredPdfCompressionService, retyped against
 * MaterialStudyRepositoryInterface / material_studies columns. Kept as an
 * isolated duplicate rather than made polymorphic — see design.md decision
 * table ("Compression pipeline").
 *
 * Shared by both the OrgAdmin and Manager Create/Update study Actions so
 * this orchestration isn't duplicated per role.
 */
class DeferredStudyCompressionService
{
    public function __construct(
        private StorageServiceInterface $storageService,
        private MaterialStudyRepositoryInterface $materialStudyRepository,
        private LoggerInterface $logger
    ) {
    }

    public function compressAndReplace(
        int $studyId,
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
                $this->markStatus($studyId, 'skipped', null, $checkedAt);
                return;
            }

            // Guard against a race where the study's file was replaced
            // again (e.g. a newer edit) while this background compression
            // was still running — don't clobber that newer file, and leave
            // its (newer) status alone.
            $study = $this->materialStudyRepository->findById($studyId);
            if ($study->getStoragePath() !== $rawKey) {
                $this->storageService->delete($compressedKey);
                return;
            }

            $this->materialStudyRepository->update($studyId, ['storage_path' => $compressedKey]);
            $this->storageService->delete($rawKey);
            $this->markStatus($studyId, 'compressed', null, $checkedAt);

            $this->logger->info('Study PDF compressed in background', [
                'study_id'       => $studyId,
                'raw_key'        => $rawKey,
                'compressed_key' => $compressedKey,
            ]);
        } catch (Throwable $e) {
            $this->markStatus($studyId, 'failed', substr($e->getMessage(), 0, 255), $checkedAt);

            $this->logger->error('Background study PDF compression failed', [
                'study_id' => $studyId,
                'error'    => $e->getMessage(),
            ]);
        }
    }

    /**
     * Best-effort status write — if even this fails (e.g. DB unreachable),
     * there's nothing more we can do from a detached background process, so
     * swallow it silently rather than crash.
     */
    private function markStatus(int $studyId, string $status, ?string $error, string $checkedAt): void
    {
        try {
            $this->materialStudyRepository->update($studyId, [
                'pdf_compression_status'     => $status,
                'pdf_compression_error'      => $error,
                'pdf_compression_checked_at' => $checkedAt,
            ]);
        } catch (Throwable) {
            // Nothing left to do — no one is listening for this response.
        }
    }
}
