<?php

declare(strict_types=1);

namespace App\Application\Actions\Comment;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\VisitSessionComment\VisitSessionCommentNotFoundException;
use App\Domain\VisitSessionComment\VisitSessionCommentRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Soft-delete a comment (active=0). No edit path exists — ever.
 *
 * DELETE /v1/comments/{id} — JWT + CommentAccessConfig::DELETE_ROLES.
 *
 * Re-validates authorization server-side INDEPENDENTLY via the
 * repository's scope predicate — never trusts any client-supplied
 * `can_delete` flag from a prior list response (defense in depth, design
 * §3). Doctors have no delete route at all (no public route registers
 * this Action).
 */
class DeleteCommentAction extends Action
{
    private VisitSessionCommentRepositoryInterface $commentRepository;

    public function __construct(LoggerInterface $logger, VisitSessionCommentRepositoryInterface $commentRepository)
    {
        parent::__construct($logger);
        $this->commentRepository = $commentRepository;
    }

    protected function action(): Response
    {
        $authUser = $this->getAuthUser();
        $role = $authUser->getRole();
        $userId = $authUser->getId();
        $organizationId = (int) $authUser->getOrganizationId();

        $id = (int) $this->resolveArg('id');

        try {
            $deleted = $this->commentRepository->softDelete($id, $role, $userId, $organizationId);
        } catch (VisitSessionCommentNotFoundException $e) {
            return $this->respond(new ActionPayload(
                404,
                null,
                new ActionError(ActionError::RESOURCE_NOT_FOUND, 'Comment not found.')
            ));
        }

        if (!$deleted) {
            return $this->respond(new ActionPayload(
                403,
                null,
                new ActionError(ActionError::INSUFFICIENT_PRIVILEGES, 'You do not have access to this comment.')
            ));
        }

        return $this->respondWithData(['deleted' => true]);
    }
}
