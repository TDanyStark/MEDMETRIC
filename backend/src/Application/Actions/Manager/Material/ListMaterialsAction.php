<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Material;

use App\Application\Actions\Action;
use App\Domain\Material\MaterialRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListMaterialsAction extends Action
{
    private MaterialRepositoryInterface $materialRepository;

    public function __construct(LoggerInterface $logger, MaterialRepositoryInterface $materialRepository)
    {
        parent::__construct($logger);
        $this->materialRepository = $materialRepository;
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        
        $params = $this->request->getQueryParams();
        $search = $params['q'] ?? null;
        $status = $params['status'] ?? null;
        $type = $params['type'] ?? null;
        $page = (int) ($params['page'] ?? 1);

        $result = $this->materialRepository->findAllByManager($managerId, $search, $status, $type, $page);

        return $this->respondWithData($result);
    }
}
