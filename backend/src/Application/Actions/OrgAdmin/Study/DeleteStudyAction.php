<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Study;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * DELETE /org-admin/studies/{id}
 *
 * Mirrors OrgAdmin\Material\DeleteMaterialAction ordering: load the study
 * first (for its storage_path), delete the DB row, and only clean up the
 * stored file AFTER the DB delete succeeds — never the reverse, so nothing
 * is orphaned if the delete fails (e.g. FK constraint violation).
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
        $organizationId = (int) $authUser['organization_id'];
        $studyId = (int) $this->resolveArg('id');

        // Scoped to organization via the parent material (throws
        // MaterialStudyNotFoundException -> 404 if outside org)
        $study = $this->studyRepository->findByOrganizationAndId($organizationId, $studyId);

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
