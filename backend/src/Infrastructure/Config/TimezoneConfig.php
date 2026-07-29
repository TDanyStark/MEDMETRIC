<?php

declare(strict_types=1);

namespace App\Infrastructure\Config;

class TimezoneConfig
{
    /**
     * Fallback IANA identifier used when an organization's timezone
     * cannot be resolved (e.g. a caller with no organization_id, or a
     * lookup miss). Mirrors the DB column default set in migration
     * `022_add_timezone_to_organizations.sql` so the app-level fallback
     * and the schema-level default never drift apart.
     */
    public const DEFAULT_ZONE = 'America/Santiago';

    /**
     * Curated allow-list of IANA timezone identifiers offered to
     * organizations, focused on the markets MEDMETRIC currently operates
     * in (LATAM) instead of exposing all ~600 IANA zones.
     *
     * Single source of truth for:
     * - Backend validation (CreateOrganizationAction / UpdateOrganizationAction)
     * - The frontend timezone selector, served via GET /v1/timezones
     *
     * Keep in sync with App\Infrastructure\Support\OrgDateRange::isValid(),
     * which additionally accepts any identifier known to PHP's tzdata as a
     * defense-in-depth check (this list is the UX-facing subset, not the
     * full validation boundary).
     */
    public const LATAM_ZONES = [
        'America/Santiago',      // Chile (primary market)
        'America/Bogota',        // Colombia
        'America/Mexico_City',   // Mexico
        'America/Lima',          // Peru
        'America/Buenos_Aires',  // Argentina
        'America/Sao_Paulo',     // Brazil
        'America/Montevideo',    // Uruguay
        'America/Asuncion',      // Paraguay
        'America/La_Paz',        // Bolivia
        'America/Guayaquil',     // Ecuador
        'America/Caracas',       // Venezuela
        'America/Panama',        // Panama, Central America (no DST)
    ];
}
