<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Study;

use App\Application\Actions\Action;
use App\Application\Services\DeferredTasks\BackgroundProcessLauncher;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * PUT /org-admin/studies/{id}
 *
 * Same shape as OrgAdmin\Material\UpdateMaterialAction but WITHOUT the
 * "cannot edit an approved material" gate — studies have no approval
 * workflow at all (design.md: "No approval workflow on studies, explicit
 * deviation"), so they are always editable by org_admin regardless of the
 * parent material's status.
 */
class UpdateStudyAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialStudyRepositoryInterface $studyRepository,
        private MaterialRepositoryInterface $materialRepository,
        private StorageServiceInterface $storageService,
        private BackgroundProcessLauncher $backgroundProcessLauncher
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $organizationId = (int) $authUser['organization_id'];
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

        // Scoped to organization via the parent material — throws
        // MaterialStudyNotFoundException -> 404 if outside org.
        $study = $this->studyRepository->findByOrganizationAndId($organizationId, $studyId);

        // Needed to build the storage path ({managerId}/studies/{Y-m}); the
        // study entity itself carries no manager_id.
        $material = $this->materialRepository->findById($study->getMaterialId());
        $managerId = $material->getManagerId();

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

        $this->studyRepository->update($studyId, $updateData);

        $updatedStudy = $this->studyRepository->findByOrganizationAndId($organizationId, $studyId);

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
