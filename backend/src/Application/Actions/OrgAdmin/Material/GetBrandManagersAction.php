<?php

declare(strict_types=1);

namespace App\Application\Actions\OrgAdmin\Material;

use App\Application\Actions\Action;
use App\Domain\AdminUser\AdminUserRepositoryInterface;
use App\Domain\Brand\BrandNotFoundException;
use App\Domain\Brand\BrandRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Returns the managers relevant to creating a material for a given brand.
 *
 * Response shape:
 * {
 *   "brand_managers": [{ id, name }],   // active managers assigned to the brand
 *   "org_managers":   [{ id, name }],   // all managers of the organization (used when brand has none)
 *   "needs_selection": bool,            // true when org-admin must pick a manager
 *   "needs_sync": bool                  // true when brand has no manager (first material links it)
 * }
 */
class GetBrandManagersAction extends Action
{
    public function __construct(
        LoggerInterface $logger,
        private BrandRepositoryInterface $brandRepository,
        private AdminUserRepositoryInterface $adminUserRepository
    ) {
        parent::__construct($logger);
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $organizationId = (int) $authUser['organization_id'];
        $brandId = (int) $this->resolveArg('brandId');

        // Validate brand belongs to organization
        try {
            $brand = $this->brandRepository->findById($brandId);
        } catch (BrandNotFoundException $e) {
            return $this->respondWithData(['error' => 'Brand not found'], 404);
        }

        if ($brand->getOrganizationId() !== $organizationId) {
            return $this->respondWithData(['error' => 'Brand does not belong to your organization'], 403);
        }

        $brandManagerIds = $this->brandRepository->getActiveManagerIdsByBrand($brandId);

        // Map all org managers once (id => name)
        $orgManagers = $this->adminUserRepository->findManagersByOrganization($organizationId);
        $orgManagersList = array_map(
            fn($m) => ['id' => $m->getId(), 'name' => $m->getName()],
            $orgManagers
        );

        $brandManagersList = array_values(array_filter(
            $orgManagersList,
            fn($m) => in_array($m['id'], $brandManagerIds, true)
        ));

        $hasNoManager = count($brandManagerIds) === 0;
        $hasMultiple = count($brandManagerIds) > 1;

        return $this->respondWithData([
            'brand_managers'  => $brandManagersList,
            'org_managers'    => $orgManagersList,
            'needs_selection' => $hasMultiple || $hasNoManager,
            'needs_sync'      => $hasNoManager,
        ]);
    }
}
