<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Brand\BrandNotFoundException;
use App\Domain\Brand\BrandRepositoryInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class UpdateMaterialAction extends Action
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
        $organizationId = (int) $authUser['organization_id'];
        $materialId = (int) $this->resolveArg('id');

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

        // Scoped to organization
        $material = $this->materialRepository->findByOrganizationAndId($organizationId, $materialId);

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
            $brandId = (int) $data['brand_id'];

            try {
                $brand = $this->brandRepository->findById($brandId);
            } catch (BrandNotFoundException $e) {
                return $this->respondWithData(['error' => 'Brand not found'], 404);
            }

            if ($brand->getOrganizationId() !== $organizationId) {
                return $this->respondWithData(['error' => 'Brand does not belong to your organization'], 403);
            }

            $updateData['brand_id'] = $brandId;
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

        // Handle cover image
        if (!empty($uploadedFiles['cover_image'])) {
            $coverFile = $uploadedFiles['cover_image'];
            if ($coverFile->getError() === UPLOAD_ERR_OK) {
                $type = $coverFile->getClientMediaType();
                if (str_starts_with($type, 'image/')) {
                    if ($material->getCoverPath()) {
                        $this->storageService->delete($material->getCoverPath());
                    }

                    $path = $material->getManagerId() . '/materialsCover/' . date('Y-m');
                    $updateData['cover_path'] = $this->storageService->storeImageAsAvif($coverFile, $path);
                }
            }
        }

        // Handle PDF file
        if (!empty($uploadedFiles['file'])) {
            $file = $uploadedFiles['file'];
            if ($file->getError() === UPLOAD_ERR_OK && $material->isPdf()) {
                if ($material->getStoragePath()) {
                    $this->storageService->delete($material->getStoragePath());
                }
                $path = $material->getManagerId() . '/materials/' . date('Y-m');
                $updateData['storage_path'] = $this->storageService->storePdf($file, $path);
            }
        }

        if (empty($updateData)) {
            return $this->respondWithData(['error' => 'No valid fields to update'], 422);
        }

        $this->materialRepository->update($materialId, $updateData);

        $updatedMaterial = $this->materialRepository->findByOrganizationAndId($organizationId, $materialId);

        if ($updatedMaterial->getCoverPath()) {
            $updatedMaterial->setCoverUrl($this->storageService->getUrl($updatedMaterial->getCoverPath()));
        }

        return $this->respondWithData($updatedMaterial);
    }
}
