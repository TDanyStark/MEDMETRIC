<?php

declare(strict_types=1);

namespace App\Infrastructure\Config;

class DoctorAccessConfig
{
    /**
     * Roles allowed to access the /v1/doctors endpoints (search/list/create/update).
     * Remove a role from this array to disable its access without touching routes.php.
     */
    public const MANAGE_ROLES = ['org_admin', 'manager', 'rep'];

    /**
     * Roles allowed to delete (soft-delete) a doctor. Kept separate and more
     * restrictive than MANAGE_ROLES since deletion affects shared directory data.
     */
    public const DELETE_ROLES = ['org_admin'];
}
