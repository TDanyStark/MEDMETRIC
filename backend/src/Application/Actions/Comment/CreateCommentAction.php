<?php

declare(strict_types=1);

namespace App\Application\Actions\Comment;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\VisitSession\VisitSessionNotFoundException;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use App\Domain\VisitSessionComment\VisitSessionCommentRepositoryInterface;
use App\Infrastructure\Config\CommentPolicyConfig;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;
use Slim\Exception\HttpBadRequestException;

/**
 * Authenticated representative comment creation.
 *
 * POST /v1/comments — JWT + rep role. `visit_session_id` is in the BODY
 * (per the reconciled API contract, NOT nested under the session route),
 * mirroring the public POST shape and the /v1/comments listing route.
 *
 * `author_user_id` is derived STRICTLY from the JWT (getAuthUser()) —
 * any client-supplied author claim in the body is ignored. Ownership is
 * re-validated server-side via findByIdAndRep(); a rep may only comment
 * on their own visit sessions.
 */
class CreateCommentAction extends Action
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
        $authUser = $this->getAuthUser();
        $repId = $authUser->getId();

        $data = $this->getFormData();
        $data = is_array($data) ? $data : [];

        if (empty($data['visit_session_id']) || !is_numeric($data['visit_session_id'])) {
            throw new HttpBadRequestException($this->request, 'visit_session_id is required and must be numeric.');
        }
        $visitSessionId = (int) $data['visit_session_id'];

        try {
            // Ownership check: throws when the session does not exist OR
            // does not belong to this rep — both map to 403 here (a rep
            // has no legitimate reason to learn whether a foreign session
            // id exists at all).
            $session = $this->visitSessionRepository->findByIdAndRep($visitSessionId, $repId);
        } catch (VisitSessionNotFoundException $e) {
            return $this->respond(new ActionPayload(
                403,
                null,
                new ActionError(ActionError::INSUFFICIENT_PRIVILEGES, 'You do not have access to this visit session.')
            ));
        }

        $body = trim((string) ($data['body'] ?? ''));
        if ($body === '') {
            return $this->respond(new ActionPayload(
                422,
                null,
                new ActionError(ActionError::VALIDATION_ERROR, 'Comment body cannot be empty.')
            ));
        }
        if (mb_strlen($body) > CommentPolicyConfig::MAX_COMMENT_LENGTH) {
            return $this->respond(new ActionPayload(
                422,
                null,
                new ActionError(
                    ActionError::VALIDATION_ERROR,
                    sprintf('Comment body cannot exceed %d characters.', CommentPolicyConfig::MAX_COMMENT_LENGTH)
                )
            ));
        }

        $materialId = (isset($data['material_id']) && $data['material_id'] !== '' && $data['material_id'] !== null)
            ? (int) $data['material_id']
            : null;

        $comment = $this->commentRepository->create([
            'visit_session_id' => $session->getId(),
            'organization_id'  => $session->getOrganizationId(),
            'material_id'      => $materialId,
            'author_type'      => 'rep',
            // Strictly from the JWT — never trust any client-supplied claim.
            'author_user_id'   => $repId,
            'doctor_id'        => null,
            'body'             => $body,
            'user_agent'       => $this->request->getHeaderLine('User-Agent') ?: null,
            'ip_address'       => $this->getClientIp(),
        ]);

        return $this->respondWithData($comment, 201);
    }
}
