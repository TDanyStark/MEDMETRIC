<?php

declare(strict_types=1);

namespace Tests\Application\Actions\Comment;

use App\Application\Services\Auth\JwtServiceInterface;
use App\Infrastructure\Config\TimezoneConfig;
use App\Infrastructure\Database\Connection;
use DateTimeImmutable;
use DateTimeZone;
use DI\Container;
use PDO;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Tests\TestCase;

/**
 * End-to-end HTTP/Action-layer regression tests for visit-session comments
 * (Phase 3). Repository-level scope/rate-limit/public-leak guarantees were
 * already proven via a transaction-rollback integration test in Phase 2
 * (see sdd/visit-comments/apply-progress) — these tests exercise the same
 * guarantees THROUGH the real Slim routes/middleware/Actions, which is a
 * genuinely different failure surface (route wiring, RoleMiddleware
 * allow-lists, JWT decoding, query-param parsing, HTTP status codes).
 *
 * Fixtures are created with raw INSERTs directly against the real DB
 * (Connection::getConnection() singleton — the same PDO instance the app
 * uses) and deleted by exact primary key in tearDown(). A single wrapping
 * transaction is deliberately NOT used because
 * DbVisitSessionRepository::addMaterials() calls $pdo->beginTransaction()
 * internally, which would conflict with (and throw on) an already-active
 * outer transaction on the same PDO connection.
 */
class CommentActionsTest extends TestCase
{
    private PDO $pdo;
    private static bool $envLoaded = false;

    /** @var array<string,mixed> fixture ids/tokens created in setUp() for the current test */
    private array $fx = [];

    protected function setUp(): void
    {
        if (!self::$envLoaded) {
            $dotenv = \Dotenv\Dotenv::createImmutable(__DIR__ . '/../../../..');
            $dotenv->safeLoad();
            self::$envLoaded = true;
        }

        $this->pdo = Connection::getConnection();
        $this->fx = $this->createFixtures();
    }

    protected function tearDown(): void
    {
        $this->destroyFixtures($this->fx);
    }

    // -----------------------------------------------------------------
    // T3.7 — Manager scope escape via material_id filter
    // -----------------------------------------------------------------
    public function testManagerScopeEscapeViaMaterialIdFilter(): void
    {
        // comment_scope references material_A1, owned by manager_A1.
        $this->insertComment(
            $this->fx['session_scope_id'],
            $this->fx['org_a_id'],
            $this->fx['material_a1_id'],
            'doctor',
            null,
            'Scope test comment'
        );

        $app = $this->getAppInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['manager_a1_id'],
            'email' => 'manager_a1@test.local',
            'name' => 'Manager A1',
            'role' => 'manager',
            'organization_id' => $this->fx['org_a_id'],
        ]);

        // manager_A1 filters by material_A2's id — owned by a DIFFERENT
        // manager (manager_A2). The base scope predicate restricts to
        // manager_A1's own materials, so ANDing this filter on top must
        // yield an empty set, never manager_A2's or anyone else's data.
        $request = $this->authedRequest($app, 'GET', '/v1/comments', $token, [
            'material_id' => (string) $this->fx['material_a2_id'],
        ]);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertTrue($payload['success']);
        $this->assertSame(0, $payload['data']['total']);
        $this->assertSame([], $payload['data']['items']);
    }

    // -----------------------------------------------------------------
    // T3.8 — org_admin cross-org scope escape
    // -----------------------------------------------------------------
    public function testOrgAdminCrossOrgScopeEscape(): void
    {
        // comment_org_b lives entirely in org B (material_B1, org B).
        $this->insertComment(
            $this->fx['session_org_b_id'],
            $this->fx['org_b_id'],
            $this->fx['material_b1_id'],
            'doctor',
            null,
            'Org B comment'
        );

        $app = $this->getAppInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['org_admin_a_id'],
            'email' => 'org_admin_a@test.local',
            'name' => 'Org Admin A',
            'role' => 'org_admin',
            'organization_id' => $this->fx['org_a_id'],
        ]);

        // org_admin of org A filters by org B's material id. Base predicate
        // is c.organization_id = self.org (org A) — the filter can never
        // widen that, so the org B comment must never surface.
        $request = $this->authedRequest($app, 'GET', '/v1/comments', $token, [
            'material_id' => (string) $this->fx['material_b1_id'],
        ]);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertSame(0, $payload['data']['total']);
        $this->assertSame([], $payload['data']['items']);

        // Unfiltered listing for org_admin_A must also never contain the
        // org B comment (belt-and-suspenders on the base predicate itself).
        $requestAll = $this->authedRequest($app, 'GET', '/v1/comments', $token, []);
        $responseAll = $app->handle($requestAll);
        $payloadAll = $this->decode($responseAll);
        foreach ($payloadAll['data']['items'] as $item) {
            $this->assertNotEquals($this->fx['org_b_id'], $item['organization_id']);
        }
    }

    // -----------------------------------------------------------------
    // T3.9 — CASCADE-trap regression (R8): comment survives material
    // removal from the session's material list.
    // -----------------------------------------------------------------
    public function testCommentSurvivesMaterialRemovalFromSession(): void
    {
        $app = $this->getAppInstance();

        // Doctor posts a comment scoped to material_A1, which IS currently
        // attached to session_cascade.
        $createReq = $this->createRequest('POST', '/v1/public/session/' . $this->fx['session_cascade_token'] . '/comments')
            ->withParsedBody(['body' => 'Comment tied to material A1', 'material_id' => $this->fx['material_a1_id']]);
        $createResp = $app->handle($createReq);
        $createPayload = $this->decode($createResp);
        $this->assertEquals(201, $createResp->getStatusCode(), 'Setup: comment creation must succeed');
        $commentId = $createPayload['data']['id'];

        // Rep edits the session's material list, replacing material_A1
        // with material_A2 — this diff-deletes the visit_session_materials
        // row for material_A1 (NOT the comment, which targets materials.id
        // directly, never visit_session_materials.id).
        $repToken = $this->jwtFor($app, [
            'id' => $this->fx['rep_a1_id'],
            'email' => 'rep_a1@test.local',
            'name' => 'Rep A1',
            'role' => 'rep',
            'organization_id' => $this->fx['org_a_id'],
        ]);
        $editReq = $this->authedRequest(
            $app,
            'PATCH',
            '/v1/rep/visit-sessions/' . $this->fx['session_cascade_id'] . '/materials',
            $repToken
        )->withParsedBody(['material_ids' => [$this->fx['material_a2_id']]]);
        $editResp = $app->handle($editReq);
        $this->assertEquals(200, $editResp->getStatusCode(), 'Setup: material list edit must succeed');

        // Confirm material_A1 is indeed no longer attached to the session.
        $vsmStmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM visit_session_materials WHERE visit_session_id = :sid AND material_id = :mid'
        );
        $vsmStmt->execute([':sid' => $this->fx['session_cascade_id'], ':mid' => $this->fx['material_a1_id']]);
        $this->assertSame(0, (int) $vsmStmt->fetchColumn(), 'Setup: material_A1 must have been removed from the session');

        // THE ASSERTION: the comment row still exists, unchanged, still
        // referencing material_id = material_A1.
        $commentStmt = $this->pdo->prepare(
            'SELECT id, material_id, active FROM visit_session_comments WHERE id = :id'
        );
        $commentStmt->execute([':id' => $commentId]);
        $row = $commentStmt->fetch(PDO::FETCH_ASSOC);

        $this->assertNotFalse($row, 'Comment must still exist after material removal from session');
        $this->assertSame($this->fx['material_a1_id'], (int) $row['material_id']);
        $this->assertSame(1, (int) $row['active']);
    }

    // -----------------------------------------------------------------
    // T3.10 — Public payload never contains rep-authored comments
    // -----------------------------------------------------------------
    public function testPublicPayloadNeverContainsRepComments(): void
    {
        $app = $this->getAppInstance();

        // Rep-authored comment on session_leak via authenticated POST.
        $repToken = $this->jwtFor($app, [
            'id' => $this->fx['rep_a1_id'],
            'email' => 'rep_a1@test.local',
            'name' => 'Rep A1',
            'role' => 'rep',
            'organization_id' => $this->fx['org_a_id'],
        ]);
        $repReq = $this->authedRequest($app, 'POST', '/v1/comments', $repToken)
            ->withParsedBody(['visit_session_id' => $this->fx['session_leak_id'], 'body' => 'Rep note, must never leak publicly']);
        $repResp = $app->handle($repReq);
        $this->assertEquals(201, $repResp->getStatusCode(), 'Setup: rep comment creation must succeed');

        // Doctor-authored comment on the SAME session via public POST.
        $docReq = $this->createRequest('POST', '/v1/public/session/' . $this->fx['session_leak_token'] . '/comments')
            ->withParsedBody(['body' => 'Doctor comment, should be visible']);
        $docResp = $app->handle($docReq);
        $docPayload = $this->decode($docResp);
        $this->assertEquals(201, $docResp->getStatusCode(), 'Setup: doctor comment creation must succeed');
        $doctorCommentId = $docPayload['data']['id'];

        // Public read-back — only ONE param combination exists on this
        // route (no query params at all): assert it never contains the
        // rep comment.
        $listReq = $this->createRequest('GET', '/v1/public/session/' . $this->fx['session_leak_token'] . '/comments');
        $listResp = $app->handle($listReq);
        $listPayload = $this->decode($listResp);

        $this->assertEquals(200, $listResp->getStatusCode());
        $items = $listPayload['data']['items'];
        $this->assertNotEmpty($items);

        foreach ($items as $item) {
            $this->assertSame('doctor', $item['author_type'], 'Public payload must never include a rep-authored row');
            $this->assertFalse($item['can_delete'], 'can_delete must always be false in the public/doctor context');
        }

        $ids = array_column($items, 'id');
        $this->assertContains($doctorCommentId, $ids);
    }

    // -----------------------------------------------------------------
    // T3.11 — Rate limit enforcement, including soft-deleted rows
    // still counting toward the window (anti-bypass).
    // -----------------------------------------------------------------
    public function testRateLimitEnforcedIncludingSoftDeletedRows(): void
    {
        $app = $this->getAppInstance();
        $token = $this->fx['session_rate_token'];

        $createdIds = [];
        for ($i = 1; $i <= 5; $i++) {
            $req = $this->createRequest('POST', '/v1/public/session/' . $token . '/comments')
                ->withParsedBody(['body' => "Rate limit comment #{$i}"]);
            $resp = $app->handle($req);
            $this->assertEquals(201, $resp->getStatusCode(), "Comment #{$i} (within limit) must succeed");
            $createdIds[] = $this->decode($resp)['data']['id'];
        }

        // 6th within the same 60s window must be rejected.
        $overLimitReq = $this->createRequest('POST', '/v1/public/session/' . $token . '/comments')
            ->withParsedBody(['body' => 'Rate limit comment #6 — should be blocked']);
        $overLimitResp = $app->handle($overLimitReq);
        $overLimitPayload = $this->decode($overLimitResp);
        $this->assertEquals(429, $overLimitResp->getStatusCode());
        $this->assertFalse($overLimitPayload['success']);
        $this->assertSame('RATE_LIMIT_EXCEEDED', $overLimitPayload['error']['type']);

        // Rep (session owner) soft-deletes two of the five comments.
        $repToken = $this->jwtFor($app, [
            'id' => $this->fx['rep_a1_id'],
            'email' => 'rep_a1@test.local',
            'name' => 'Rep A1',
            'role' => 'rep',
            'organization_id' => $this->fx['org_a_id'],
        ]);
        foreach (array_slice($createdIds, 0, 2) as $id) {
            $delReq = $this->authedRequest($app, 'DELETE', '/v1/comments/' . $id, $repToken);
            $delResp = $app->handle($delReq);
            $this->assertEquals(200, $delResp->getStatusCode(), 'Setup: rep must be able to delete own-session comments');
        }

        // Posting again must STILL be blocked — soft-deleted rows count.
        $stillBlockedReq = $this->createRequest('POST', '/v1/public/session/' . $token . '/comments')
            ->withParsedBody(['body' => 'Should still be blocked after 2 soft-deletes']);
        $stillBlockedResp = $app->handle($stillBlockedReq);
        $stillBlockedPayload = $this->decode($stillBlockedResp);
        $this->assertEquals(429, $stillBlockedResp->getStatusCode(), 'Soft-deleted rows must still count toward the rate limit');
        $this->assertSame('RATE_LIMIT_EXCEEDED', $stillBlockedPayload['error']['type']);
    }

    // -----------------------------------------------------------------
    // T3.12a — superadmin is denied on every comment route
    // -----------------------------------------------------------------
    public function testSuperadminDeniedFromCommentRoutes(): void
    {
        $app = $this->getAppInstance();
        // No DB row needed: JwtMiddleware only decodes the token, it never
        // looks the user up in the DB, and RoleMiddleware only reads the
        // 'role' claim — so an arbitrary id is sufficient to prove the
        // role gate itself.
        $token = $this->jwtFor($app, [
            'id' => 999999999,
            'email' => 'superadmin@test.local',
            'name' => 'Super Admin',
            'role' => 'superadmin',
            'organization_id' => null,
        ]);

        $listReq = $this->authedRequest($app, 'GET', '/v1/comments', $token, []);
        $listResp = $app->handle($listReq);
        $this->assertEquals(403, $listResp->getStatusCode());

        $postReq = $this->authedRequest($app, 'POST', '/v1/comments', $token)
            ->withParsedBody(['visit_session_id' => $this->fx['session_leak_id'], 'body' => 'should never be allowed']);
        $postResp = $app->handle($postReq);
        $this->assertEquals(403, $postResp->getStatusCode());

        $deleteReq = $this->authedRequest($app, 'DELETE', '/v1/comments/1', $token);
        $deleteResp = $app->handle($deleteReq);
        $this->assertEquals(403, $deleteResp->getStatusCode());
    }

    // -----------------------------------------------------------------
    // T3.12b — Max length -> 422, material-not-in-session -> rejected
    // -----------------------------------------------------------------
    public function testValidationRejectionsMaxLengthAndMaterialNotInSession(): void
    {
        $app = $this->getAppInstance();
        $token = $this->fx['session_val_token'];

        // Over max length (2000) -> 422, no row created.
        $overLength = str_repeat('a', 2001);
        $lengthReq = $this->createRequest('POST', '/v1/public/session/' . $token . '/comments')
            ->withParsedBody(['body' => $overLength]);
        $lengthResp = $app->handle($lengthReq);
        $lengthPayload = $this->decode($lengthResp);
        $this->assertEquals(422, $lengthResp->getStatusCode());
        $this->assertSame('VALIDATION_ERROR', $lengthPayload['error']['type']);

        // Empty body -> 422 as well.
        $emptyReq = $this->createRequest('POST', '/v1/public/session/' . $token . '/comments')
            ->withParsedBody(['body' => '   ']);
        $emptyResp = $app->handle($emptyReq);
        $this->assertEquals(422, $emptyResp->getStatusCode());

        // material_A2 is NOT attached to session_val (only material_A1 is)
        // -> 403, no row created.
        $wrongMaterialReq = $this->createRequest('POST', '/v1/public/session/' . $token . '/comments')
            ->withParsedBody(['body' => 'valid body', 'material_id' => $this->fx['material_a2_id']]);
        $wrongMaterialResp = $app->handle($wrongMaterialReq);
        $wrongMaterialPayload = $this->decode($wrongMaterialResp);
        $this->assertEquals(403, $wrongMaterialResp->getStatusCode());
        $this->assertSame('INSUFFICIENT_PRIVILEGES', $wrongMaterialPayload['error']['type']);

        // Sanity: no comment rows were created on session_val by any of
        // the three rejected attempts above.
        $countStmt = $this->pdo->prepare('SELECT COUNT(*) FROM visit_session_comments WHERE visit_session_id = :sid');
        $countStmt->execute([':sid' => $this->fx['session_val_id']]);
        $this->assertSame(0, (int) $countStmt->fetchColumn());
    }

    // -----------------------------------------------------------------
    // Gap fix — GET /v1/comments response includes doctor/rep/material
    // display names. Covers: doctor-authored comment WITH a material,
    // and a rep-authored OPEN comment (material_id null). The doctor
    // must be present on BOTH rows regardless of author_type, because
    // it is derived from the session (s.doctor_name), never from the
    // comment's own author-conditional doctor_id column. Also verifies
    // `total` stays accurate under the added JOINs, and that the public
    // endpoint gains none of these fields (no rep-identity leak).
    // -----------------------------------------------------------------
    public function testListResponseIncludesDisplayNameEnrichment(): void
    {
        $docCommentId = $this->insertComment(
            $this->fx['session_scope_id'],
            $this->fx['org_a_id'],
            $this->fx['material_a1_id'],
            'doctor',
            null,
            'Doctor comment with material'
        );

        $repCommentId = $this->insertComment(
            $this->fx['session_scope_id'],
            $this->fx['org_a_id'],
            null,
            'rep',
            $this->fx['rep_a1_id'],
            'Rep open comment'
        );

        $app = $this->getAppInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['org_admin_a_id'],
            'email' => 'org_admin_a@test.local',
            'name' => 'Org Admin A',
            'role' => 'org_admin',
            'organization_id' => $this->fx['org_a_id'],
        ]);

        $request = $this->authedRequest($app, 'GET', '/v1/comments', $token, []);
        $response = $app->handle($request);
        $payload = $this->decode($response);

        $this->assertEquals(200, $response->getStatusCode());
        $items = $payload['data']['items'];

        // total/COUNT accuracy under the added JOINs: this fresh org has
        // exactly these 2 comments and nothing else.
        $this->assertSame(2, $payload['data']['total']);
        $this->assertCount(2, $items);

        $byId = [];
        foreach ($items as $item) {
            $byId[$item['id']] = $item;
        }

        $this->assertArrayHasKey($docCommentId, $byId);
        $this->assertArrayHasKey($repCommentId, $byId);
        $docItem = $byId[$docCommentId];
        $repItem = $byId[$repCommentId];

        // Doctor: present on EVERY row regardless of author_type.
        $this->assertSame('Test Doctor', $docItem['doctor_name']);
        $this->assertSame('Test Doctor', $repItem['doctor_name'], 'Doctor must be present even on a rep-authored row');

        // Representative: the session owner's name, on both rows.
        $this->assertSame('Rep A1', $docItem['rep_name']);
        $this->assertSame('Rep A1', $repItem['rep_name']);

        // Author display: doctor-authored -> doctor's name; rep-authored ->
        // the author's own name.
        $this->assertSame('Test Doctor', $docItem['author_name']);
        $this->assertSame('Rep A1', $repItem['author_name']);

        // Material: present with the material's title when material_id is
        // set; explicitly present-but-null (not absent) when open/general.
        $this->assertArrayHasKey('material_title', $docItem);
        $this->assertStringContainsString('Material A1', $docItem['material_title']);
        $this->assertArrayHasKey('material_title', $repItem);
        $this->assertNull($repItem['material_title']);

        // IDs are NOT removed — the frontend still uses them for filtering.
        $this->assertSame($this->fx['material_a1_id'], $docItem['material_id']);
        $this->assertNull($repItem['material_id']);

        // The public endpoint must gain NONE of these fields — no
        // rep-identity (or any new) leak into the unauthenticated surface.
        $publicReq = $this->createRequest('GET', '/v1/public/session/' . $this->fx['session_scope_token'] . '/comments');
        $publicResp = $app->handle($publicReq);
        $publicPayload = $this->decode($publicResp);

        $this->assertEquals(200, $publicResp->getStatusCode());
        $this->assertNotEmpty($publicPayload['data']['items']);
        foreach ($publicPayload['data']['items'] as $pubItem) {
            $this->assertArrayNotHasKey('rep_name', $pubItem);
            $this->assertArrayNotHasKey('doctor_name', $pubItem);
            $this->assertArrayNotHasKey('material_title', $pubItem);
            $this->assertArrayNotHasKey('author_name', $pubItem);
        }
    }

    // -----------------------------------------------------------------
    // Regression — doctor_id filter must resolve against the SESSION's
    // doctor (visit_sessions.doctor_id), not the comment row's own
    // author-conditional doctor_id column. Before the fix, this filter
    // used `c.doctor_id = :f_doctor_id`, which is hardcoded NULL on every
    // rep-authored row (CreateCommentAction) — so a rep-authored comment
    // about a doctor would be silently EXCLUDED from doctor_id-filtered
    // results, even though it plainly belongs to that doctor's visit.
    // This test also exercises q / has_material / date_from / date_to
    // with real requests, per the verification scope.
    // -----------------------------------------------------------------
    public function testDoctorIdFilterResolvesAgainstSessionDoctorNotCommentAuthor(): void
    {
        // Create a real doctors row and attach it to session_scope as the
        // session's doctor (visit_sessions.doctor_id), independent of the
        // legacy denormalized doctor_name already set by insertVisitSession.
        $doctorId = $this->insertDoctor($this->fx['org_a_id'], 'Filter Test Doctor');
        $this->pdo->prepare('UPDATE visit_sessions SET doctor_id = :did WHERE id = :sid')
            ->execute([':did' => $doctorId, ':sid' => $this->fx['session_scope_id']]);

        // A doctor-authored comment WITH a material (c.doctor_id IS set by
        // CreatePublicCommentAction in real traffic; here inserted directly
        // to isolate the filter from creation-path behavior) ...
        $docCommentId = $this->insertComment(
            $this->fx['session_scope_id'],
            $this->fx['org_a_id'],
            $this->fx['material_a1_id'],
            'doctor',
            null,
            'unique-marker-doctor-comment-body'
        );

        // ... and a REP-authored OPEN comment on the SAME session. This is
        // exactly the row that would be silently dropped by the old
        // `c.doctor_id = :f_doctor_id` predicate, since c.doctor_id is
        // hardcoded NULL for rep-authored rows.
        $repCommentId = $this->insertComment(
            $this->fx['session_scope_id'],
            $this->fx['org_a_id'],
            null,
            'rep',
            $this->fx['rep_a1_id'],
            'rep authored comment about the same doctor visit'
        );

        // Unrelated comment on a DIFFERENT session (no doctor_id set) must
        // never appear in doctor_id-filtered results.
        $this->insertComment(
            $this->fx['session_leak_id'],
            $this->fx['org_a_id'],
            null,
            'doctor',
            null,
            'unrelated comment on a different session'
        );

        $app = $this->getAppInstance();
        $token = $this->jwtFor($app, [
            'id' => $this->fx['org_admin_a_id'],
            'email' => 'org_admin_a@test.local',
            'name' => 'Org Admin A',
            'role' => 'org_admin',
            'organization_id' => $this->fx['org_a_id'],
        ]);

        try {
            // --- doctor_id filter: must return BOTH rows (doctor + rep) ---
            $request = $this->authedRequest($app, 'GET', '/v1/comments', $token, [
                'doctor_id' => (string) $doctorId,
            ]);
            $response = $app->handle($request);
            $payload = $this->decode($response);

            $this->assertEquals(200, $response->getStatusCode());
            $this->assertSame(2, $payload['data']['total'], 'doctor_id filter must match COUNT exactly');
            $ids = array_column($payload['data']['items'], 'id');
            $this->assertContains($docCommentId, $ids, 'doctor-authored comment must be included');
            $this->assertContains(
                $repCommentId,
                $ids,
                'THE BUG: rep-authored comment must be included — the doctor identifies the VISIT, not the comment author'
            );

            // --- q filter: matches comment body substring ---
            $qRequest = $this->authedRequest($app, 'GET', '/v1/comments', $token, [
                'q' => 'unique-marker-doctor-comment',
            ]);
            $qResponse = $app->handle($qRequest);
            $qPayload = $this->decode($qResponse);
            $this->assertEquals(200, $qResponse->getStatusCode());
            $this->assertSame(1, $qPayload['data']['total']);
            $this->assertSame($docCommentId, $qPayload['data']['items'][0]['id']);

            // --- has_material filter: true -> only the material-scoped row ---
            $hasMatTrueRequest = $this->authedRequest($app, 'GET', '/v1/comments', $token, [
                'doctor_id' => (string) $doctorId,
                'has_material' => 'true',
            ]);
            $hasMatTrueResponse = $app->handle($hasMatTrueRequest);
            $hasMatTruePayload = $this->decode($hasMatTrueResponse);
            $this->assertSame(1, $hasMatTruePayload['data']['total']);
            $this->assertSame($docCommentId, $hasMatTruePayload['data']['items'][0]['id']);

            // --- has_material filter: false -> only the open/general row ---
            $hasMatFalseRequest = $this->authedRequest($app, 'GET', '/v1/comments', $token, [
                'doctor_id' => (string) $doctorId,
                'has_material' => 'false',
            ]);
            $hasMatFalseResponse = $app->handle($hasMatFalseRequest);
            $hasMatFalsePayload = $this->decode($hasMatFalseResponse);
            $this->assertSame(1, $hasMatFalsePayload['data']['total']);
            $this->assertSame($repCommentId, $hasMatFalsePayload['data']['items'][0]['id']);

            // --- date_from/date_to: inclusive of "today" (created_at defaults to NOW()) ---
            //
            // IMPORTANT: `date_from`/`date_to` are interpreted by the
            // repository as ORG-LOCAL calendar dates (see OrgDateRange —
            // Phase 3 of org-timezone), converted to UTC bounds using the
            // fixture organization's timezone. insertOrganization() never
            // sets an explicit timezone, so these fixture orgs use the
            // schema DEFAULT, which is TimezoneConfig::DEFAULT_ZONE
            // ('America/Santiago'). "Today" must therefore be computed in
            // THAT zone, not in PHP's process timezone (pinned to UTC in
            // tests/bootstrap.php) — otherwise, near UTC midnight, "today
            // in UTC" and "today in Santiago" can be different calendar
            // days (they diverge by the zone's UTC offset, up to 4h), and
            // a comment inserted moments ago would fall outside the
            // computed org-local window. Using the same zone here that the
            // repository uses to interpret the filter makes this assertion
            // correct at every hour of the day, not just outside that
            // divergence window.
            $today = (new DateTimeImmutable('now', new DateTimeZone(TimezoneConfig::DEFAULT_ZONE)))
                ->format('Y-m-d');
            $dateRequest = $this->authedRequest($app, 'GET', '/v1/comments', $token, [
                'doctor_id' => (string) $doctorId,
                'date_from' => $today,
                'date_to' => $today,
            ]);
            $dateResponse = $app->handle($dateRequest);
            $datePayload = $this->decode($dateResponse);
            $this->assertSame(2, $datePayload['data']['total'], 'Inclusive date range on today must include both rows created just now');

            // --- date range excluding today must yield 0 ---
            $pastRequest = $this->authedRequest($app, 'GET', '/v1/comments', $token, [
                'doctor_id' => (string) $doctorId,
                'date_from' => '2000-01-01',
                'date_to' => '2000-01-02',
            ]);
            $pastResponse = $app->handle($pastRequest);
            $pastPayload = $this->decode($pastResponse);
            $this->assertSame(0, $pastPayload['data']['total']);
        } finally {
            // Release the FK before tearDown() deletes the session, then
            // remove the extra doctors row this test created.
            $this->pdo->prepare('UPDATE visit_sessions SET doctor_id = NULL WHERE id = :sid')
                ->execute([':sid' => $this->fx['session_scope_id']]);
            $this->pdo->prepare('DELETE FROM doctors WHERE id = :id')->execute([':id' => $doctorId]);
        }
    }

    // ===================================================================
    // Fixture helpers
    // ===================================================================

    private function createFixtures(): array
    {
        $suffix = uniqid('cmt_', true);

        $orgAId = $this->insertOrganization("Test Org A {$suffix}");
        $orgBId = $this->insertOrganization("Test Org B {$suffix}");

        $orgAdminAId = $this->insertUser($orgAId, 'org_admin', "org_admin_a_{$suffix}@test.local", 'Org Admin A');
        $managerA1Id = $this->insertUser($orgAId, 'manager', "manager_a1_{$suffix}@test.local", 'Manager A1');
        $managerA2Id = $this->insertUser($orgAId, 'manager', "manager_a2_{$suffix}@test.local", 'Manager A2');
        $repA1Id     = $this->insertUser($orgAId, 'rep', "rep_a1_{$suffix}@test.local", 'Rep A1');
        $managerB1Id = $this->insertUser($orgBId, 'manager', "manager_b1_{$suffix}@test.local", 'Manager B1');
        $repB1Id     = $this->insertUser($orgBId, 'rep', "rep_b1_{$suffix}@test.local", 'Rep B1');

        $brandAId = $this->insertBrand($orgAId, "Brand A {$suffix}");
        $brandBId = $this->insertBrand($orgBId, "Brand B {$suffix}");

        $materialA1Id = $this->insertMaterial($orgAId, $brandAId, $managerA1Id, "Material A1 {$suffix}");
        $materialA2Id = $this->insertMaterial($orgAId, $brandAId, $managerA2Id, "Material A2 {$suffix}");
        $materialB1Id = $this->insertMaterial($orgBId, $brandBId, $managerB1Id, "Material B1 {$suffix}");

        [$sessionScopeId, $sessionScopeToken] = $this->insertVisitSession($orgAId, $repA1Id, $suffix . '_scope');
        [$sessionCascadeId, $sessionCascadeToken] = $this->insertVisitSession($orgAId, $repA1Id, $suffix . '_cascade');
        [$sessionLeakId, $sessionLeakToken] = $this->insertVisitSession($orgAId, $repA1Id, $suffix . '_leak');
        [$sessionRateId, $sessionRateToken] = $this->insertVisitSession($orgAId, $repA1Id, $suffix . '_rate');
        [$sessionValId, $sessionValToken] = $this->insertVisitSession($orgAId, $repA1Id, $suffix . '_val');
        [$sessionOrgBId, $sessionOrgBToken] = $this->insertVisitSession($orgBId, $repB1Id, $suffix . '_orgb');

        $this->insertSessionMaterial($sessionCascadeId, $materialA1Id);
        $this->insertSessionMaterial($sessionValId, $materialA1Id);

        return [
            'org_a_id' => $orgAId,
            'org_b_id' => $orgBId,
            'org_admin_a_id' => $orgAdminAId,
            'manager_a1_id' => $managerA1Id,
            'manager_a2_id' => $managerA2Id,
            'rep_a1_id' => $repA1Id,
            'manager_b1_id' => $managerB1Id,
            'rep_b1_id' => $repB1Id,
            'brand_a_id' => $brandAId,
            'brand_b_id' => $brandBId,
            'material_a1_id' => $materialA1Id,
            'material_a2_id' => $materialA2Id,
            'material_b1_id' => $materialB1Id,
            'session_scope_id' => $sessionScopeId,
            'session_scope_token' => $sessionScopeToken,
            'session_cascade_id' => $sessionCascadeId,
            'session_cascade_token' => $sessionCascadeToken,
            'session_leak_id' => $sessionLeakId,
            'session_leak_token' => $sessionLeakToken,
            'session_rate_id' => $sessionRateId,
            'session_rate_token' => $sessionRateToken,
            'session_val_id' => $sessionValId,
            'session_val_token' => $sessionValToken,
            'session_org_b_id' => $sessionOrgBId,
            'session_org_b_token' => $sessionOrgBToken,
        ];
    }

    private function destroyFixtures(array $fx): void
    {
        if (empty($fx)) {
            return;
        }

        $sessionIds = [
            $fx['session_scope_id'], $fx['session_cascade_id'], $fx['session_leak_id'],
            $fx['session_rate_id'], $fx['session_val_id'], $fx['session_org_b_id'],
        ];

        $this->deleteWhereIn('visit_session_comments', 'visit_session_id', $sessionIds);
        $this->deleteWhereIn('visit_session_materials', 'visit_session_id', $sessionIds);
        $this->deleteWhereIn('visit_sessions', 'id', $sessionIds);
        $this->deleteWhereIn('materials', 'id', [$fx['material_a1_id'], $fx['material_a2_id'], $fx['material_b1_id']]);
        $this->deleteWhereIn('brands', 'id', [$fx['brand_a_id'], $fx['brand_b_id']]);
        $this->deleteWhereIn('users', 'id', [
            $fx['org_admin_a_id'], $fx['manager_a1_id'], $fx['manager_a2_id'],
            $fx['rep_a1_id'], $fx['manager_b1_id'], $fx['rep_b1_id'],
        ]);
        $this->deleteWhereIn('organizations', 'id', [$fx['org_a_id'], $fx['org_b_id']]);
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

    private function insertDoctor(int $organizationId, string $name): int
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO doctors (organization_id, name, active) VALUES (:org_id, :name, 1)'
        );
        $stmt->execute([':org_id' => $organizationId, ':name' => $name]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertBrand(int $organizationId, string $name): int
    {
        $stmt = $this->pdo->prepare('INSERT INTO brands (organization_id, name, active) VALUES (:org_id, :name, 1)');
        $stmt->execute([':org_id' => $organizationId, ':name' => $name]);
        return (int) $this->pdo->lastInsertId();
    }

    private function insertMaterial(int $organizationId, int $brandId, int $managerId, string $title): int
    {
        $stmt = $this->pdo->prepare(
            "INSERT INTO materials (organization_id, brand_id, manager_id, title, type, status, external_url)
             VALUES (:org_id, :brand_id, :manager_id, :title, 'link', 'approved', 'https://example.test/resource')"
        );
        $stmt->execute([
            ':org_id' => $organizationId,
            ':brand_id' => $brandId,
            ':manager_id' => $managerId,
            ':title' => $title,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    /** @return array{0:int,1:string} [sessionId, doctorToken] */
    private function insertVisitSession(int $organizationId, int $repId, string $tokenSeed): array
    {
        $token = 'test-token-' . preg_replace('/[^a-zA-Z0-9]/', '', $tokenSeed) . '-' . bin2hex(random_bytes(8));
        $stmt = $this->pdo->prepare(
            'INSERT INTO visit_sessions (organization_id, rep_id, doctor_token, doctor_name, notes, active)
             VALUES (:org_id, :rep_id, :token, :doctor_name, NULL, 1)'
        );
        $stmt->execute([
            ':org_id' => $organizationId,
            ':rep_id' => $repId,
            ':token' => $token,
            ':doctor_name' => 'Test Doctor',
        ]);
        return [(int) $this->pdo->lastInsertId(), $token];
    }

    private function insertSessionMaterial(int $sessionId, int $materialId): void
    {
        $stmt = $this->pdo->prepare(
            'INSERT INTO visit_session_materials (visit_session_id, material_id, sort_order) VALUES (:sid, :mid, 0)'
        );
        $stmt->execute([':sid' => $sessionId, ':mid' => $materialId]);
    }

    private function insertComment(
        int $sessionId,
        int $organizationId,
        ?int $materialId,
        string $authorType,
        ?int $authorUserId,
        string $body
    ): int {
        $stmt = $this->pdo->prepare(
            'INSERT INTO visit_session_comments
                (visit_session_id, material_id, organization_id, parent_id, author_type, author_user_id, doctor_id, body, active)
             VALUES
                (:sid, :mid, :org_id, NULL, :author_type, :author_user_id, NULL, :body, 1)'
        );
        $stmt->execute([
            ':sid' => $sessionId,
            ':mid' => $materialId,
            ':org_id' => $organizationId,
            ':author_type' => $authorType,
            ':author_user_id' => $authorUserId,
            ':body' => $body,
        ]);
        return (int) $this->pdo->lastInsertId();
    }

    // ===================================================================
    // HTTP / JWT helpers
    // ===================================================================

    private function jwtFor(App $app, array $user): string
    {
        /** @var Container $container */
        $container = $app->getContainer();
        return $container->get(JwtServiceInterface::class)->generate($user);
    }

    private function authedRequest(App $app, string $method, string $path, string $bearerToken, array $queryParams = []): Request
    {
        $request = $this->createRequest($method, $path, [
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_AUTHORIZATION' => 'Bearer ' . $bearerToken,
        ]);

        if (!empty($queryParams)) {
            $request = $request->withUri($request->getUri()->withQuery(http_build_query($queryParams)));
        }

        return $request;
    }

    private function decode(\Psr\Http\Message\ResponseInterface $response): array
    {
        return json_decode((string) $response->getBody(), true) ?? [];
    }
}
