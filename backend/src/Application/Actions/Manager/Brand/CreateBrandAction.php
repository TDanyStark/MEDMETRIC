<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Brand;

use App\Application\Actions\Action;
use App\Domain\Brand\BrandRepositoryInterface;
use App\Domain\Organization\OrganizationRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class CreateBrandAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private BrandRepositoryInterface $brandRepository,
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        $organizationId = (int) $authUser['organization_id'];

        $data = $this->getFormData();

        if (empty($data['name'])) {
            return $this->respondWithData(['error' => 'Brand name is required'], 422);
        }

        $brand = $this->brandRepository->create(
            $organizationId,
            $managerId,
            $data['name'],
            $data['description'] ?? null
        );

        return $this->respondWithData($brand, 201);
    }
}
