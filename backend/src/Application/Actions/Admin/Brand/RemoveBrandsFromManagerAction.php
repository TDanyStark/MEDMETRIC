<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\Brand;

use App\Application\Actions\Action;
use App\Domain\Brand\BrandRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class RemoveBrandsFromManagerAction extends Action
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

        $removed = [];
        $errors = [];

        foreach ($brandIds as $brandId) {
            $brandIdInt = (int) $brandId;
            
            try {
                $this->brandRepository->removeFromManager($managerId, $brandIdInt);
                $removed[] = $brandIdInt;
            } catch (\Exception $e) {
                $errors[] = "Brand ID {$brandIdInt}: " . $e->getMessage();
            }
        }

        return $this->respondWithData([
            'removed' => $removed,
            'errors'  => $errors,
        ]);
    }
}
