<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Rep;

use App\Application\Actions\Action;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class AssignRepAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private RepAccessRepositoryInterface $repAccessRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        $organizationId = (int) $authUser['organization_id'];

        $data = $this->getFormData();

        if (empty($data['rep_ids']) && empty($data['rep_id'])) {
            return $this->respondWithData(['error' => 'rep_id or rep_ids is required'], 422);
        }

        $repIds = $data['rep_ids'] ?? [$data['rep_id']];
        
        if (!is_array($repIds)) {
            return $this->respondWithData(['error' => 'rep_ids must be an array'], 422);
        }

        $availableReps = $this->repAccessRepository->getAvailableRepsForManager($managerId, $organizationId);
        $availableRepIds = array_column($availableReps, 'id');

        $assigned = [];
        $errors = [];

        foreach ($repIds as $repId) {
            $repIdInt = (int) $repId;
            
            if (!in_array($repIdInt, $availableRepIds)) {
                $errors[] = "Rep ID {$repIdInt} is not available for assignment";
                continue;
            }

            $repAccess = $this->repAccessRepository->assign($managerId, $repIdInt);
            $assigned[] = $repAccess;
        }

        return $this->respondWithData([
            'assigned' => $assigned,
            'errors'   => $errors,
        ], empty($assigned) ? 422 : 201);
    }
}
