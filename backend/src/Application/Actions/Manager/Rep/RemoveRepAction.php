<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Rep;

use App\Application\Actions\Action;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class RemoveRepAction extends Action
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
        
        $contentType = $this->request->getHeaderLine('Content-Type');
        
        if (str_contains($contentType, 'application/json')) {
            $data = $this->getFormData();
            
            if (!empty($data['rep_ids'])) {
                $repIds = array_map('intval', $data['rep_ids']);
            } elseif (!empty($data['rep_id'])) {
                $repIds = [(int) $data['rep_id']];
            } else {
                $repIds = [(int) $this->resolveArg('repId')];
            }
        } else {
            $repIds = [(int) $this->resolveArg('repId')];
        }

        $removed = [];
        $errors = [];

        foreach ($repIds as $repId) {
            $existing = $this->repAccessRepository->findByManagerAndRep($managerId, $repId);

            if (!$existing) {
                $errors[] = "Rep ID {$repId} is not assigned to this manager";
                continue;
            }

            $this->repAccessRepository->remove($managerId, $repId);
            $removed[] = $repId;
        }

        return $this->respondWithData([
            'removed' => $removed,
            'errors'  => $errors,
        ]);
    }
}
