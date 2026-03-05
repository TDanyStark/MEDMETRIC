<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\Brand;

use App\Application\Actions\Action;
use App\Domain\Brand\BrandRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class UpdateBrandAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private BrandRepositoryInterface $brandRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $brandId = (int) $this->resolveArg('id');
        $data = $this->getFormData();

        if (empty($data)) {
            return $this->respondWithData(['error' => 'No data provided'], 422);
        }

        // Check for name uniqueness if name is being updated
        if (isset($data['name'])) {
            $brand = $this->brandRepository->findById($brandId);
            $name = trim($data['name']);
            
            if ($this->brandRepository->existsInOrganization($brand->getOrganizationId(), $name, $brandId)) {
                return $this->respondWithData(['error' => 'A brand with this name already exists in this organization'], 422);
            }
            
            $data['name'] = $name;
        }

        $updatedBrand = $this->brandRepository->update($brandId, $data);

        return $this->respondWithData($updatedBrand);
    }
}
