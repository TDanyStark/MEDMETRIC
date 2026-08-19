<?php

declare(strict_types=1);

namespace App\Infrastructure\Support;

/**
 * Builds the SQL predicate that attributes a material_views/study_views row
 * to a representative, correctly for BOTH `viewer_type` values:
 *   - viewer_type='rep'    -> the row's own viewer_id column IS the rep's id.
 *   - viewer_type='doctor' -> viewer_id is NULL (a doctor has no `users`
 *     row/login — see GetMaterialResourceAction::recordResourceView() and
 *     OpenMaterialAction, neither ever populates viewer_id for a doctor
 *     view), so the rep can only be resolved via the visit_sessions row
 *     that owns that view ($sessionRepIdExpr, i.e. visit_sessions.rep_id).
 *
 * This exists because a naive `viewer_type = 'rep' AND viewer_id IN (...)`
 * predicate silently drops EVERY doctor-type view whenever a rep filter is
 * active (it hard-excludes viewer_type='doctor' rows outright instead of
 * resolving their rep through the owning session). That bug made the trend
 * chart ("Tendencia de visualizaciones") and the top-materials
 * chart/table disagree with "Registro de Visualizaciones" (which already
 * used this COALESCE pattern) whenever a rep filter was applied — Médicos
 * always showed 0 in the charts even though the table listed doctor rows
 * for that same rep.
 *
 * Pure / stateless / static — no PDO dependency, safe to call from any
 * layer and trivial to unit test without a database. Mutates $params by
 * reference the same way DbMetricsRepository::buildInClause() /
 * dateRangeFragments() already do, to stay consistent with the rest of
 * that repository's placeholder-building helpers.
 */
final class RepAttribution
{
    /**
     * @param int[] $repIds Positive integer rep ids (already normalized —
     *   caller is expected to have deduped/filtered via intIds() first).
     * @param string $viewerIdColumn e.g. "mv.viewer_id" / "sv.viewer_id".
     * @param string $sessionRepIdExpr Raw SQL expression resolving to that
     *   view's visit_sessions.rep_id:
     *   - an already-JOINed alias's column (e.g. "vs.rep_id") when the
     *     caller already LEFT JOINs visit_sessions for other reasons
     *     (e.g. to display doctor_name/rep name in a detail list);
     *   - a correlated subquery (e.g. "(SELECT rep_id FROM visit_sessions
     *     WHERE id = mv.visit_session_id)") when it does not — e.g. simple
     *     WHERE-based detail/trend queries with no other need for a
     *     visit_sessions join, or LEFT JOIN...ON-based aggregate queries
     *     where the rep condition must live INSIDE the material_views join
     *     (so 0-view materials still survive the LEFT JOIN) and
     *     visit_sessions can't be joined ahead of material_views in that
     *     same FROM sequence since it depends on
     *     material_views.visit_session_id.
     * @param array<string, mixed> $params Filled by reference with the
     *   `:rep{N}` placeholders (via DbMetricsRepository::buildInClause()'s
     *   naming convention — caller must pass the SAME $params array used
     *   to bind the rest of the query).
     *
     * NULL visit_session_id (ON DELETE SET NULL — an orphaned view whose
     * session was deleted) makes COALESCE(...) evaluate to NULL on both
     * branches, so an orphaned view never matches an active rep filter
     * (correct: it can no longer be attributed to any rep). Orphaned views
     * are NOT excluded when no rep filter is active, because this method
     * is only called (and its fragment only added to the query) when
     * $repIds is non-empty — callers must guard with `!empty($repIds)`.
     *
     * @return string SQL fragment, e.g. "COALESCE(mv.viewer_id, (SELECT
     *   rep_id FROM visit_sessions WHERE id = mv.visit_session_id)) IN
     *   (:rep0, :rep1)".
     */
    public static function condition(
        array $repIds,
        string $viewerIdColumn,
        string $sessionRepIdExpr,
        array &$params
    ): string {
        $placeholders = [];
        foreach (array_values($repIds) as $index => $repId) {
            $key = ':rep' . $index;
            $placeholders[] = $key;
            $params[$key] = $repId;
        }

        return "COALESCE({$viewerIdColumn}, {$sessionRepIdExpr}) IN (" . implode(', ', $placeholders) . ')';
    }
}
