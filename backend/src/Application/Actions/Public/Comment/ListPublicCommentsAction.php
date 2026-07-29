<?php

declare(strict_types=1);

namespace App\Application\Actions\Public\Comment;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use App\Domain\VisitSessionComment\VisitSessionCommentRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Public (unauthenticated) doctor comment read-back.
 *
 * GET /v1/public/session/{token}/comments — no middleware.
 *
 * Hard-filtered at the repository layer to author_type='doctor' AND
 * active=1 for THIS session only — rep-authored comments must NEVER be
 * reachable here under any parameter combination (there are no other
 * request params on this route). can_delete is always false on every row
 * (design §3) since there is no delete route reachable without auth.
 */
class ListPublicCommentsAction extends Action
{
    private VisitSessionRepositoryInterface $visitSessionRepository;
    private VisitSessionCommentRepositoryInterface $commentRepository;

    public function __construct(
        LoggerInterface $logger,
        VisitSessionRepositoryInterface $visitSessionRepository,
        VisitSessionCommentRepositoryInterface $commentRepository
    ) {
        parent::__construct($logger);
        $this->visitSessionRepository = $visitSessionRepository;
        $this->commentRepository = $commentRepository;
    }

    protected function action(): Response
    {
        $token = $this->resolveArg('token');

        $session = $this->visitSessionRepository->findByDoctorToken($token);
        if (!$session) {
            return $this->respond(new ActionPayload(
                404,
                null,
                new ActionError(ActionError::RESOURCE_NOT_FOUND, 'Invalid, expired, or revoked session token.')
            ));
        }

        $comments = $this->commentRepository->findPublicForSession($session->getId());

        return $this->respondWithData([
            'items' => $comments,
        ]);
    }
}
