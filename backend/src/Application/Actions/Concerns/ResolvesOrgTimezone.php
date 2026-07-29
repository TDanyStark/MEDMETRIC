<?php

declare(strict_types=1);

namespace App\Application\Actions\Concerns;

use App\Domain\Organization\OrganizationNotFoundException;
use App\Domain\Organization\OrganizationRepositoryInterface;
use App\Infrastructure\Config\TimezoneConfig;

/**
 * Resolves the IANA timezone to use for org-local date filtering/bucketing
 * (see App\Infrastructure\Support\OrgDateRange). Shared by every Action that
 * needs to convert an org-local calendar-date filter into a UTC range before
 * querying — avoids re-implementing the same lookup+fallback at each call
 * site (DRY per AGENTS.md).
 *
 * Scope note: every DATE()-filtered query site converted for org-timezone
 * (see sdd/org-timezone design, "Timezone resolution paths") is reached
 * ONLY via authenticated routes (org_admin / manager / rep) — none of them
 * are exposed on an unauthenticated public doctor path. This trait therefore
 * only implements the "resolve via the authenticated user's organization"
 * path; the "resolve via the visit session's organization" path is a
 * separate (Phase 5/frontend display) concern for the public doctor page,
 * not a query-filtering concern.
 */
trait ResolvesOrgTimezone
{
    /**
     * @param int|null $organizationId Authenticated user's organization_id.
     *   Null/<=0 (e.g. a caller with no organization) falls back to
     *   TimezoneConfig::DEFAULT_ZONE — none of the routes using this trait
     *   are reachable without an organization today, but the resolver is
     *   kept total (never throws) so a future route change fails safe.
     */
    protected function resolveOrgTimezone(
        OrganizationRepositoryInterface $organizationRepository,
        ?int $organizationId
    ): string {
        if ($organizationId === null || $organizationId <= 0) {
            return TimezoneConfig::DEFAULT_ZONE;
        }

        try {
            return $organizationRepository->findById($organizationId)->getTimezone();
        } catch (OrganizationNotFoundException $e) {
            return TimezoneConfig::DEFAULT_ZONE;
        }
    }
}
