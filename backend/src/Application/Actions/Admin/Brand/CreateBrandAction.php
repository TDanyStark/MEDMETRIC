<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\Brand;

use App\Application\Actions\Action;
use App\Domain\Brand\BrandRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class CreateBrandAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private BrandRepositoryInterface $brandRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $data = $this->getFormData();

        // Get current user from JWT
        $authUser = $this->request->getAttribute('auth_user');
        $isOrgAdmin = $authUser !== null && $authUser['role'] === 'org_admin';

        $organizationId = null;
        
        // If org_admin, use their organization
        if ($isOrgAdmin) {
            $organizationId = $authUser['organization_id'] ?? null;
        } elseif (!empty($data['organization_id'])) {
            $organizationId = (int) $data['organization_id'];
        }

        if (empty($organizationId)) {
            return $this->respondWithData(['error' => 'organization_id is required'], 422);
        }

        if (empty($data['name'])) {
            return $this->respondWithData(['error' => 'Brand name is required'], 422);
        }

        $name = trim($data['name']);

        // Check for duplicates in the same organization
        if ($this->brandRepository->existsInOrganization($organizationId, $name)) {
            return $this->respondWithData(['error' => 'A brand with this name already exists in this organization'], 422);
        }

        $brand = $this->brandRepository->create(
            $organizationId,
            $name,
            $data['description'] ?? null
        );

        return $this->respondWithData($brand, 201);
    }
}
