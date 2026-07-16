<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Study;

use App\Application\Actions\Action;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use App\Domain\StudyView\StudyViewRepositoryInterface;
use App\Infrastructure\Config\PaginationConfig;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * GET /org-admin/materials/{id}/studies
 *
 * Lists the studies nested under a single material, scoped to the
 * org-admin's organization via the parent material.
 *
 * Studies are a small nested sub-resource of one material (not an
 * independent large collection), so pagination is applied in-memory over
 * MaterialStudyRepositoryInterface::findAllByMaterial() rather than adding a
 * new paginated repository method — still returns the same
 * {items,total,page,per_page,last_page} shape required for all listings.
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
        $organizationId = (int) $authUser['organization_id'];
        $materialId = (int) $this->resolveArg('id');

        // Throws MaterialNotFoundException -> 404 if outside org
        $this->materialRepository->findByOrganizationAndId($organizationId, $materialId);

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
