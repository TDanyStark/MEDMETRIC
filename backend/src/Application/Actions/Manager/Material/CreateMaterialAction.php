<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Material;

use App\Application\Actions\Action;
use App\Application\Services\DeferredTasks\BackgroundProcessLauncher;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Brand\BrandRepositoryInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\UploadedFileInterface;
use Psr\Log\LoggerInterface;

class CreateMaterialAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialRepositoryInterface $materialRepository,
        private BrandRepositoryInterface $brandRepository,
        private StorageServiceInterface $storageService,
        private BackgroundProcessLauncher $backgroundProcessLauncher
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        $organizationId = (int) $authUser['organization_id'];

        $contentType = $this->request->getHeaderLine('Content-Type');
        
        if (str_contains($contentType, 'application/json')) {
            $data = $this->request->getParsedBody();
        } else {
            $data = $_POST;
        }

        if (empty($data['title'])) {
            return $this->respondWithData(['error' => 'Title is required'], 422);
        }

        if (empty($data['brand_id'])) {
            return $this->respondWithData(['error' => 'Brand ID is required'], 422);
        }

        if (empty($data['type'])) {
            return $this->respondWithData(['error' => 'Material type is required (pdf, video, link)'], 422);
        }

        // Idempotency: if the client already sent this exact create request
        // before (e.g. it retried after a gateway timeout that actually
        // succeeded on the backend), return the material that was already
        // created instead of creating a duplicate.
        $idempotencyKey = !empty($data['idempotency_key']) ? (string) $data['idempotency_key'] : null;
        if ($idempotencyKey !== null) {
            $existing = $this->materialRepository->findByIdempotencyKey($idempotencyKey);
            if ($existing !== null && $existing->getManagerId() === $managerId) {
                if ($existing->getCoverPath()) {
                    $existing->setCoverUrl($this->storageService->getUrl($existing->getCoverPath()));
                }
                return $this->respondWithData($existing, 201);
            }
        }

        $brand = $this->brandRepository->findByManagerAndId($managerId, (int) $data['brand_id']);

        $materialData = [
            'organization_id' => $organizationId,
            'brand_id'       => (int) $data['brand_id'],
            'manager_id'     => $managerId,
            'title'          => $data['title'],
            'description'    => $data['description'] ?? null,
            'cover_path'     => null,
            'type'           => $data['type'],
            'status'         => 'draft',
            'storage_driver' => $_ENV['STORAGE_DRIVER'] ?? 'local',
            'storage_path'   => null,
            'external_url'   => null,
            'idempotency_key' => $idempotencyKey,
        ];

        $uploadedFiles = $this->request->getUploadedFiles();

        // Handle cover image if provided
        if (!empty($uploadedFiles['cover_image'])) {
            $coverFile = $uploadedFiles['cover_image'];
            if ($coverFile->getError() === UPLOAD_ERR_OK) {
                // Simple check for image
                $type = $coverFile->getClientMediaType();
                if (str_starts_with($type, 'image/')) {
                    $path = $managerId . '/materialsCover/' . date('Y-m');
                    $materialData['cover_path'] = $this->storageService->storeImageAsAvif($coverFile, $path);
                }
            }
        }

        // Set when uploading a PDF, so we can compress it in a detached
        // background process (see BackgroundProcessLauncher below) instead
        // of blocking this response.
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

            $pdfPath = $managerId . '/materials/' . date('Y-m');
            $pdfUpload = $this->storageService->storePdfDeferred($file, $pdfPath);
            $materialData['storage_path'] = $pdfUpload['key'];
            $materialData['pdf_compression_status'] = 'pending';

        } elseif ($data['type'] === 'video') {
            if (empty($data['external_url'])) {
                return $this->respondWithData(['error' => 'Video URL is required'], 422);
            }
            $materialData['external_url'] = $data['external_url'];

        } elseif ($data['type'] === 'link') {
            if (empty($data['external_url'])) {
                return $this->respondWithData(['error' => 'External URL is required'], 422);
            }
            $materialData['external_url'] = $data['external_url'];
        } else {
            return $this->respondWithData(['error' => 'Invalid material type'], 422);
        }

        $material = $this->materialRepository->create($materialData);

        if ($material->getCoverPath()) {
            $material->setCoverUrl($this->storageService->getUrl($material->getCoverPath()));
        }

        if ($pdfUpload !== null) {
            $launched = $this->backgroundProcessLauncher->launchPdfCompression(
                $material->getId(),
                $pdfUpload['tmpPath'],
                $pdfUpload['key'],
                $pdfPath,
                $pdfUpload['originalFilename']
            );

            if (!$launched) {
                $material = $this->materialRepository->update($material->getId(), ['pdf_compression_status' => 'unavailable']);
            }
        }

        return $this->respondWithData($material, 201);
    }
}
