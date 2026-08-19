<?php

declare(strict_types=1);

namespace Tests\Integration\Metrics;

use App\Infrastructure\Database\Connection;
use App\Infrastructure\Persistence\Metrics\DbMetricsRepository;
use PDO;
use Tests\TestCase;

/**
 * Real-DB regression test for the "rep filter drops doctor views" bug in
 * /metrics: filtering the trend chart, top-materials chart/list, and study
 * views by representative used to build the predicate as
 * `viewer_type = 'rep' AND viewer_id IN (...)`, which silently drops EVERY
 * viewer_type='doctor' row — even when that doctor view happened during a
 * visit_session owned by the filtered rep — because doctor-type views
 * never populate viewer_id (see material_views/study_views migrations).
 * Meanwhile "Registro de Visualizaciones" (getMaterialViewsList) already
 * resolved the rep correctly via COALESCE(viewer_id, visit_sessions.rep_id)
 * and disagreed with the charts for the exact same filter.
 *
 * Exercises the ACTUAL DbMetricsRepository SQL (not a mock) against 4
 * seeded material_views / study_views rows covering all 3 relevant cases:
 *   - a direct rep view (viewer_type='rep', viewer_id=rep)
 *   - a doctor view during that rep's session (viewer_type='doctor',
 *     viewer_id=NULL, visit_session_id -> that rep's session) — THIS is
 *     the row the bug used to drop
 *   - an orphaned doctor view (visit_session_id=NULL, simulating
 *     visit_sessions' ON DELETE SET NULL) — must be counted WITHOUT a rep
 *     filter but excluded WITH one (it can't be attributed to any rep)
 *
 * Fixtures are raw INSERTs against the live PDO connection, removed by
 * exact primary key in tearDown() (same pattern as DoctorScopeTest /
 * RepSearchActionIntegrationTest / CommentActionsTest).
 */
class MetricsRepAttributionTest extends TestCase
{
    private PDO $pdo;
    private DbMetricsRepository $repo;
    private static bool $envLoaded = false;

    /** @var array<string,mixed> */
    private array $fx = [];

    protected function setUp(): void
    {
        if (!self::$envLoaded) {
            $dotenv = \Dotenv\Dotenv::createImmutable(__DIR__ . '/../../..');
            $dotenv->safeLoad();
            self::$envLoaded = true;
        }

        $this->pdo = Connection::getConnection();
        $this->repo = new DbMetricsRepository();
        $this->fx = $this->createFixtures();
    }

    protected function tearDown(): void
    {
        $this->destroyFixtures($this->fx);
    }

    // -----------------------------------------------------------------
    // Trend chart ("Tendencia de visualizaciones")
    // -----------------------------------------------------------------

    public function testMaterialViewsMetricsCountsDoctorViewAttributedToFilteredRepSession(): void
    {
        $buckets = $this->repo->getMaterialViewsMetrics(
            $this->fx['org_id'],
            null,
            ['rep_ids' => [$this->fx['rep_id']]]
        );

        [$repViews, $doctorViews] = $this->sumByViewerType($buckets);

        $this->assertSame(1, $repViews, 'the direct rep view must still count');
        $this->assertSame(
            1,
            $doctorViews,
            'the doctor view from the filtered rep\'s own session must count — this is the bug: it used to be 0'
        );
    }

    public function testMaterialViewsMetricsOrphanedViewCountsOnlyWithoutRepFilter(): void
    {
        $unfiltered = $this->repo->getMaterialViewsMetrics($this->fx['org_id'], null, []);
        [, $doctorViewsUnfiltered] = $this->sumByViewerType($unfiltered);
        $this->assertSame(
            2,
            $doctorViewsUnfiltered,
            'without a rep filter, BOTH the session-doctor view and the orphaned (no-session) doctor view must count'
        );

        $filtered = $this->repo->getMaterialViewsMetrics(
            $this->fx['org_id'],
            null,
            ['rep_ids' => [$this->fx['rep_id']]]
        );
        [, $doctorViewsFiltered] = $this->sumByViewerType($filtered);
        $this->assertSame(
            1,
            $doctorViewsFiltered,
            'with a rep filter, the orphaned view (visit_session_id NULL, unattributable to any rep) must be excluded'
        );
    }

    // -----------------------------------------------------------------
    // Top-materials chart/list + detail table coherence (acceptance
    // criterion: same rep filter, chart sum must equal table total)
    // -----------------------------------------------------------------

    public function testTopMaterialsAndMaterialViewsListAgreeUnderTheSameRepFilter(): void
    {
        $repIds = [$this->fx['rep_id']];

        $top = $this->repo->getTopMaterialsMetrics($this->fx['org_id'], null, ['rep_ids' => $repIds]);
        $row = $this->findMaterialRow($top, $this->fx['material_id']);

        $this->assertNotNull($row, 'the material must still appear in the top-materials chart under the rep filter');
        $this->assertSame('1', (string) $row['rep_views']);
        $this->assertSame('1', (string) $row['doctor_views'], 'top-materials chart must count the rep\'s doctor view, not show 0');
        $this->assertSame('2', (string) $row['total_views']);

        $list = $this->repo->getMaterialViewsList($this->fx['org_id'], null, ['rep_ids' => $repIds]);

        $this->assertSame(
            (int) $row['total_views'],
            $list['meta']['total'],
            'chart total_views and table row count must agree under the identical rep filter'
        );

        $viewerTypes = array_column($list['items'], 'viewer_type');
        sort($viewerTypes);
        $this->assertSame(['doctor', 'rep'], $viewerTypes);
    }

    public function testTopMaterialsListPaginatedSiblingMatchesTopMaterialsMetrics(): void
    {
        $repIds = [$this->fx['rep_id']];

        $metrics = $this->repo->getTopMaterialsMetrics($this->fx['org_id'], null, ['rep_ids' => $repIds]);
        $metricsRow = $this->findMaterialRow($metrics, $this->fx['material_id']);

        $list = $this->repo->getTopMaterialsList($this->fx['org_id'], null, ['rep_ids' => $repIds]);
        $listRow = $this->findMaterialRow($list['items'], $this->fx['material_id']);

        $this->assertNotNull($listRow);
        $this->assertSame($metricsRow['total_views'], $listRow['total_views']);
        $this->assertSame($metricsRow['doctor_views'], $listRow['doctor_views']);
    }

    // -----------------------------------------------------------------
    // Study views mirror the same fix (getStudyViewsMetrics/List)
    // -----------------------------------------------------------------

    public function testStudyViewsMetricsCountsDoctorViewAttributedToFilteredRepSession(): void
    {
        $buckets = $this->repo->getStudyViewsMetrics(
            $this->fx['org_id'],
            null,
            ['rep_ids' => [$this->fx['rep_id']]]
        );

        [$repViews, $doctorViews] = $this->sumByViewerType($buckets);

        $this->assertSame(1, $repViews);
        $this->assertSame(1, $doctorViews, 'study-views trend must count the rep\'s doctor view, not show 0');

        $list = $this->repo->getStudyViewsList($this->fx['org_id'], null, ['rep_ids' => [$this->fx['rep_id']]]);
        $this->assertSame(2, $list['meta']['total'], 'study views list total must agree with the trend sum (1 rep + 1 doctor)');
    }

    // ===================================================================
    // Helpers
    // ===================================================================

    /** @return array{0:int,1:int} [repViewsTotal, doctorViewsTotal] */
    private function sumByViewerType(array $buckets): array
    {
        $rep = 0;
        $doctor = 0;
        foreach ($buckets as $bucket) {
            if ($bucket['viewer_type'] === 'rep') {
                $rep += (int) $bucket['views'];
            } elseif ($bucket['viewer_type'] === 'doctor') {
                $doctor += (int) $bucket['views'];
            }
        }
        return [$rep, $doctor];
    }

    private function findMaterialRow(array $rows, int $materialId): ?array
    {
        foreach ($rows as $row) {
            if ((int) $row['id'] === $materialId) {
                return $row;
            }
        }
        return null;
    }

    private function createFixtures(): array
    {
        $suffix = uniqid('metrics_repattr_', true);

        $orgId = $this->insertOrganization("Test Org {$suffix}");
        $managerId = $this->insertUser($orgId, 'manager', "manager_{$suffix}@test.local", 'Manager');
        $repId = $this->insertUser($orgId, 'rep', "rep_{$suffix}@test.local", 'Rep One');
        $brandId = $this->insertBrand($orgId, "Brand {$suffix}");
        $materialId = $this->insertMaterial($orgId, $brandId, $managerId, "Material {$suffix}");
        $sessionId = $this->insertVisitSession($orgId, $repId, "token_{$suffix}");

        // 1) Direct rep view, attached to the rep's own session.
        $repViewId = $this->insertMaterialView($materialId, $sessionId, 'rep', $repId);
        // 2) Doctor view during that SAME session — the row the bug dropped.
        $doctorSessionViewId = $this->insertMaterialView($materialId, $sessionId, 'doctor', null);
        // 3) Orphaned doctor view (no session — simulates ON DELETE SET NULL).
        $doctorOrphanViewId = $this->insertMaterialView($materialId, null, 'doctor', null);

        // Mirror the exact same 2-row (rep + session-doctor) scenario for
        // study_views, via a material_studies leaf CASCADE-owned by the
        // same material.
        $studyId = $this->insertMaterialStudy($materialId, "Study {$suffix}");
        $studyRepViewId = $this->insertStudyView($studyId, $sessionId, 'rep', $repId);
        $studyDoctorViewId = $this->insertStudyView($studyId, $sessionId, 'doctor', null);

        return [
            'org_id' => $orgId,
            'manager_id' => $managerId,
            'rep_id' => $repId,
            'brand_id' => $brandId,
            'material_id' => $materialId,
            'session_id' => $sessionId,
            'rep_view_id' => $repViewId,
            'doctor_session_view_id' => $doctorSessionViewId,
            'doctor_orphan_view_id' => $doctorOrphanViewId,
            'study_id' => $studyId,
            'study_rep_view_id' => $studyRepViewId,
            'study_doctor_view_id' => $studyDoctorViewId,
        ];
    }

    private function destroyFixtures(array $fx): void
    {
        if (empty($fx)) {
            return;
        }

        $this->deleteWhereIn('study_views', 'id', [$fx['study_rep_view_id'], $fx['study_doctor_view_id']]);
        $this->deleteWhereIn('material_studies', 'id', [$fx['study_id']]);
        $this->deleteWhereIn('material_views', 'id', [
            $fx['rep_view_id'], $fx['doctor_session_view_id'], $fx['doctor_orphan_view_id'],
        ]);
        $this->deleteWhereIn('visit_sessions', 'id', [$fx['session_id']]);
        $this->deleteWhereIn('materials', 'id', [$fx['material_id']]);
        $this->deleteWhereIn('brands', 'id', [$fx['brand_id']]);
        $this->deleteWhereIn('users', 'id', [$fx['manager_id'], $fx['rep_id']]);
        $this->deleteWhereIn('organizations', 'id', [$fx['org_id']]);
    }

    private function deleteWhereIn(string $table, string $column, array $ids): void
    {
        $ids = array_values(array_unique(array_filter($ids, fn ($v) => $v !== null)));
        if (empty($ids)) {
            return;
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->pdo->prepare("DELETE FROM `{$table}` WHERE `{$column}` IN ({$placeholders})");
        $stmt->execute($ids);
    }

    private function insertOrganization(string $name): int
    {
        $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower($name));
        $stmt = $this->pdo->prepare('INSERT INTO organizations (name, slug, active) VALUES (:name, :slug, 1)');
        $stmt->execute([':name' => $name, ':slug' => $slug]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertUser(int $organizationId, string $roleName, string $email, string $name): int
    {
        $roleStmt = $this->pdo->prepare('SELECT id FROM roles WHERE name = :name LIMIT 1');
        $roleStmt->execute([':name' => $roleName]);
        $roleId = (int) $roleStmt->fetchColumn();

        $stmt = $this->pdo->prepare(
            'INSERT INTO users (organization_id, role_id, name, email, password_hash, active)
             VALUES (:org_id, :role_id, :name, :email, :hash, 1)'
        );
        $stmt->execute([
            ':org_id' => $organizationId,
            ':role_id' => $roleId,
            ':name' => $name,
            ':email' => $email,
            ':hash' => password_hash('test-password-not-used', PASSWORD_BCRYPT),
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertBrand(int $organizationId, string $name): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO brands (organization_id, name, active) VALUES (:org_id, :name, 1)'
        );
        $stmt->execute([':org_id' => $organizationId, ':name' => $name]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertMaterial(int $organizationId, int $brandId, int $managerId, string $title): int
    {
        $stmt = $this->pdo->prepare(
            "INSERT INTO materials (organization_id, brand_id, manager_id, title, type, status)
             VALUES (:org_id, :brand_id, :manager_id, :title, 'pdf', 'approved')"
        );
        $stmt->execute([
            ':org_id' => $organizationId,
            ':brand_id' => $brandId,
            ':manager_id' => $managerId,
            ':title' => $title,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertVisitSession(int $organizationId, int $repId, string $token): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO visit_sessions (organization_id, rep_id, doctor_token, doctor_name, active)
             VALUES (:org_id, :rep_id, :token, :doctor_name, 1)'
        );
        $stmt->execute([
            ':org_id' => $organizationId,
            ':rep_id' => $repId,
            ':token' => $token,
            ':doctor_name' => 'Test Doctor',
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertMaterialView(int $materialId, ?int $sessionId, string $viewerType, ?int $viewerId): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO material_views (material_id, visit_session_id, viewer_type, viewer_id, opened_at)
             VALUES (:material_id, :session_id, :viewer_type, :viewer_id, NOW())'
        );
        $stmt->execute([
            ':material_id' => $materialId,
            ':session_id' => $sessionId,
            ':viewer_type' => $viewerType,
            ':viewer_id' => $viewerId,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertMaterialStudy(int $materialId, string $title): int
    {
        $stmt = $this->pdo->prepare(
            "INSERT INTO material_studies (material_id, title, type)
             VALUES (:material_id, :title, 'pdf')"
        );
        $stmt->execute([':material_id' => $materialId, ':title' => $title]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertStudyView(int $studyId, ?int $sessionId, string $viewerType, ?int $viewerId): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO study_views (study_id, visit_session_id, viewer_type, viewer_id, opened_at)
             VALUES (:study_id, :session_id, :viewer_type, :viewer_id, NOW())'
        );
        $stmt->execute([
            ':study_id' => $studyId,
            ':session_id' => $sessionId,
            ':viewer_type' => $viewerType,
            ':viewer_id' => $viewerId,
        ]);
        return (int) $this->pdo->lastInsertId();
    }
}
