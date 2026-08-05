<?php

declare(strict_types=1);

namespace App\Infrastructure\Region;

/**
 * Backend mirror of frontend/src/data/chileGeo.ts CHILE_REGIONS names, plus
 * accent/case-insensitive + alias normalization.
 *
 * WHY this exists (sdd/doctors-management-fixes): bulk Kardex imports write
 * raw, unvalidated `Región` strings (roman-numeral codes, abbreviated names,
 * missing accents, "RM", etc.) while the /doctors UI filters on these exact
 * canonical names — a doctor whose region isn't byte-for-byte identical to
 * one of these 16 strings silently never matches the region filter. Every
 * write path (import, Create/UpdateDoctorAction) MUST normalize through
 * self::normalizeRegion() before persisting, per spec §"Canonical Region
 * Diagnostic & Normalization".
 *
 * IMPORTANT: keep CANONICAL_REGIONS in sync with frontend/src/data/chileGeo.ts
 * CHILE_REGIONS — there is no shared-package mechanism in this repo, so this
 * list is intentionally duplicated (documented here, not auto-generated).
 */
class RegionCatalog
{
    public const CANONICAL_REGIONS = [
        'Arica y Parinacota',
        'Tarapacá',
        'Antofagasta',
        'Atacama',
        'Coquimbo',
        'Valparaíso',
        'Metropolitana de Santiago',
        "Libertador General Bernardo O'Higgins",
        'Maule',
        'Ñuble',
        'Biobío',
        'La Araucanía',
        'Los Ríos',
        'Los Lagos',
        'Aysén del General Carlos Ibáñez del Campo',
        'Magallanes y de la Antártica Chilena',
    ];

    /**
     * Alias key => canonical CHILE_REGIONS name. Keys are matched AFTER
     * self::fold() (accent-stripped, lowercased, whitespace-collapsed), so
     * write each key already in that folded form.
     *
     * Covers: roman-numeral region codes (the pre-2007 official numbering,
     * still common in legacy spreadsheets/Kardex exports), "RM", and common
     * abbreviated/partial names seen in real import data.
     */
    private const ALIASES = [
        // Roman-numeral region codes (I-XVI + RM), the numbering scheme most
        // Chilean administrative spreadsheets still use instead of the name.
        'i' => 'Tarapacá',
        'ii' => 'Antofagasta',
        'iii' => 'Atacama',
        'iv' => 'Coquimbo',
        'v' => 'Valparaíso',
        'vi' => "Libertador General Bernardo O'Higgins",
        'vii' => 'Maule',
        'viii' => 'Biobío',
        'ix' => 'La Araucanía',
        'x' => 'Los Lagos',
        'xi' => 'Aysén del General Carlos Ibáñez del Campo',
        'xii' => 'Magallanes y de la Antártica Chilena',
        'xiii' => 'Metropolitana de Santiago',
        'xiv' => 'Los Ríos',
        'xv' => 'Arica y Parinacota',
        'xvi' => 'Ñuble',
        'rm' => 'Metropolitana de Santiago',

        // Abbreviated / partial names commonly seen in Kardex exports.
        'metropolitana' => 'Metropolitana de Santiago',
        'region metropolitana' => 'Metropolitana de Santiago',
        'santiago' => 'Metropolitana de Santiago',
        'ohiggins' => "Libertador General Bernardo O'Higgins",
        'o higgins' => "Libertador General Bernardo O'Higgins",
        'libertador ohiggins' => "Libertador General Bernardo O'Higgins",
        'libertador bernardo ohiggins' => "Libertador General Bernardo O'Higgins",
        'bio bio' => 'Biobío',
        'biobio' => 'Biobío',
        'araucania' => 'La Araucanía',
        'la araucania' => 'La Araucanía',
        'los rios' => 'Los Ríos',
        'los lagos' => 'Los Lagos',
        'aysen' => 'Aysén del General Carlos Ibáñez del Campo',
        'aysen del general carlos ibanez del campo' => 'Aysén del General Carlos Ibáñez del Campo',
        'magallanes' => 'Magallanes y de la Antártica Chilena',
        'magallanes y antartica' => 'Magallanes y de la Antártica Chilena',
        'magallanes y antartica chilena' => 'Magallanes y de la Antártica Chilena',
        'nuble' => 'Ñuble',
        'tarapaca' => 'Tarapacá',
        'valparaiso' => 'Valparaíso',
        'arica y parinacota' => 'Arica y Parinacota',
    ];

    /** @var array<string, string>|null lazy-built folded-canonical => canonical map */
    private static ?array $foldedCanonicalMap = null;

    /**
     * Returns the canonical CHILE_REGIONS name for $raw (case/accent/
     * whitespace-insensitive, alias-aware), or null when $raw is empty OR
     * matches no canonical value/alias ("unmappable" — callers MUST treat
     * null as "reject or flag", never silently store the raw string).
     */
    public static function normalizeRegion(?string $raw): ?string
    {
        $trimmed = trim((string) $raw);
        if ($trimmed === '') {
            return null;
        }

        $folded = self::fold($trimmed);

        $canonicalMap = self::foldedCanonicalMap();
        if (isset($canonicalMap[$folded])) {
            return $canonicalMap[$folded];
        }

        if (isset(self::ALIASES[$folded])) {
            return self::ALIASES[$folded];
        }

        // Also try stripping a leading "region de "/"región de " prefix,
        // e.g. "Región de Valparaíso" -> "valparaiso".
        $withoutPrefix = preg_replace('/^region(\s+de)?\s+/', '', $folded) ?? $folded;
        if ($withoutPrefix !== $folded) {
            if (isset($canonicalMap[$withoutPrefix])) {
                return $canonicalMap[$withoutPrefix];
            }
            if (isset(self::ALIASES[$withoutPrefix])) {
                return self::ALIASES[$withoutPrefix];
            }
        }

        return null;
    }

    /** @return array<string, string> */
    private static function foldedCanonicalMap(): array
    {
        if (self::$foldedCanonicalMap === null) {
            $map = [];
            foreach (self::CANONICAL_REGIONS as $canonical) {
                $map[self::fold($canonical)] = $canonical;
            }
            self::$foldedCanonicalMap = $map;
        }

        return self::$foldedCanonicalMap;
    }

    /**
     * Accent-strip + lowercase + strip apostrophes/punctuation + collapse/
     * trim whitespace, so "Región  " vs "region" vs "REGIÓN" vs "O'Higgins"
     * vs "OHiggins" all fold to the same comparison key.
     */
    private static function fold(string $s): string
    {
        $s = self::removeAccents($s);
        $s = mb_strtolower($s, 'UTF-8');
        $s = str_replace(["'", "’", '`'], '', $s);
        $s = trim(preg_replace('/\s+/', ' ', $s) ?? $s);
        return $s;
    }

    private static function removeAccents(string $s): string
    {
        static $map = [
            'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a',
            'Á' => 'A', 'À' => 'A', 'Ä' => 'A', 'Â' => 'A', 'Ã' => 'A',
            'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
            'É' => 'E', 'È' => 'E', 'Ë' => 'E', 'Ê' => 'E',
            'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i',
            'Í' => 'I', 'Ì' => 'I', 'Ï' => 'I', 'Î' => 'I',
            'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o',
            'Ó' => 'O', 'Ò' => 'O', 'Ö' => 'O', 'Ô' => 'O', 'Õ' => 'O',
            'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u',
            'Ú' => 'U', 'Ù' => 'U', 'Ü' => 'U', 'Û' => 'U',
            'ñ' => 'n', 'Ñ' => 'N', 'ç' => 'c', 'Ç' => 'C',
        ];
        return strtr($s, $map);
    }
}
