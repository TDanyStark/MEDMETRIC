<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\AdminUser\AdminUserRepositoryInterface;
use App\Domain\Brand\BrandNotFoundException;
use App\Domain\Brand\BrandRepositoryInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class CreateMaterialAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialRepositoryInterface $materialRepository,
        private BrandRepositoryInterface $brandRepository,
        private AdminUserRepositoryInterface $adminUserRepository,
        private StorageServiceInterface $storageService
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
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

        $brandId = (int) $data['brand_id'];

        // Validate brand belongs to the org-admin's organization
        try {
            $brand = $this->brandRepository->findById($brandId);
        } catch (BrandNotFoundException $e) {
            return $this->respondWithData(['error' => 'Brand not found'], 404);
        }

        if ($brand->getOrganizationId() !== $organizationId) {
            return $this->respondWithData(['error' => 'Brand does not belong to your organization'], 403);
        }

        // Resolve the owning manager for this material.
        $managerId = $this->resolveManagerId($brandId, $organizationId, $data);
        if ($managerId instanceof Response) {
            return $managerId; // error response
        }

        $materialData = [
            'organization_id' => $organizationId,
            'brand_id'        => $brandId,
            'manager_id'      => $managerId,
            'title'           => $data['title'],
            'description'     => $data['description'] ?? null,
            'cover_path'      => null,
            'type'            => $data['type'],
            'status'          => 'draft',
            'storage_driver'  => $_ENV['STORAGE_DRIVER'] ?? 'local',
            'storage_path'    => null,
            'external_url'    => null,
        ];

        $uploadedFiles = $this->request->getUploadedFiles();

        // Handle cover image if provided
        if (!empty($uploadedFiles['cover_image'])) {
            $coverFile = $uploadedFiles['cover_image'];
            if ($coverFile->getError() === UPLOAD_ERR_OK) {
                $type = $coverFile->getClientMediaType();
                if (str_starts_with($type, 'image/')) {
                    $path = $managerId . '/materialsCover/' . date('Y-m');
                    $materialData['cover_path'] = $this->storageService->storeImageAsAvif($coverFile, $path);
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
            $materialData['storage_path'] = $this->storageService->storePdf($file, $path);
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

        // Reload with brand/manager names for a richer response
        $material = $this->materialRepository->findByOrganizationAndId($organizationId, $material->getId());
        if ($material->getCoverPath()) {
            $material->setCoverUrl($this->storageService->getUrl($material->getCoverPath()));
        }

        return $this->respondWithData($material, 201);
    }

    /**
     * Resolve the manager that owns this material based on the brand's assigned managers.
     *
     * Rules:
     *  - Brand has exactly 1 active manager  -> auto-assign that manager.
     *  - Brand has several active managers   -> require `manager_id` in the payload (must belong to that brand).
     *  - Brand has NO active manager         -> require `manager_id` (must be a manager of the organization);
     *                                           syncing the brand to that manager via manager_brands.
     *
     * @return int|Response Returns the resolved manager id, or an error Response.
     */
    private function resolveManagerId(int $brandId, int $organizationId, array $data)
    {
        $brandManagerIds = $this->brandRepository->getActiveManagerIdsByBrand($brandId);

        // Case 1: exactly one manager -> auto-assign
        if (count($brandManagerIds) === 1) {
            return $brandManagerIds[0];
        }

        $requestedManagerId = isset($data['manager_id']) && $data['manager_id'] !== ''
            ? (int) $data['manager_id']
            : null;

        // Case 2: several managers -> must pick one of them
        if (count($brandManagerIds) > 1) {
            if ($requestedManagerId === null) {
                return $this->respondWithData(
                    ['error' => 'This brand has multiple managers. Please select a manager (manager_id) for the material.'],
                    422
                );
            }

            if (!in_array($requestedManagerId, $brandManagerIds, true)) {
                return $this->respondWithData(
                    ['error' => 'The selected manager is not assigned to this brand'],
                    422
                );
            }

            return $requestedManagerId;
        }

        // Case 3: no managers -> sync the brand to the chosen organization manager
        if ($requestedManagerId === null) {
            return $this->respondWithData(
                ['error' => 'This brand has no manager assigned. Please select a manager (manager_id) to link the brand with this first material.'],
                422
            );
        }

        $orgManagers = $this->adminUserRepository->findManagersByOrganization($organizationId);
        $orgManagerIds = array_map(fn($m) => $m->getId(), $orgManagers);

        if (!in_array($requestedManagerId, $orgManagerIds, true)) {
            return $this->respondWithData(
                ['error' => 'The selected manager does not belong to your organization'],
                422
            );
        }

        // Sync brand <-> manager (idempotent; reactivates if previously inactive)
        $this->brandRepository->assignToManager($requestedManagerId, $brandId);

        return $requestedManagerId;
    }
}
