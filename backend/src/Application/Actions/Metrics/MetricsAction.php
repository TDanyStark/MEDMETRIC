<?php

declare(strict_types=1);

namespace App\Application\Actions\Metrics;

use App\Application\Actions\Action;
use App\Domain\Metrics\MetricsRepositoryInterface;
use Psr\Log\LoggerInterface;

abstract class MetricsAction extends Action
{
    protected MetricsRepositoryInterface $metricsRepository;

    public function __construct(LoggerInterface $logger, MetricsRepositoryInterface $metricsRepository)
    {
        parent::__construct($logger);
        $this->metricsRepository = $metricsRepository;
    }
}
