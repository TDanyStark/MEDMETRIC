<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Brand;

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
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        $brandId = (int) $this->resolveArg('id');

        $data = $this->getFormData();

        if (empty($data)) {
            return $this->respondWithData(['error' => 'No data provided'], 422);
        }

        $brand = $this->brandRepository->findByManagerAndId($managerId, $brandId);
        $updatedBrand = $this->brandRepository->update($brandId, $data);

        return $this->respondWithData($updatedBrand);
    }
}
