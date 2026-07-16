<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Study;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * DELETE /manager/studies/{id}
 *
 * Scoped via findByManagerAndId (manager_brands, active=1) — no status
 * filter. Same DB-first-then-file ordering as OrgAdmin\Study\DeleteStudyAction.
 *
 * IMPORTANT / INTENTIONAL DEVIATION: never checks $material->isApproved().
 * Studies have no approval workflow, so a manager can delete a study on an
 * approved material — this is by design (see UpdateStudyAction docblock and
 * design.md decision table), not an oversight.
 */
class DeleteStudyAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialStudyRepositoryInterface $studyRepository,
        private StorageServiceInterface $storageService
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        $studyId = (int) $this->resolveArg('id');

        // Throws MaterialStudyNotFoundException -> 404 if outside manager's scope
        $study = $this->studyRepository->findByManagerAndId($managerId, $studyId);

        // Delete the DB row first. If this fails (e.g. FK constraint violation),
        // the stored file is left untouched so nothing is orphaned.
        $this->studyRepository->delete($studyId);

        // Only clean up the stored file after the DB delete succeeded.
        if ($study->getStoragePath()) {
            $this->storageService->delete($study->getStoragePath());
        }

        return $this->respondWithData(['message' => 'Study deleted successfully']);
    }
}
