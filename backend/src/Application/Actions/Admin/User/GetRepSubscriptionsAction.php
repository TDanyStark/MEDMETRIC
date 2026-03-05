<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\User;

use App\Application\Actions\Action;
use App\Domain\AdminUser\AdminUserRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class GetRepSubscriptionsAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private AdminUserRepositoryInterface $adminUserRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $repId = (int) $this->resolveArg('id');

        // Validate rep exists
        $this->adminUserRepository->findById($repId);

        $subscriptions = $this->adminUserRepository->getRepSubscriptions($repId);

        return $this->respondWithData($subscriptions);
    }
}
