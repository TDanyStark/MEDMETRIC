<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\Brand;

use App\Application\Actions\Action;
use App\Domain\Brand\BrandRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class AssignBrandsToManagerAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private BrandRepositoryInterface $brandRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $managerId = (int) $this->resolveArg('managerId');
        $data = $this->getFormData();

        if (empty($data['brand_ids']) && empty($data['brand_id'])) {
            return $this->respondWithData(['error' => 'brand_id or brand_ids is required'], 422);
        }

        $brandIds = $data['brand_ids'] ?? [$data['brand_id']];
        
        if (!is_array($brandIds)) {
            return $this->respondWithData(['error' => 'brand_ids must be an array'], 422);
        }

        $assigned = [];
        $errors = [];

        foreach ($brandIds as $brandId) {
            $brandIdInt = (int) $brandId;
            
            try {
                // Verify brand exists
                $this->brandRepository->findById($brandIdInt);
                
                $this->brandRepository->assignToManager($managerId, $brandIdInt);
                $assigned[] = $brandIdInt;
            } catch (\Exception $e) {
                $errors[] = "Brand ID {$brandIdInt}: " . $e->getMessage();
            }
        }

        return $this->respondWithData([
            'assigned' => $assigned,
            'errors'   => $errors,
        ], empty($assigned) ? 422 : 200);
    }
}
