<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Rep;

use App\Application\Actions\Action;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class GetAvailableRepsAction extends Action
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
        
        $params = $this->request->getQueryParams();
        $search = $params['q'] ?? null;

        $reps = $this->repAccessRepository->getAvailableRepsForManager($managerId, $organizationId, $search);

        return $this->respondWithData($reps);
    }
}
