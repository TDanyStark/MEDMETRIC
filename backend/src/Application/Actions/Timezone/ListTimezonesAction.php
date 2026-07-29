<?php

declare(strict_types=1);

namespace App\Application\Actions\Timezone;

use App\Application\Actions\Action;
use App\Infrastructure\Config\TimezoneConfig;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * GET /v1/timezones — the curated LATAM zone allow-list.
 *
 * Single source of truth shared by:
 * - Backend validation (CreateOrganizationAction / UpdateOrganizationAction
 *   / OrgAdmin\Organization\UpdateMyOrganizationAction), which check
 *   membership in TimezoneConfig::LATAM_ZONES directly.
 * - The frontend timezone selector (superadmin org create/edit,
 *   org_admin organization settings), which fetches this endpoint
 *   instead of hardcoding a second copy of the list.
 *
 * Auth: any authenticated user (JWT only, no role restriction). The
 * payload is non-sensitive static reference data (a dozen IANA zone
 * identifiers) — no PII, no per-tenant data — so gating it further would
 * only complicate the two legitimate callers (superadmin organization
 * forms and org_admin organization settings) for no security benefit.
 */
class ListTimezonesAction extends Action
{
    public function __construct(LoggerInterface $logger)
    {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        return $this->respondWithData(TimezoneConfig::LATAM_ZONES);
    }
}
