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

        if (!empty($_FILES) && !empty($_FILES['file'])) {
            $file = $_FILES['file'];
            
            if ($file['error'] === UPLOAD_ERR_OK && $material->isPdf()) {
                $path = $managerId . '/materials/' . date('Y-m');
                $updateData['storage_path'] = $this->storageService->store(
                    new class($file) implements \Psr\Http\Message\UploadedFileInterface {
                        private array $file;
                        public function __construct(array $file) { $this->file = $file; }
                        public function getStream(): \Psr\Http\Message\StreamInterface {
                            return new \Slim\Psr7\Stream(fopen($this->file['tmp_name'], 'r'));
                        }
                        public function getClientFilename(): ?string { return $this->file['name']; }
                        public function getClientMediaType(): ?string { return $this->file['type']; }
                        public function getSize(): ?int { return $this->file['size']; }
                        public function moveTo(string $targetPath): void {
                            copy($this->file['tmp_name'], $targetPath);
                            unlink($this->file['tmp_name']);
                        }
                        public function getError(): int { return $this->file['error']; }
                    },
                    $path
                );
            }
        }

        if (empty($updateData)) {
            return $this->respondWithData(['error' => 'No valid fields to update'], 422);
        }

        $updatedMaterial = $this->materialRepository->update($materialId, $updateData);

        return $this->respondWithData($updatedMaterial);
    }
}
