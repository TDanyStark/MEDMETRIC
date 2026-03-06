<?php

declare(strict_types=1);

namespace App\Application\Actions\Rep\VisitSession;

use App\Application\Actions\Action;
use App\Domain\VisitSession\VisitSessionRepositoryInterface;
use App\Domain\VisitSession\VisitSessionNotFoundException;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Log\LoggerInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;

class AddMaterialsToSessionAction extends Action
{
    private VisitSessionRepositoryInterface $visitSessionRepository;

    public function __construct(LoggerInterface $logger, VisitSessionRepositoryInterface $visitSessionRepository)
    {
        parent::__construct($logger);
        $this->visitSessionRepository = $visitSessionRepository;
    }

    protected function action(): Response
    {
        $authUser = $this->request->getAttribute('auth_user');
        $repId    = (int) $authUser['id'];
        $sessionId = (int) $this->resolveArg('id');

        $data = $this->getFormData();

        if (empty($data['material_ids']) || !is_array($data['material_ids'])) {
            throw new HttpBadRequestException($this->request, 'Material IDs are required and must be an array.');
        }

        try {
            $materials = $this->visitSessionRepository->addMaterials($sessionId, $repId, $data['material_ids']);
        } catch (VisitSessionNotFoundException $e) {
            throw new HttpNotFoundException($this->request, 'Session not found or does not belong to you.');
        }

        return $this->respondWithData([
            'session_id' => $sessionId,
            'materials'  => $materials,
        ]);
    }
}
