<?php

declare(strict_types=1);

namespace Tests\Unit\Infrastructure\Region;

use App\Infrastructure\Region\RegionCatalog;
use PHPUnit\Framework\TestCase;

/**
 * Phase 8 (T8.1) — sdd/doctors-management-fixes spec §"Canonical Region
 * Diagnostic & Normalization": normalizeRegion() must be case/accent-
 * insensitive, alias-aware (roman-numeral codes + common abbreviations
 * seen in real Kardex data), and return null (never a guessed/raw value)
 * for anything unmappable.
 */
class RegionCatalogTest extends TestCase
{
    public function testExactCanonicalNamePassesThrough(): void
    {
        foreach (RegionCatalog::CANONICAL_REGIONS as $canonical) {
            $this->assertSame($canonical, RegionCatalog::normalizeRegion($canonical));
        }
    }

    public function testCaseInsensitive(): void
    {
        $this->assertSame('Valparaíso', RegionCatalog::normalizeRegion('VALPARAÍSO'));
        $this->assertSame('Valparaíso', RegionCatalog::normalizeRegion('valparaíso'));
    }

    public function testAccentInsensitive(): void
    {
        $this->assertSame('Valparaíso', RegionCatalog::normalizeRegion('Valparaiso'));
        $this->assertSame('Tarapacá', RegionCatalog::normalizeRegion('Tarapaca'));
        $this->assertSame('Biobío', RegionCatalog::normalizeRegion('Biobio'));
        $this->assertSame('Los Ríos', RegionCatalog::normalizeRegion('Los Rios'));
        $this->assertSame('La Araucanía', RegionCatalog::normalizeRegion('La Araucania'));
        $this->assertSame('Ñuble', RegionCatalog::normalizeRegion('Nuble'));
    }

    public function testWhitespaceIsCollapsedAndTrimmed(): void
    {
        $this->assertSame('Valparaíso', RegionCatalog::normalizeRegion('  Valparaíso   '));
        $this->assertSame('Metropolitana de Santiago', RegionCatalog::normalizeRegion('Metropolitana   de    Santiago'));
    }

    public function testRomanNumeralRegionCodes(): void
    {
        $this->assertSame('Tarapacá', RegionCatalog::normalizeRegion('I'));
        $this->assertSame('Antofagasta', RegionCatalog::normalizeRegion('II'));
        $this->assertSame('Metropolitana de Santiago', RegionCatalog::normalizeRegion('XIII'));
        $this->assertSame('Metropolitana de Santiago', RegionCatalog::normalizeRegion('RM'));
        $this->assertSame('Ñuble', RegionCatalog::normalizeRegion('xvi'));
    }

    public function testCommonAbbreviatedAliases(): void
    {
        $this->assertSame('Metropolitana de Santiago', RegionCatalog::normalizeRegion('Metropolitana'));
        $this->assertSame("Libertador General Bernardo O'Higgins", RegionCatalog::normalizeRegion("O'Higgins"));
        $this->assertSame("Libertador General Bernardo O'Higgins", RegionCatalog::normalizeRegion('OHiggins'));
        $this->assertSame('Biobío', RegionCatalog::normalizeRegion('Bio Bio'));
        $this->assertSame('Aysén del General Carlos Ibáñez del Campo', RegionCatalog::normalizeRegion('Aysen'));
        $this->assertSame('Magallanes y de la Antártica Chilena', RegionCatalog::normalizeRegion('Magallanes'));
    }

    public function testRegionPrefixIsStripped(): void
    {
        $this->assertSame('Valparaíso', RegionCatalog::normalizeRegion('Región de Valparaíso'));
        $this->assertSame('Valparaíso', RegionCatalog::normalizeRegion('Region Valparaiso'));
    }

    public function testUnmappableReturnsNull(): void
    {
        $this->assertNull(RegionCatalog::normalizeRegion('Not A Real Region'));
        $this->assertNull(RegionCatalog::normalizeRegion('XVII'));
        $this->assertNull(RegionCatalog::normalizeRegion('Buenos Aires'));
    }

    public function testEmptyOrNullReturnsNull(): void
    {
        $this->assertNull(RegionCatalog::normalizeRegion(null));
        $this->assertNull(RegionCatalog::normalizeRegion(''));
        $this->assertNull(RegionCatalog::normalizeRegion('   '));
    }
}
