<?php

declare(strict_types=1);

namespace Tests\Application\Actions\Comment;

use Tests\TestCase;

/**
 * Pins the EXACT set of registered comment route patterns (method + path).
 *
 * Why this exists: CRITICAL-1 in sdd/visit-comments/verify-report — the
 * frontend service layer (frontend/src/services/comments.ts) hardcoded a
 * POST path (`/public/visit-session/{token}/comments`) that never matched
 * any registered backend route (`/public/session/{token}/comments`),
 * causing a silent 404 in production for every public doctor comment
 * submission. `tsc --noEmit` and `npm run build` cannot catch a route
 * STRING mismatch (paths are just strings to TypeScript), and the existing
 * PHPUnit tests call routes directly via TestCase::createRequest(),
 * bypassing the frontend entirely, so nothing failed.
 *
 * This test does NOT close that gap by itself — it cannot see the
 * frontend at all, so a frontend-only typo introduced with no
 * corresponding backend change will still pass this test. What it DOES
 * guarantee: the moment anyone renames, removes, or restructures a
 * comment route in routes.php, this test fails loudly and immediately,
 * forcing a deliberate look at every consumer (frontend included)
 * instead of a route drifting silently. It is intentionally cheap (no DB
 * fixtures, no HTTP dispatch) — it only inspects the registered
 * RouteCollector, using APIs Slim already exposes and PHPUnit already
 * installed. No new dependency was added.
 *
 * See verify report + apply-progress for the full audit and the honest
 * statement that a REAL cross-boundary guard (e.g. a frontend
 * integration/contract test that actually dispatches
 * `services/comments.ts` calls against the live route table) would
 * require adding a test runner the frontend does not currently have
 * (no vitest/jest/playwright in frontend/package.json).
 */
class CommentRouteRegistrationTest extends TestCase
{
    public function testExactSetOfCommentRoutePatternsIsRegistered(): void
    {
        $app = $this->getAppInstance();

        $actual = [];
        foreach ($app->getRouteCollector()->getRoutes() as $route) {
            foreach ($route->getMethods() as $method) {
                $actual[] = $method . ' ' . $route->getPattern();
            }
        }

        $expected = [
            // Authenticated (JWT + CommentAccessConfig) comment routes.
            'GET /v1/comments',
            'POST /v1/comments',
            'DELETE /v1/comments/{id}',
            // Public (token-authenticated, no JWT) doctor comment routes.
            'GET /v1/public/session/{token}/comments',
            'POST /v1/public/session/{token}/comments',
        ];

        foreach ($expected as $pattern) {
            $this->assertContains(
                $pattern,
                $actual,
                "Expected comment route pattern '{$pattern}' is not registered. " .
                'If this route was intentionally renamed, update frontend/src/services/comments.ts ' .
                'to match, then update the $expected list in this test.'
            );
        }

        // The exact bug from CRITICAL-1: guard against this specific wrong
        // path ever becoming a real (or re-becoming a stale-but-passing)
        // route pattern, so a future "fix the backend to match the
        // frontend" mistake is caught too.
        $this->assertNotContains(
            'POST /v1/public/visit-session/{token}/comments',
            $actual,
            'The buggy path from CRITICAL-1 must never be a registered route ' .
            '— the frontend should be fixed to call the existing route, not vice versa.'
        );
    }
}
