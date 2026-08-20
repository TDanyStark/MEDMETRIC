<?php

declare(strict_types=1);

namespace App\Infrastructure\Support;

/**
 * Classifies a raw `user_agent` string into a coarse 'mobile'/'desktop'
 * bucket, server-side, so the rep-scoped metrics module (sdd/rep-metrics-module)
 * can expose a device split WITHOUT ever returning the raw `user_agent`
 * value to the client (spec "Doctor Privacy": ip_address/user_agent crudos
 * MUST NOT exponerse en /v1/rep/metrics/*, solo device_type derivado).
 *
 * Pure / stateless / static — no PDO, no I/O — so it is trivial to unit
 * test in isolation and safe to call from any layer (mirrors
 * App\Infrastructure\Support\RepAttribution / OrgDateRange in that regard).
 *
 * Tablets (iPad, Android tablets) are deliberately classified as 'mobile':
 * the product question this answers is "did the doctor view this on a
 * handheld device during the visit vs. at a desk afterwards", and a
 * three-way mobile/tablet/desktop split is out of scope for the MVP
 * (design "Open Questions" — device regex kept as a dedicated class for
 * exactly this kind of future extension without touching call sites).
 */
final class DeviceClassifier
{
    /**
     * Regex covering the common mobile/tablet UA tokens across iOS,
     * Android, Windows Phone and legacy mobile browsers. Case-insensitive
     * because UA casing is not standardized (e.g. "Mobile" vs "mobile").
     */
    private const MOBILE_PATTERN = '/Mobi|Android|iPhone|iPad|iPod|Windows Phone|IEMobile|BlackBerry|BB10|Opera Mini|Opera Mobi/i';

    /**
     * @param string|null $userAgent Raw `user_agent` value (may be null/empty
     *   when the browser sent no header, or the row predates UA capture).
     * @return 'mobile'|'desktop' A missing/unrecognized UA defaults to
     *   'desktop' — the conservative choice for a metric whose stated
     *   purpose is to surface handheld/on-the-go doctor engagement,
     *   so an absent signal must never be counted as a false positive.
     */
    public static function classify(?string $userAgent): string
    {
        if ($userAgent === null || trim($userAgent) === '') {
            return 'desktop';
        }

        return preg_match(self::MOBILE_PATTERN, $userAgent) === 1 ? 'mobile' : 'desktop';
    }
}
