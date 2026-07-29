<?php

declare(strict_types=1);

namespace App\Infrastructure\Config;

class CommentAccessConfig
{
    /**
     * Roles allowed to list comments via GET /v1/comments.
     * `superadmin` is deliberately EXCLUDED from this feature (locked
     * product decision) — do not add it here.
     */
    public const LIST_ROLES = ['org_admin', 'manager', 'rep'];

    /**
     * Roles allowed to soft-delete a comment via DELETE /v1/comments/{id}.
     *
     * Kept as a SEPARATE constant from LIST_ROLES even though the values
     * are currently identical. This is intentional future-proofing: list
     * access and delete access are different concerns and may diverge
     * later (e.g. if rep delete permission is ever restricted while list
     * access remains), mirroring the DoctorAccessConfig pattern where
     * MANAGE_ROLES and DELETE_ROLES are independently maintained.
     */
    public const DELETE_ROLES = ['org_admin', 'manager', 'rep'];
}
