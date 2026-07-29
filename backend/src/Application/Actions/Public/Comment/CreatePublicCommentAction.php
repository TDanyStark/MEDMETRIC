<?php

declare(strict_types=1);

namespace App\Application\Actions\Public\Comment;

use App\Application\Actions\Action;
use App\Application\Actions\ActionError;
use App\Application\Actions\ActionPayload;
use App\Domain\MaterialView\MaterialViewRepositoryInterface;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use App\Domain\VisitSessionComment\VisitSessionCommentRepositoryInterface;
use App\Infrastructure\Config\CommentPolicyConfig;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Public (unauthenticated) doctor comment creation.
 *
 * POST /v1/public/session/{token}/comments — no middleware.
 *
 * Flow (design §2/§3, spec "Public doctor comment creation"):
 *   1. Resolve token -> session (404 if invalid/expired/revoked).
 *   2. If material_id given, validate it belongs to THIS session (403).
 *   3. Rate limit: countRecentForSession vs RATE_LIMIT_PER_MINUTE (429).
 *      Deliberately counts soft-deleted rows too — see repository.
 *   4. Validate body: non-empty after trim, <= MAX_COMMENT_LENGTH (422).
 *   5. Insert author_type='doctor', doctor_id from the resolved session.
 */
class CreatePublicCommentAction extends Action
{
    private VisitSessionRepositoryInterface $visitSessionRepository;
    private VisitSessionCommentRepositoryInterface $commentRepository;
    private MaterialViewRepositoryInterface $materialViewRepository;

    public function __construct(
        LoggerInterface $logger,
        VisitSessionRepositoryInterface $visitSessionRepository,
        VisitSessionCommentRepositoryInterface $commentRepository,
        MaterialViewRepositoryInterface $materialViewRepository
    ) {
        parent::__construct($logger);
        $this->visitSessionRepository = $visitSessionRepository;
        $this->commentRepository = $commentRepository;
        $this->materialViewRepository = $materialViewRepository;
    }

    protected function action(): Response
    {
        $token = $this->resolveArg('token');

        $session = $this->visitSessionRepository->findByDoctorToken($token);
        if (!$session) {
            return $this->errorResponse(
                404,
                ActionError::RESOURCE_NOT_FOUND,
                'Invalid, expired, or revoked session token.'
            );
        }

        $data = $this->getFormData();
        $data = is_array($data) ? $data : [];

        $materialId = (isset($data['material_id']) && $data['material_id'] !== '' && $data['material_id'] !== null)
            ? (int) $data['material_id']
            : null;

        if ($materialId !== null && !$this->materialViewRepository->isMaterialInSession($materialId, $session->getId())) {
            return $this->errorResponse(
                403,
                ActionError::INSUFFICIENT_PRIVILEGES,
                'Material does not belong to this visit session.'
            );
        }

        // Rate limit BEFORE body validation, per design §2 — soft-deleted
        // rows still count toward the window (anti-bypass, see repository).
        $recentCount = $this->commentRepository->countRecentForSession(
            $session->getId(),
            CommentPolicyConfig::RATE_WINDOW_SECONDS
        );
        if ($recentCount >= CommentPolicyConfig::RATE_LIMIT_PER_MINUTE) {
            return $this->errorResponse(
                429,
                'RATE_LIMIT_EXCEEDED',
                'Too many comments for this session. Please wait before posting again.'
            );
        }

        $body = trim((string) ($data['body'] ?? ''));
        if ($body === '') {
            return $this->errorResponse(
                422,
                ActionError::VALIDATION_ERROR,
                'Comment body cannot be empty.'
            );
        }
        if (mb_strlen($body) > CommentPolicyConfig::MAX_COMMENT_LENGTH) {
            return $this->errorResponse(
                422,
                ActionError::VALIDATION_ERROR,
                sprintf('Comment body cannot exceed %d characters.', CommentPolicyConfig::MAX_COMMENT_LENGTH)
            );
        }

        $comment = $this->commentRepository->create([
            'visit_session_id' => $session->getId(),
            'organization_id'  => $session->getOrganizationId(),
            'material_id'      => $materialId,
            'author_type'      => 'doctor',
            'author_user_id'   => null,
            'doctor_id'        => $session->getDoctorId(),
            'body'             => $body,
            'user_agent'       => $this->request->getHeaderLine('User-Agent') ?: null,
            'ip_address'       => $this->getClientIp(),
        ]);

        return $this->respondWithData([
            'id'         => $comment->getId(),
            'created_at' => $comment->getCreatedAt(),
        ], 201);
    }

    private function errorResponse(int $statusCode, string $errorType, string $description): Response
    {
        return $this->respond(new ActionPayload(
            $statusCode,
            null,
            new ActionError($errorType, $description)
        ));
    }
}
