<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Material;

use App\Application\Actions\Action;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ApproveMaterialAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialRepositoryInterface $materialRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        $materialId = (int) $this->resolveArg('id');

        $material = $this->materialRepository->findByManagerAndId($managerId, $materialId);

        if ($material->isApproved()) {
            return $this->respondWithData(['error' => 'Material is already approved'], 422);
        }

        $approvedMaterial = $this->materialRepository->approve($materialId, $managerId);

        return $this->respondWithData($approvedMaterial);
    }
}
