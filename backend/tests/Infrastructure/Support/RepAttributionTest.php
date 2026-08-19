<?php

declare(strict_types=1);

namespace Tests\Infrastructure\Support;

use App\Infrastructure\Support\RepAttribution;
use Tests\TestCase;

/**
 * Regression coverage for the "rep filter drops doctor views" bug:
 * DbMetricsRepository::getMaterialViewsMetrics() / getTopMaterialsMetrics()
 * / getTopMaterialsList() / getStudyViewsMetrics() used to build the rep
 * filter as `viewer_type = 'rep' AND viewer_id IN (...)`, which silently
 * excludes EVERY viewer_type='doctor' row (doctor views never have
 * viewer_id populated — see material_views/study_views migrations: "NULL
 * for doctor (no auth)") even when that doctor view happened during a
 * session owned by the filtered rep. This made the "Tendencia de
 * visualizaciones" trend chart and "Materiales por visualizaciones" chart
 * disagree with the "Registro de Visualizaciones" table (which already
 * used the correct COALESCE(viewer_id, session's rep_id) resolution) for
 * the exact same rep filter.
 *
 * These tests assert the SQL fragment RepAttribution::condition() builds
 * is the correct COALESCE-based predicate (not the naive viewer_type-only
 * one), and that it works identically whether the caller already has a
 * real `visit_sessions` JOIN alias or needs a correlated subquery (the two
 * usage modes across DbMetricsRepository — see that class' call sites).
 */
class RepAttributionTest extends TestCase
{
    public function testBuildsCoalesceConditionAgainstAnAlreadyJoinedSessionAlias(): void
    {
        $params = [':org_id' => 1];

        $sql = RepAttribution::condition([5, 9], 'mv.viewer_id', 'vs.rep_id', $params);

        $this->assertSame('COALESCE(mv.viewer_id, vs.rep_id) IN (:rep0, :rep1)', $sql);
        $this->assertSame([':org_id' => 1, ':rep0' => 5, ':rep1' => 9], $params);
    }

    public function testBuildsCoalesceConditionAgainstACorrelatedSubqueryWhenNoSessionJoinExists(): void
    {
        $params = [];

        $sql = RepAttribution::condition(
            [7],
            'mv.viewer_id',
            '(SELECT rep_id FROM visit_sessions WHERE id = mv.visit_session_id)',
            $params
        );

        $this->assertSame(
            'COALESCE(mv.viewer_id, (SELECT rep_id FROM visit_sessions WHERE id = mv.visit_session_id)) IN (:rep0)',
            $sql
        );
        $this->assertSame([':rep0' => 7], $params);
    }

    public function testNeverEmitsTheBuggyViewerTypeOnlyPredicate(): void
    {
        $params = [];

        $sql = RepAttribution::condition([1], 'mv.viewer_id', 'vs.rep_id', $params);

        $this->assertStringNotContainsString(
            "viewer_type = 'rep'",
            $sql,
            'The fixed predicate must never hard-exclude viewer_type=doctor rows — attribution goes through COALESCE, not a viewer_type filter'
        );
        $this->assertStringContainsString('COALESCE(', $sql);
    }

    public function testSupportsStudyViewsColumnsIdentically(): void
    {
        $params = [];

        $sql = RepAttribution::condition([3], 'sv.viewer_id', 'vs.rep_id', $params);

        $this->assertSame('COALESCE(sv.viewer_id, vs.rep_id) IN (:rep0)', $sql);
    }

    public function testPlaceholdersAreIndexedFromZeroInInputOrder(): void
    {
        $params = [];

        RepAttribution::condition([42, 43, 44], 'mv.viewer_id', 'vs.rep_id', $params);

        $this->assertSame([':rep0' => 42, ':rep1' => 43, ':rep2' => 44], $params);
    }
}
