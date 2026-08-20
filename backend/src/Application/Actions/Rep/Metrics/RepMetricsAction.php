<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\Metrics;

use App\Application\Actions\Action;
use App\Application\Actions\Concerns\ResolvesOrgTimezone;
use App\Domain\Organization\OrganizationRepositoryInterface;
use App\Domain\RepMetrics\RepMetricsRepositoryInterface;
use Psr\Log\LoggerInterface;

/**
 * Base class for every `/v1/rep/metrics/*` endpoint (JWT + RoleMiddleware
 * ['rep'] applied at the route-group level in routes.php — see the `/rep`
 * group).
 *
 * resolveRepId() is the ONLY source of truth for "which rep's data": it is
 * derived exclusively from the JWT-backed AuthUser, mirroring
 * ListCommentsAction's identity-derived scope (design "Scope enforcement").
 * No Action in this namespace may ever read a `rep_id` from
 * $request->getQueryParams() and pass it to the repository as the scope —
 * query params may only add narrowing filters (session_id, material_id,
 * q, status, start_date, end_date), never widen or replace the identity.
 */
abstract class RepMetricsAction extends Action
{
    use ResolvesOrgTimezone;

    protected RepMetricsRepositoryInterface $repMetricsRepository;
    protected OrganizationRepositoryInterface $organizationRepository;

    public function __construct(
        LoggerInterface $logger,
        RepMetricsRepositoryInterface $repMetricsRepository,
        OrganizationRepositoryInterface $organizationRepository
    ) {
        parent::__construct($logger);
        $this->repMetricsRepository = $repMetricsRepository;
        $this->organizationRepository = $organizationRepository;
    }

    /**
     * The authenticated rep's own user id — the ONLY value ever passed as
     * `$repId` to RepMetricsRepositoryInterface. Never sourced from a
     * request parameter (spec "Rep Data Isolation").
     */
    protected function resolveRepId(): int
    {
        $authUser = $this->getAuthUser();

        return $authUser ? $authUser->getId() : 0;
    }

    /**
     * IANA timezone of the authenticated rep's organization, used for all
     * org-local day/hour bucketing in the repository layer.
     */
    protected function resolveTimezone(): string
    {
        $authUser = $this->getAuthUser();

        return $this->resolveOrgTimezone(
            $this->organizationRepository,
            $authUser ? $authUser->getOrganizationId() : null
        );
    }

    /**
     * The `start_date` / `end_date` org-local calendar-date filters shared
     * by every endpoint in this module. Query params only narrow the
     * rep-scoped result — they can never target another rep's data.
     *
     * @return array{start_date?: string, end_date?: string}
     */
    protected function dateRangeFilters(): array
    {
        $params = $this->request->getQueryParams();
        $filters = [];

        if (!empty($params['start_date'])) {
            $filters['start_date'] = (string) $params['start_date'];
        }

        if (!empty($params['end_date'])) {
            $filters['end_date'] = (string) $params['end_date'];
        }

        return $filters;
    }

    protected function queryPage(): int
    {
        $params = $this->request->getQueryParams();

        return isset($params['page']) ? max(1, (int) $params['page']) : 1;
    }
}
