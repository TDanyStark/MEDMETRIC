<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Material;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialNotFoundException;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use App\Domain\StudyView\StudyViewRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class GetMaterialAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialRepositoryInterface $materialRepository,
        private StorageServiceInterface $storageService,
        private MaterialStudyRepositoryInterface $studyRepository,
        private StudyViewRepositoryInterface $studyViewRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        $materialId = (int) $this->resolveArg('id');

        try {
            $material = $this->materialRepository->findByManagerAndId($managerId, $materialId);
        } catch (MaterialNotFoundException $e) {
            return $this->respondWithData(['error' => 'Material not found'], 404);
        }

        if ($material->getCoverPath()) {
            $material->setCoverUrl($this->storageService->getUrl($material->getCoverPath()));
        }

        // Single material detail view — can afford the extra per-study
        // view_count query (study metrics stay separate from material
        // metrics, this is the only place manager sees them attached).
        $studies = $this->studyRepository->findAllByMaterial($materialId);
        $studyIds = array_map(fn ($study) => $study->getId(), $studies);
        $viewCounts = $this->studyViewRepository->countByStudyIds($studyIds);
        foreach ($studies as $study) {
            $study->setViewCount($viewCounts[$study->getId()] ?? 0);
        }
        $material->setStudies($studies);

        return $this->respondWithData($material);
    }
}
