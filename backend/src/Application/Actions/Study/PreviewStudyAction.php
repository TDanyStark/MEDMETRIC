<?php

declare(strict_types=1);

namespace App\Application\Actions\Study;

use App\Application\Actions\Action;
use App\Application\Services\Storage\StorageServiceInterface;
use App\Domain\Material\MaterialRepositoryInterface;
use App\Domain\MaterialStudy\MaterialStudyRepositoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;

/**
 * Preview study resource for staff consumption (org-admin/manager/rep)
 * without recording metrics — mirrors Actions/Material/PreviewMaterialAction.
 *
 * Shared between org-admin, manager, and rep routes. Records NO view (no
 * StudyView created) — this is staff/rep preview only, not the public
 * doctor flow (see Public\Study\GetStudyResourceAction for that).
 */
class PreviewStudyAction extends Action
{
    private MaterialStudyRepositoryInterface $studyRepository;
    private MaterialRepositoryInterface $materialRepository;
    private StorageServiceInterface $storageService;

    public function __construct(
        LoggerInterface $logger,
        MaterialStudyRepositoryInterface $studyRepository,
        MaterialRepositoryInterface $materialRepository,
        StorageServiceInterface $storageService
    ) {
        parent::__construct($logger);
        $this->studyRepository = $studyRepository;
        $this->materialRepository = $materialRepository;
        $this->storageService = $storageService;
    }

    protected function action(): Response
    {
        $studyId = (int) $this->resolveArg('id');
        $user = $this->getAuthUser();

        if (!$user) {
            return $this->respondWithData(['error' => 'No autenticado'], 401);
        }

        // Find study
        try {
            $study = $this->studyRepository->findById($studyId);
        } catch (\Exception $e) {
            return $this->respondWithData(['error' => 'Estudio no encontrado'], 404);
        }

        // Resolve the parent material to check org scope (the study entity
        // itself carries no organization_id).
        try {
            $material = $this->materialRepository->findById($study->getMaterialId());
        } catch (\Exception $e) {
            return $this->respondWithData(['error' => 'Estudio no encontrado'], 404);
        }

        // Security: Ensure the study's parent material belongs to the user's organization
        if ($material->getOrganizationId() !== $user->getOrganizationId()) {
            return $this->respondWithData([
                'error' => 'No tienes permiso para previsualizar este estudio',
            ], 403);
        }

        // Staff (org-admin/managers/reps) can preview studies regardless of
        // the parent material's status — studies have no approval workflow.

        $type = $study->getType();

        return match ($type) {
            'pdf'   => $this->servePdf($study),
            'link'  => $this->serveLink($study),
            default => $this->respondWithData(['error' => 'Tipo de estudio desconocido'], 400),
        };
    }

    private function servePdf($study): Response
    {
        $storagePath = $study->getStoragePath();

        if (empty($storagePath)) {
            return $this->respondWithData([
                'error' => 'Ruta del archivo PDF no encontrada',
            ], 404);
        }

        $url = $this->storageService->getUrl($storagePath);

        // We return as a resource object similar to the public one to be consistent
        return $this->respondWithData([
            'type'  => 'pdf',
            'url'   => $url,
            'title' => $study->getTitle(),
        ]);
    }

    private function serveLink($study): Response
    {
        $externalUrl = $study->getExternalUrl();

        if (empty($externalUrl)) {
            return $this->respondWithData([
                'error' => 'URL del enlace no encontrada',
            ], 404);
        }

        return $this->respondWithData([
            'type'  => 'link',
            'url'   => $externalUrl,
            'title' => $study->getTitle(),
        ]);
    }
}
