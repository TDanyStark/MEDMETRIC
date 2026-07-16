<?php

declare(strict_types=1);

namespace App\Application\Actions\Manager\Study;

use App\Application\Actions\Action;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use App\Domain\StudyView\StudyViewRepositoryInterface;
use App\Infrastructure\Config\PaginationConfig;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * GET /manager/materials/{id}/studies
 *
 * Same as OrgAdmin\Study\ListStudyAction but scoped via
 * findByManagerAndId (manager_brands, active=1) on the parent material.
 */
class ListStudyAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private MaterialRepositoryInterface $materialRepository,
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

        // Throws MaterialNotFoundException -> 404 if outside manager's scope
        $this->materialRepository->findByManagerAndId($managerId, $materialId);

        $allStudies = $this->studyRepository->findAllByMaterial($materialId);

        $page = (int) ($this->request->getQueryParams()['page'] ?? 1);
        if ($page < 1) {
            $page = 1;
        }

        $pageSize = PaginationConfig::PAGE_SIZE;
        $total = count($allStudies);
        $items = array_slice($allStudies, ($page - 1) * $pageSize, $pageSize);

        $studyIds = array_map(fn ($study) => $study->getId(), $items);
        $viewCounts = $this->studyViewRepository->countByStudyIds($studyIds);
        foreach ($items as $study) {
            $study->setViewCount($viewCounts[$study->getId()] ?? 0);
        }

        return $this->respondWithData([
            'items'     => $items,
            'total'     => $total,
            'page'      => $page,
            'per_page'  => $pageSize,
            'last_page' => (int) max(1, ceil($total / $pageSize)),
        ]);
    }
}
