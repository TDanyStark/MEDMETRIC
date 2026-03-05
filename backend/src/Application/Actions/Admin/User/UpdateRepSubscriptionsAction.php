<?php

declare(strict_types=1);

namespace App\Application\Actions\Admin\User;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\AdminUser\AdminUserRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Replace the full subscription list for a rep.
 * Body: { "manager_ids": [1, 2, 3] }
 */
class UpdateRepSubscriptionsAction extends Action
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
        $body  = (array) $this->getFormData();

        if (!isset($body['manager_ids']) || !is_array($body['manager_ids'])) {
            $error = new ActionError(ActionError::VALIDATION_ERROR, 'manager_ids must be an array.');
            return $this->respond(new ActionPayload(422, null, $error));
        }

        // Validate rep exists
        $rep = $this->adminUserRepository->findById($repId);

        if ($rep->getRole() !== 'rep') {
            $error = new ActionError(ActionError::VALIDATION_ERROR, 'User is not a rep.');
            return $this->respond(new ActionPayload(422, null, $error));
        }

        // Get current subscriptions
        $currentSubs    = $this->adminUserRepository->getRepSubscriptions($repId);
        $currentIds     = array_column($currentSubs, 'manager_id');
        $newIds         = array_map('intval', $body['manager_ids']);

        // Unsubscribe removed managers
        foreach ($currentIds as $managerId) {
            if (!in_array($managerId, $newIds, true)) {
                $this->adminUserRepository->unsubscribeRepFromManager($repId, (int) $managerId);
            }
        }

        // Subscribe new managers
        foreach ($newIds as $managerId) {
            $this->adminUserRepository->subscribeRepToManager($repId, $managerId);
        }

        $subscriptions = $this->adminUserRepository->getRepSubscriptions($repId);

        $this->logger->info('Rep subscriptions updated', ['rep_id' => $repId]);

        return $this->respondWithData($subscriptions, 200, 'Subscriptions updated successfully.');
    }
}
