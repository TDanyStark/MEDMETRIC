<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Study;

use App\Application\Actions\Action;
use App\Application\Services\DeferredTasks\BackgroundProcessLauncher;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * PUT /manager/studies/{id}
 *
 * Scoped via findByManagerAndId (manager_brands, active=1) on the parent
 * material — no status filter, meaning it works even when the material is
 * approved.
 *
 * IMPORTANT / INTENTIONAL DEVIATION: unlike Manager\Material\UpdateMaterialAction,
 * which blocks edits once the parent material is approved
 * ($material->isApproved() gate), this action NEVER checks that. Studies
 * have no approval workflow at all (see design.md decision table), so a
 * manager can always edit a study regardless of the parent material's
 * status. Do not add an isApproved() check here even if the material
 * pattern is copied again later.
 */
class UpdateStudyAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialStudyRepositoryInterface $studyRepository,
        private StorageServiceInterface $storageService,
        private BackgroundProcessLauncher $backgroundProcessLauncher
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        $studyId = (int) $this->resolveArg('id');

        $contentType = $this->request->getHeaderLine('Content-Type');

        if (str_contains($contentType, 'application/json')) {
            $data = $this->request->getParsedBody();
        } else {
            $data = $_POST;
        }

        $uploadedFiles = $this->request->getUploadedFiles();

        if (empty($data) && empty($uploadedFiles)) {
            return $this->respondWithData(['error' => 'No data provided'], 422);
        }

        // Throws MaterialStudyNotFoundException -> 404 if outside manager's scope.
        // No isApproved() gate — see class docblock.
        $study = $this->studyRepository->findByManagerAndId($managerId, $studyId);

        $updateData = [];

        if (isset($data['title'])) {
            $updateData['title'] = $data['title'];
        }

        if (isset($data['external_url'])) {
            $updateData['external_url'] = $data['external_url'];
        }

        if (isset($data['type'])) {
            $updateData['type'] = $data['type'];
        }

        // Set when uploading a new PDF, so we can compress it in the
        // background instead of blocking this response.
        $pdfPath = null;
        $pdfUpload = null;
        $previousStoragePath = null;

        // Handle PDF file
        if (!empty($uploadedFiles['file'])) {
            $file = $uploadedFiles['file'];
            if ($file->getError() === UPLOAD_ERR_OK && $study->isPdf()) {
                $previousStoragePath = $study->getStoragePath();
                $pdfPath = $managerId . '/studies/' . date('Y-m');
                $pdfUpload = $this->storageService->storePdfDeferred($file, $pdfPath);
                $updateData['storage_path'] = $pdfUpload['key'];
                $updateData['pdf_compression_status'] = 'pending';
                $updateData['pdf_compression_error'] = null;
            }
        }

        if (empty($updateData)) {
            return $this->respondWithData(['error' => 'No valid fields to update'], 422);
        }

        $updatedStudy = $this->studyRepository->update($studyId, $updateData);

        if ($pdfUpload !== null) {
            $launched = $this->backgroundProcessLauncher->launchStudyCompression(
                $studyId,
                $pdfUpload['tmpPath'],
                $pdfUpload['key'],
                $pdfPath,
                $pdfUpload['originalFilename']
            );

            if (!$launched) {
                $updatedStudy = $this->studyRepository->update($studyId, ['pdf_compression_status' => 'unavailable']);
            }

            // The old file is no longer referenced by this study. It's a
            // simple delete (no compression needed), so it's cheap enough to
            // do inline — no need to background it.
            if ($previousStoragePath !== null) {
                $this->storageService->delete($previousStoragePath);
            }
        }

        return $this->respondWithData($updatedStudy);
    }
}
