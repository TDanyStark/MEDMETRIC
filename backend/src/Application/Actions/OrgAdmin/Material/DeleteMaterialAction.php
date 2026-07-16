<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class DeleteMaterialAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialRepositoryInterface $materialRepository,
        private StorageServiceInterface $storageService,
        private MaterialStudyRepositoryInterface $studyRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $organizationId = (int) $authUser['organization_id'];
        $materialId = (int) $this->resolveArg('id');

        // Scoped to organization (throws MaterialNotFoundException -> 404 if outside org)
        $material = $this->materialRepository->findByOrganizationAndId($organizationId, $materialId);

        // Capture the material's studies (and their storage_path, pdf-type
        // only) BEFORE deleting — the DB CASCADE on material_studies.material_id
        // will remove the study rows (and study_views rows transitively) the
        // instant the material row is deleted below, so this must be read first.
        $studies = $this->studyRepository->findAllByMaterial($materialId);

        // Delete the DB row first. If this fails (e.g. FK constraint violation),
        // the stored files are left untouched so nothing is orphaned. The
        // material_studies/study_views rows are auto-removed by DB CASCADE.
        $this->materialRepository->delete($materialId);

        // Only clean up stored files after the DB delete succeeded.
        if ($material->getStoragePath()) {
            $this->storageService->delete($material->getStoragePath());
        }
        if ($material->getCoverPath()) {
            $this->storageService->delete($material->getCoverPath());
        }

        // Clean up each study's stored file (pdf studies only — links have
        // no storage_path). Study DB rows are already gone via CASCADE.
        foreach ($studies as $study) {
            if ($study->getStoragePath()) {
                $this->storageService->delete($study->getStoragePath());
            }
        }

        return $this->respondWithData(['message' => 'Material deleted successfully']);
    }
}
