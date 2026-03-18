<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class UpdateMaterialAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialRepositoryInterface $materialRepository,
        private StorageServiceInterface $storageService
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        $materialId = (int) $this->resolveArg('id');

        $contentType = $this->request->getHeaderLine('Content-Type');
        
        if (str_contains($contentType, 'application/json')) {
            $data = $this->request->getParsedBody();
        } else {
            $data = $_POST;
        }

        if (empty($data)) {
            return $this->respondWithData(['error' => 'No data provided'], 422);
        }

        $material = $this->materialRepository->findByManagerAndId($managerId, $materialId);

        if ($material->isApproved()) {
            return $this->respondWithData(['error' => 'Cannot edit an approved material'], 422);
        }

        $updateData = [];

        if (isset($data['title'])) {
            $updateData['title'] = $data['title'];
        }

        if (isset($data['description'])) {
            $updateData['description'] = $data['description'];
        }

        if (isset($data['brand_id'])) {
            $updateData['brand_id'] = (int) $data['brand_id'];
        }

        if (isset($data['external_url'])) {
            $updateData['external_url'] = $data['external_url'];
        }

        if (isset($data['type'])) {
            $updateData['type'] = $data['type'];
        }

        if (isset($data['status'])) {
            $updateData['status'] = $data['status'];
        }

        $uploadedFiles = $this->request->getUploadedFiles();

        // Handle cover image
        if (!empty($uploadedFiles['cover_image'])) {
            $coverFile = $uploadedFiles['cover_image'];
            if ($coverFile->getError() === UPLOAD_ERR_OK) {
                $type = $coverFile->getClientMediaType();
                if (str_starts_with($type, 'image/')) {
                    // Delete old cover if exists
                    if ($material->getCoverPath()) {
                        $this->storageService->delete($material->getCoverPath());
                    }
                    
                    $path = $managerId . '/materialsCover/' . date('Y-m');
                    $updateData['cover_path'] = $this->storageService->storeImageAsAvif($coverFile, $path);
                }
            }
        }

        // Handle PDF file
        if (!empty($uploadedFiles['file'])) {
            $file = $uploadedFiles['file'];
            if ($file->getError() === UPLOAD_ERR_OK && $material->isPdf()) {
                $path = $managerId . '/materials/' . date('Y-m');
                $updateData['storage_path'] = $this->storageService->storePdf($file, $path);
            }
        }

        if (empty($updateData)) {
            return $this->respondWithData(['error' => 'No valid fields to update'], 422);
        }

        $updatedMaterial = $this->materialRepository->update($materialId, $updateData);

        return $this->respondWithData($updatedMaterial);
    }
}
