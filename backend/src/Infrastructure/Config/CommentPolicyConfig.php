<?php

declare(strict_types=1);

namespace App\Infrastructure\Config;

class CommentPolicyConfig
{
    /**
     * Maximum allowed length (in characters) for a comment body. Enforced
     * in the Action layer BEFORE insert so violations return a clean 422
     * rather than relying on DB TEXT-column truncation.
     */
    public const MAX_COMMENT_LENGTH = 2000;

    /**
     * Maximum number of comments a single visit-session token may post
     * within RATE_WINDOW_SECONDS. First anti-abuse control on a public,
     * unauthenticated, free-text write surface.
     */
    public const RATE_LIMIT_PER_MINUTE = 5;

    /**
     * Rolling look-back window (seconds) for the public POST rate limit.
     * `created_at > NOW() - INTERVAL RATE_WINDOW_SECONDS SECOND` — a
     * sliding count, not a bucketed fixed window, so there is no boundary
     * burst-doubling.
     */
    public const RATE_WINDOW_SECONDS = 60;
}
