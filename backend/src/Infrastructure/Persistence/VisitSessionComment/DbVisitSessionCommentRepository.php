<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\VisitSessionComment;

use App\Domain\VisitSessionComment\VisitSessionComment;
use App\Domain\VisitSessionComment\VisitSessionCommentNotFoundException;
use App\Domain\VisitSessionComment\VisitSessionCommentRepositoryInterface;
use App\Infrastructure\Config\PaginationConfig;
use App\Infrastructure\Config\TimezoneConfig;
use App\Infrastructure\Database\Connection;
use App\Infrastructure\Support\OrgDateRange;
use PDO;

class DbVisitSessionCommentRepository implements VisitSessionCommentRepositoryInterface
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Connection::getConnection();
    }

    /**
     * Role scope is a NON-NEGOTIABLE base predicate derived from
     * server-side identity ($role/$userId/$organizationId) — NEVER from
     * request params. Any $filters passed by listForScope() are ANDed on
     * top of this clause and can only narrow the result set.
     *
     * Bindable params are appended (by reference) into $params so the
     * caller can reuse the identical predicate for both the SELECT and
     * the COUNT (or, in softDelete's case, the UPDATE).
     */
    private function buildScopeClause(string $role, int $userId, int $organizationId, array &$params): string
    {
        switch ($role) {
            case 'org_admin':
                $params[':scope_org'] = $organizationId;
                return 'c.organization_id = :scope_org';

            case 'manager':
                // Manager sees a comment if (a) material_id -> a material
                // owned by this manager, OR (b) material_id IS NULL AND the
                // comment's session has >=1 material owned by this manager.
                // Single OR-EXISTS (not UNION) — see design §1: the branches
                // are mutually exclusive by construction (branch b is gated
                // on material_id IS NULL, branch a requires it NOT NULL), so
                // a UNION would only force double materialization with zero
                // dedup benefit.
                $params[':scope_org']  = $organizationId;
                $params[':scope_mgr_a'] = $userId;
                $params[':scope_mgr_b'] = $userId;
                return '(
                    c.organization_id = :scope_org
                    AND (
                        EXISTS (
                            SELECT 1 FROM materials m
                            WHERE m.id = c.material_id AND m.manager_id = :scope_mgr_a
                        )
                        OR (
                            c.material_id IS NULL
                            AND EXISTS (
                                SELECT 1 FROM visit_session_materials vsm
                                JOIN materials m2 ON m2.id = vsm.material_id
                                WHERE vsm.visit_session_id = c.visit_session_id
                                  AND m2.manager_id = :scope_mgr_b
                            )
                        )
                    )
                )';

            case 'rep':
                $params[':scope_rep'] = $userId;
                return 'EXISTS (
                    SELECT 1 FROM visit_sessions vs
                    WHERE vs.id = c.visit_session_id AND vs.rep_id = :scope_rep
                )';

            default:
                // superadmin (or any future/unknown role) is explicitly
                // excluded from this feature. RoleMiddleware + LIST_ROLES
                // already blocks this at the route layer — this is defense
                // in depth so the repository can never be coerced into
                // returning cross-scope data even if called incorrectly.
                return '1 = 0';
        }
    }

    /**
     * @inheritDoc
     */
    public function listForScope(string $role, int $userId, int $organizationId, array $filters, int $page, string $timezone = TimezoneConfig::DEFAULT_ZONE): array
    {
        $pageSize = PaginationConfig::PAGE_SIZE;
        $page     = max(1, $page);
        $offset   = ($page - 1) * $pageSize;

        $params = [];
        $where  = ['c.active = 1'];
        $where[] = '(' . $this->buildScopeClause($role, $userId, $organizationId, $params) . ')';

        // --- Segment 2: user filters — AND-appended only, never widen scope ---
        if (!empty($filters['rep_id'])) {
            $where[] = 'EXISTS (
                SELECT 1 FROM visit_sessions vsr
                WHERE vsr.id = c.visit_session_id AND vsr.rep_id = :f_rep_id
            )';
            $params[':f_rep_id'] = (int) $filters['rep_id'];
        }

        if (!empty($filters['doctor_id'])) {
            // Filters against the SESSION's doctor (visit_sessions.doctor_id),
            // NOT the comment row's own doctor_id column. The doctor
            // identifies the VISIT, not the comment's author: every comment
            // on a session belongs to that session's doctor regardless of
            // who wrote it. c.doctor_id is only ever populated on
            // doctor-authored rows (CreatePublicCommentAction) — it is
            // hardcoded NULL on every rep-authored row (CreateCommentAction)
            // by design, so filtering on c.doctor_id directly would
            // silently drop every rep-authored comment about that doctor.
            // EXISTS (not a JOIN) so this clause is self-contained and
            // reusable byte-for-byte in the COUNT query below, which has
            // no join to visit_sessions.
            $where[] = 'EXISTS (
                SELECT 1 FROM visit_sessions vsd
                WHERE vsd.id = c.visit_session_id AND vsd.doctor_id = :f_doctor_id
            )';
            $params[':f_doctor_id'] = (int) $filters['doctor_id'];
        }

        if (!empty($filters['material_id'])) {
            $where[] = 'c.material_id = :f_material_id';
            $params[':f_material_id'] = (int) $filters['material_id'];
        }

        if (array_key_exists('has_material', $filters) && $filters['has_material'] !== null) {
            $where[] = $filters['has_material'] ? 'c.material_id IS NOT NULL' : 'c.material_id IS NULL';
        }

        // Half-open UTC range converted from the caller's org-local
        // date_from/date_to calendar filters (was `DATE(c.created_at) >= /
        // <= :param`, which compared a UTC-stored timestamp against a
        // Chile-local calendar date with no conversion — see
        // sdd/org-timezone). `DATE(c.created_at) <= :date_to` was also
        // inclusive of the whole UTC day; the half-open upper bound below
        // is the correct org-local-day-inclusive equivalent.
        $fromLocal = !empty($filters['date_from']) ? $filters['date_from'] : null;
        $toLocal   = !empty($filters['date_to']) ? $filters['date_to'] : null;
        [$fromUtc, $toUtcExclusive] = OrgDateRange::boundsForLocalDates($fromLocal, $toLocal, $timezone);

        if ($fromUtc !== null) {
            $where[] = 'c.created_at >= :f_date_from';
            $params[':f_date_from'] = $fromUtc;
        }

        if ($toUtcExclusive !== null) {
            $where[] = 'c.created_at < :f_date_to';
            $params[':f_date_to'] = $toUtcExclusive;
        }

        if (!empty($filters['q'])) {
            $where[] = 'c.body LIKE :f_q';
            $params[':f_q'] = '%' . $filters['q'] . '%';
        }

        $whereClause = implode(' AND ', $where);

        // COUNT reuses the IDENTICAL predicate as the SELECT (design §1) so
        // `total` is always accurate — no drift is possible between them.
        $countSql  = "SELECT COUNT(*) FROM visit_session_comments c WHERE $whereClause";
        $countStmt = $this->pdo->prepare($countSql);
        $this->bindParams($countStmt, $params);
        $countStmt->execute();
        $total = (int) $countStmt->fetchColumn();

        // can_delete is projected as a SQL literal — org_admin/manager/rep
        // are all already scope-filtered by the WHERE above, so every row
        // returned to an authenticated caller is, by construction, within
        // their DELETE_ROLES scope (DELETE_ROLES === LIST_ROLES today).
        // Zero extra queries (design §3).
        //
        // Display-name enrichment (gap fix — "donde se vea el medico, el
        // representante, el comentario"): every JOIN below is to-one via a
        // PRIMARY KEY or a NOT-NULL FK guarded by ON DELETE RESTRICT/CASCADE
        // (visit_sessions.rep_id -> users, visit_session_comments.visit_session_id
        // -> visit_sessions), so none of these JOINs can multiply rows or
        // change which comments match $whereClause — the COUNT query above
        // (run against `c` alone, no JOINs) stays byte-for-byte accurate
        // against this SELECT's row set.
        //
        // `s` (visit_sessions) is joined INNER because visit_session_id is
        // NOT NULL with ON DELETE CASCADE (a comment cannot outlive its
        // session). `rep_u` (the session's rep — the "representante" the
        // product requirement asks for) is joined INNER because
        // visit_sessions.rep_id is NOT NULL with ON DELETE RESTRICT (a rep
        // can never be deleted while sessions reference them). `mat` and
        // `au` are LEFT joins: material_id and author_user_id are both
        // nullable (open comment / doctor-authored comment respectively).
        //
        // s.doctor_name is used (NOT c.doctor_id/a doctors join) because it
        // is the field that identifies the VISIT's doctor regardless of who
        // authored the comment — CreateCommentAction (rep POST) hardcodes
        // the comment row's own doctor_id to NULL, so deriving display name
        // from c.doctor_id would silently drop the doctor on every
        // rep-authored row. s.doctor_name is required + denormalized at
        // session-creation time (CreateVisitSessionAction), so it is never
        // null for any real session.
        $sql = "SELECT c.*, 1 AS can_delete,
                       s.doctor_name AS doctor_name,
                       rep_u.name AS rep_name,
                       mat.title AS material_title,
                       CASE WHEN c.author_type = 'doctor' THEN s.doctor_name ELSE au.name END AS author_name
                FROM visit_session_comments c
                JOIN visit_sessions s ON s.id = c.visit_session_id
                JOIN users rep_u ON rep_u.id = s.rep_id
                LEFT JOIN materials mat ON mat.id = c.material_id
                LEFT JOIN users au ON au.id = c.author_user_id
                WHERE $whereClause
                ORDER BY c.created_at DESC, c.id DESC
                LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        $this->bindParams($stmt, $params);
        $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        $rows  = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = array_map(fn(array $row) => VisitSessionComment::fromRow($row), $rows);

        return [
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $pageSize,
            'last_page' => (int) ceil($total / $pageSize),
        ];
    }

    /**
     * @inheritDoc
     */
    public function create(array $data): VisitSessionComment
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO visit_session_comments
                (visit_session_id, material_id, organization_id, parent_id,
                 author_type, author_user_id, doctor_id, body, user_agent, ip_address, active)
             VALUES
                (:visit_session_id, :material_id, :organization_id, NULL,
                 :author_type, :author_user_id, :doctor_id, :body, :user_agent, :ip_address, 1)'
        );

        $stmt->execute([
            ':visit_session_id' => $data['visit_session_id'],
            ':material_id'      => $data['material_id'] ?? null,
            ':organization_id'  => $data['organization_id'],
            ':author_type'      => $data['author_type'],
            ':author_user_id'   => $data['author_user_id'] ?? null,
            ':doctor_id'        => $data['doctor_id'] ?? null,
            ':body'             => $data['body'],
            ':user_agent'       => $data['user_agent'] ?? null,
            ':ip_address'       => $data['ip_address'] ?? null,
        ]);

        return $this->findById((int) $this->pdo->lastInsertId());
    }

    /**
     * @inheritDoc
     */
    public function softDelete(int $id, string $role, int $userId, int $organizationId): bool
    {
        // Confirm the row exists AT ALL first (independent of scope) so the
        // Action layer can distinguish a true 404 (missing) from a 403
        // (exists, but the update below affects 0 rows because it's out of
        // the caller's scope).
        $existsStmt = $this->pdo->prepare('SELECT id FROM visit_session_comments WHERE id = :id LIMIT 1');
        $existsStmt->execute([':id' => $id]);
        if (!$existsStmt->fetch(PDO::FETCH_ASSOC)) {
            throw new VisitSessionCommentNotFoundException($id);
        }

        $params = [':id' => $id];
        $scopeClause = $this->buildScopeClause($role, $userId, $organizationId, $params);

        $sql = "UPDATE visit_session_comments c
                SET c.active = 0
                WHERE c.id = :id AND ($scopeClause)";

        $stmt = $this->pdo->prepare($sql);
        $this->bindParams($stmt, $params);
        $stmt->execute();

        return $stmt->rowCount() > 0;
    }

    /**
     * @inheritDoc
     */
    public function findPublicForSession(int $sessionId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT * FROM visit_session_comments
             WHERE visit_session_id = :sid AND author_type = 'doctor' AND active = 1
             ORDER BY created_at DESC"
        );
        $stmt->execute([':sid' => $sessionId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(function (array $row) {
            // can_delete is always false in the public/doctor context —
            // there is no delete route reachable without authentication.
            $row['can_delete'] = false;
            return VisitSessionComment::fromRow($row);
        }, $rows);
    }

    /**
     * @inheritDoc
     */
    public function countRecentForSession(int $sessionId, int $windowSeconds): int
    {
        // Deliberately does NOT filter active=1 — soft-deleted rows still
        // count toward the rate limit, otherwise delete-then-repost would
        // become a limit-reset bypass (design §2, explicit security choice).
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM visit_session_comments
             WHERE visit_session_id = :sid
               AND created_at > (NOW() - INTERVAL :window_seconds SECOND)'
        );
        $stmt->bindValue(':sid', $sessionId, PDO::PARAM_INT);
        $stmt->bindValue(':window_seconds', $windowSeconds, PDO::PARAM_INT);
        $stmt->execute();

        return (int) $stmt->fetchColumn();
    }

    private function findById(int $id): VisitSessionComment
    {
        $stmt = $this->pdo->prepare('SELECT * FROM visit_session_comments WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            throw new VisitSessionCommentNotFoundException($id);
        }

        return VisitSessionComment::fromRow($row);
    }

    private function bindParams(\PDOStatement $stmt, array $params): void
    {
        foreach ($params as $key => $val) {
            $stmt->bindValue($key, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
    }
}
