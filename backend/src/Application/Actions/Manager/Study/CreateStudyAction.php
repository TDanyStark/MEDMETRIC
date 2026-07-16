<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Study;

use App\Application\Actions\Action;
use App\Application\Services\DeferredTasks\BackgroundProcessLauncher;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * POST /manager/materials/{id}/studies
 *
 * Same as OrgAdmin\Study\CreateStudyAction but scoped via findByManagerAndId
 * on the parent material. Studies have exactly two types (pdf|link) and NO
 * cover_image field.
 */
class CreateStudyAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialRepositoryInterface $materialRepository,
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
        $materialId = (int) $this->resolveArg('id');

        // Throws MaterialNotFoundException -> 404 if outside manager's scope
        $this->materialRepository->findByManagerAndId($managerId, $materialId);

        $contentType = $this->request->getHeaderLine('Content-Type');

        if (str_contains($contentType, 'application/json')) {
            $data = $this->request->getParsedBody();
        } else {
            $data = $_POST;
        }

        if (empty($data['title'])) {
            return $this->respondWithData(['error' => 'Title is required'], 422);
        }

        if (empty($data['type'])) {
            return $this->respondWithData(['error' => 'Study type is required (pdf, link)'], 422);
        }

        $studyData = [
            'material_id'    => $materialId,
            'title'          => $data['title'],
            'type'           => $data['type'],
            'storage_driver' => $_ENV['STORAGE_DRIVER'] ?? 'local',
            'storage_path'   => null,
            'external_url'   => null,
        ];

        $uploadedFiles = $this->request->getUploadedFiles();

        // Set when uploading a PDF, so we can compress it in a detached
        // background process instead of blocking this response.
        $pdfPath = null;
        $pdfUpload = null;

        if ($data['type'] === 'pdf') {
            if (empty($uploadedFiles['file'])) {
                return $this->respondWithData(['error' => 'PDF file is required'], 422);
            }

            $file = $uploadedFiles['file'];
            if ($file->getError() !== UPLOAD_ERR_OK) {
                return $this->respondWithData(['error' => 'File upload error'], 422);
            }

            $allowedMimeTypes = ['application/pdf'];
            if (!in_array($file->getClientMediaType(), $allowedMimeTypes)) {
                return $this->respondWithData(['error' => 'Only PDF files are allowed'], 422);
            }

            $pdfPath = $managerId . '/studies/' . date('Y-m');
            $pdfUpload = $this->storageService->storePdfDeferred($file, $pdfPath);
            $studyData['storage_path'] = $pdfUpload['key'];
            $studyData['pdf_compression_status'] = 'pending';
        } elseif ($data['type'] === 'link') {
            if (empty($data['external_url'])) {
                return $this->respondWithData(['error' => 'External URL is required'], 422);
            }
            $studyData['external_url'] = $data['external_url'];
        } else {
            return $this->respondWithData(['error' => 'Invalid study type'], 422);
        }

        $study = $this->studyRepository->create($studyData);

        if ($pdfUpload !== null) {
            $launched = $this->backgroundProcessLauncher->launchStudyCompression(
                $study->getId(),
                $pdfUpload['tmpPath'],
                $pdfUpload['key'],
                $pdfPath,
                $pdfUpload['originalFilename']
            );

            if (!$launched) {
                $study = $this->studyRepository->update($study->getId(), ['pdf_compression_status' => 'unavailable']);
            }
        }

        return $this->respondWithData($study, 201);
    }
}
