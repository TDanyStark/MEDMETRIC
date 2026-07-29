<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\VisitSession;

use App\Application\Actions\Action;
use App\Application\Actions\Concerns\ResolvesOrgTimezone;
use App\Domain\Organization\OrganizationRepositoryInterface;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListVisitSessionsAction extends Action
{
    use ResolvesOrgTimezone;

    private VisitSessionRepositoryInterface $visitSessionRepository;
    private OrganizationRepositoryInterface $organizationRepository;

    public function __construct(
        LoggerInterface $logger,
        VisitSessionRepositoryInterface $visitSessionRepository,
        OrganizationRepositoryInterface $organizationRepository
    ) {
        parent::__construct($logger);
        $this->visitSessionRepository = $visitSessionRepository;
        $this->organizationRepository = $organizationRepository;
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $repId = (int) $authUser['id'];
        $organizationId = isset($authUser['organization_id']) ? (int) $authUser['organization_id'] : null;

        $params = $this->request->getQueryParams();
        $page = (int) ($params['page'] ?? 1);
        $q = $params['q'] ?? null;
        $date = $params['date'] ?? null;

        $timezone = $this->resolveOrgTimezone($this->organizationRepository, $organizationId);

        $result = $this->visitSessionRepository->findAllByRep($repId, $page, $q, $date, $timezone);

        return $this->respondWithData($result);
    }
}
