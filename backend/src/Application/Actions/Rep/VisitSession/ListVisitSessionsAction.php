<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\VisitSession;

use App\Application\Actions\Action;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListVisitSessionsAction extends Action
{
    private VisitSessionRepositoryInterface $visitSessionRepository;

    public function __construct(LoggerInterface $logger, VisitSessionRepositoryInterface $visitSessionRepository)
    {
        parent::__construct($logger);
        $this->visitSessionRepository = $visitSessionRepository;
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $repId = (int) $authUser['id'];
        
        $params = $this->request->getQueryParams();
        $page = (int) ($params['page'] ?? 1);

        $result = $this->visitSessionRepository->findAllByRep($repId, $page);

        return $this->respondWithData($result);
    }
}
