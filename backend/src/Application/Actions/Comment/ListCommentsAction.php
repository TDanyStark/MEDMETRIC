<?php

declare(strict_types=1);

namespace App\Application\Actions\Comment;

use App\Application\Actions\Action;
use App\Application\Actions\Concerns\ResolvesOrgTimezone;
use App\Domain\Organization\OrganizationRepositoryInterface;
use App\Domain\VisitSessionComment\VisitSessionCommentRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Authenticated, role-scoped, paginated comment listing.
 *
 * GET /v1/comments — JWT + CommentAccessConfig::LIST_ROLES.
 *
 * Role scope (org_admin/manager/rep) is derived STRICTLY from the JWT
 * identity and is applied as a non-negotiable base predicate in the
 * repository. Query-param filters can only narrow that scope, never
 * widen it (design §3, spec "Filter cannot escape scope"). Each returned
 * item carries a server-computed `can_delete` flag.
 */
class ListCommentsAction extends Action
{
    use ResolvesOrgTimezone;

    private VisitSessionCommentRepositoryInterface $commentRepository;
    private OrganizationRepositoryInterface $organizationRepository;

    public function __construct(
        LoggerInterface $logger,
        VisitSessionCommentRepositoryInterface $commentRepository,
        OrganizationRepositoryInterface $organizationRepository
    ) {
        parent::__construct($logger);
        $this->commentRepository = $commentRepository;
        $this->organizationRepository = $organizationRepository;
    }

    protected function action(): Response
    {
        $authUser = $this->getAuthUser();
        $role = $authUser->getRole();
        $userId = $authUser->getId();
        $organizationId = (int) $authUser->getOrganizationId();

        $params = $this->request->getQueryParams();
        $page = isset($params['page']) ? (int) $params['page'] : 1;

        $filters = [];

        if (!empty($params['rep_id'])) {
            $filters['rep_id'] = (int) $params['rep_id'];
        }
        if (!empty($params['doctor_id'])) {
            $filters['doctor_id'] = (int) $params['doctor_id'];
        }
        if (!empty($params['material_id'])) {
            $filters['material_id'] = (int) $params['material_id'];
        }
        if (array_key_exists('has_material', $params) && $params['has_material'] !== '') {
            $filters['has_material'] = filter_var($params['has_material'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        }
        if (!empty($params['date_from'])) {
            $filters['date_from'] = $params['date_from'];
        }
        if (!empty($params['date_to'])) {
            $filters['date_to'] = $params['date_to'];
        }
        if (!empty($params['q'])) {
            $filters['q'] = $params['q'];
        }

        $timezone = $this->resolveOrgTimezone($this->organizationRepository, $organizationId);

        $result = $this->commentRepository->listForScope($role, $userId, $organizationId, $filters, $page, $timezone);

        return $this->respondWithData($result);
    }
}
