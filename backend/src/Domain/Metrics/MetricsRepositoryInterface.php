<?php

declare(strict_types=1);

namespace App\Domain\Metrics;

use App\Infrastructure\Config\TimezoneConfig;

interface MetricsRepositoryInterface
{
    /**
     * $timezone is the organization's IANA identifier, used to convert
     * org-local start_date/end_date filters into a UTC range and to bucket
     * the returned rows by org-local calendar day (see
     * App\Infrastructure\Support\OrgDateRange).
     *
     * @return array
     */
    public function getMaterialViewsMetrics(int $organizationId, ?int $managerId, array $filters = [], string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * No date filtering — not timezone-sensitive.
     *
     * @return array
     */
    public function getRepLastLoginMetrics(int $organizationId, ?int $managerId, array $filters = []): array;

    public function getTopMaterialsMetrics(int $organizationId, ?int $managerId, array $filters = [], int $limit = 10, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * @return array
     */
    public function getMaterialViewsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Paginated sibling of getTopMaterialsMetrics(), exclusive to the
     * "Detalle de materiales" table. Same aggregation (WHERE/JOINs/GROUP BY)
     * as getTopMaterialsMetrics, but returns {items, meta} with
     * MetricsPaginationConfig::PAGE_SIZE. getTopMaterialsMetrics is never
     * modified — it keeps feeding the chart with its own $limit contract.
     *
     * @return array
     */
    public function getTopMaterialsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Adoption metrics per representative: how many distinct materials each rep
     * has opened, total views, last activity and adoption percentage.
     * Paginated — returns {items, meta}.
     *
     * @return array
     */
    public function getRepAdoptionMetrics(int $organizationId, ?int $managerId, array $filters = [], int $page = 1, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Study views metrics — fully separate report from material metrics
     * (getTopMaterialsMetrics/getRepAdoptionMetrics are never modified to
     * include this data; see design.md "Metrics integration" decision).
     *
     * @return array
     */
    public function getStudyViewsMetrics(int $organizationId, ?int $managerId, array $filters = [], string $timezone = TimezoneConfig::DEFAULT_ZONE): array;

    /**
     * Paginated detail list for study views ("Registro de Visualizaciones de
     * Estudios" table). Mirrors getMaterialViewsList's row-level detail
     * pattern but reads study_views joined through material_studies.
     *
     * @return array
     */
    public function getStudyViewsList(int $organizationId, ?int $managerId, array $filters = [], int $page = 1, string $timezone = TimezoneConfig::DEFAULT_ZONE): array;
}
