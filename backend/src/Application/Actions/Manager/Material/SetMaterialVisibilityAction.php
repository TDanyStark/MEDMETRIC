<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Material;

use App\Application\Actions\Action;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class SetMaterialVisibilityAction extends Action
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

        if (!$material->isApproved()) {
            return $this->respondWithData(['error' => 'Solo los materiales aprobados pueden cambiar su visibilidad'], 422);
        }

        $data = $this->getFormData() ?? [];
        $isVisible = (bool) ($data['is_visible'] ?? false);

        $updatedMaterial = $this->materialRepository->setVisibility($materialId, $isVisible);

        return $this->respondWithData($updatedMaterial);
    }
}
