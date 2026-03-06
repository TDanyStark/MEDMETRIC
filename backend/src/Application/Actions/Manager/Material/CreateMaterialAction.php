<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Material;

use App\Application\Actions\Action;
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
        private StorageServiceInterface $storageService
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
            'storage_driver' => 'local',
            'storage_path'   => null,
            'external_url'   => null,
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
                    $materialData['cover_path'] = $this->storageService->store($coverFile, $path);
                }
            }
        }

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

            $path = $managerId . '/materials/' . date('Y-m');
            $materialData['storage_path'] = $this->storageService->store($file, $path);
            $materialData['storage_driver'] = 'local';

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

        return $this->respondWithData($material, 201);
    }
}
