<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Material;

use App\Application\Actions\Action;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use App\Domain\StudyView\StudyViewRepositoryInterface;
use App\Application\Services\Storage\StorageServiceInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

class ListMaterialsAction extends Action
{
    private MaterialRepositoryInterface $materialRepository;
    private StorageServiceInterface $storageService;
    private MaterialStudyRepositoryInterface $studyRepository;
    private StudyViewRepositoryInterface $studyViewRepository;

    public function __construct(
        LoggerInterface $logger,
        MaterialRepositoryInterface $materialRepository,
        StorageServiceInterface $storageService,
        MaterialStudyRepositoryInterface $studyRepository,
        StudyViewRepositoryInterface $studyViewRepository
    ) {
        parent::__construct($logger);
        $this->materialRepository = $materialRepository;
        $this->storageService = $storageService;
        $this->studyRepository = $studyRepository;
        $this->studyViewRepository = $studyViewRepository;
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $managerId = (int) $authUser['id'];
        
        $params = $this->request->getQueryParams();
        $search = $params['q'] ?? null;
        $status = $params['status'] ?? null;
        $type = $params['type'] ?? null;
        $page = (int) ($params['page'] ?? 1);

        $result = $this->materialRepository->findAllByManager($managerId, $search, $status, $type, $page);

        // Decorate materials with cover_url
        foreach ($result['items'] as $material) {
            if ($material->getCoverPath()) {
                $material->setCoverUrl($this->storageService->getUrl($material->getCoverPath()));
            }
        }

        // Manager's list doubles as their detail view, so studies are
        // attached with per-study view_count (like OrgAdmin\GetMaterialAction),
        // batched across the whole page to avoid N+1 queries.
        $materialIds = array_map(fn ($material) => $material->getId(), $result['items']);
        $studiesByMaterial = $this->studyRepository->findAllByMaterialIds($materialIds);

        $allStudyIds = [];
        foreach ($studiesByMaterial as $studies) {
            foreach ($studies as $study) {
                $allStudyIds[] = $study->getId();
            }
        }
        $viewCounts = $this->studyViewRepository->countByStudyIds($allStudyIds);

        foreach ($result['items'] as $material) {
            $studies = $studiesByMaterial[$material->getId()] ?? [];
            foreach ($studies as $study) {
                $study->setViewCount($viewCounts[$study->getId()] ?? 0);
            }
            $material->setStudies($studies);
        }

        return $this->respondWithData($result);
    }
}
