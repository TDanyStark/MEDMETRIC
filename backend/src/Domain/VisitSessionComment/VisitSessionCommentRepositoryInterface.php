<?php

declare(strict_types=1);

namespace App\Domain\VisitSessionComment;

use App\Infrastructure\Config\TimezoneConfig;

interface VisitSessionCommentRepositoryInterface
{
    /**
     * Role-scoped, filtered, paginated comment listing.
     *
     * The role scope (org_admin/manager/rep) is ALWAYS applied as a
     * non-negotiable base predicate derived from server-side identity
     * ($role/$userId/$organizationId). $filters are ANDed on top of that
     * base predicate and can only narrow the result set, never widen it.
     *
     * $timezone is the caller's organization IANA identifier, used to
     * convert org-local date_from/date_to filters into a UTC range (see
     * App\Infrastructure\Support\OrgDateRange).
     *
     * @param array{
     *     rep_id?: int,
     *     doctor_id?: int,
     *     material_id?: int,
     *     has_material?: bool,
     *     date_from?: string,
     *     date_to?: string,
     *     q?: string
     * } $filters
     * @return array{items: array<int, VisitSessionComment>, total: int, page: int, per_page: int, last_page: int}
     */
    public function listForScope(string $role, int $userId, int $organizationId, array $filters, int $page, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Create a comment (public doctor POST or authenticated rep POST).
     *
     * @param array{
     *     visit_session_id: int,
     *     organization_id: int,
     *     material_id: ?int,
     *     author_type: string,
     *     author_user_id: ?int,
     *     doctor_id: ?int,
     *     body: string,
     *     user_agent: ?string,
     *     ip_address: ?string
     * } $data
     */
    public function create(array $data): VisitSessionComment;

    /**
     * Soft-delete (active=0) a comment, re-validated against the caller's
     * scope server-side (defense in depth — never trust the caller already
     * proved authorization elsewhere).
     *
     * Throws VisitSessionCommentNotFoundException when the id does not
     * exist at all. Returns false (not an exception) when the id exists
     * but is outside the caller's scope, so the Action layer can map that
     * to 403 while a true miss maps to 404.
     */
    public function softDelete(int $id, string $role, int $userId, int $organizationId): bool;

    /**
     * Public doctor read-back: ONLY that session's own doctor-authored,
     * active comments, ordered by created_at DESC. Never returns rep
     * comments — author_type is hard-filtered, never parameterized.
     *
     * @return array<int, VisitSessionComment>
     */
    public function findPublicForSession(int $sessionId): array;

    /**
     * Count comments for a session within the trailing $windowSeconds,
     * deliberately including soft-deleted rows (active is NOT filtered)
     * so self-delete cannot be used to bypass the public POST rate limit.
     */
    public function countRecentForSession(int $sessionId, int $windowSeconds): int;
}
