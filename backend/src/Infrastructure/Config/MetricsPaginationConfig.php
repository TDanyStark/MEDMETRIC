<?php

declare(strict_types=1);

namespace App\Infrastructure\Config;

class MetricsPaginationConfig
{
    /**
     * Page size for paginated tables inside the metrics dashboard.
     * Kept separate from PaginationConfig::PAGE_SIZE (used by regular CRUD
     * listings) because metrics tables show denser rows and should page
     * more tightly.
     */
    public const PAGE_SIZE = 10;
}
