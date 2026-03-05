<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Rep;

use App\Application\Actions\Action;
use App\Domain\RepAccess\RepAccessRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListAssignedRepsAction extends Action
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
        
        $params = $this->request->getQueryParams();
        $search = $params['q'] ?? null;
        $active = isset($params['active']) ? filter_var($params['active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) : null;
        $page = (int) ($params['page'] ?? 1);

        $result = $this->repAccessRepository->findAllByManager($managerId, $search, $active, $page);

        return $this->respondWithData($result);
    }
}
