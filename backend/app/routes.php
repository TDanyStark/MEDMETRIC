<?php

declare(strict_types=1);

use App\Application\Actions\Admin\Brand\AssignBrandsToManagerAction;
use App\Application\Actions\Admin\Brand\CreateBrandAction;
use App\Application\Actions\Admin\Brand\GetManagerBrandsAction;
use App\Application\Actions\Admin\Brand\ListBrandsAction as AdminListBrandsAction;
use App\Application\Actions\Admin\Brand\RemoveBrandsFromManagerAction;
use App\Application\Actions\Admin\Brand\UpdateBrandAction;
use App\Application\Actions\Admin\Organization\CreateOrganizationAction;
use App\Application\Actions\Admin\Organization\ListOrganizationsAction;
use App\Application\Actions\Admin\Organization\UpdateOrganizationAction;
use App\Application\Actions\Admin\User\CreateAdminUserAction;
use App\Application\Actions\Admin\User\CreateOrgAdminAction;
use App\Application\Actions\Admin\User\GetRepSubscriptionsAction;
use App\Application\Actions\Admin\User\ListAdminUsersAction;
use App\Application\Actions\Admin\User\ListOrgAdminsAction;
use App\Application\Actions\Admin\User\ListRolesAction;
use App\Application\Actions\Admin\User\UpdateAdminUserAction;
use App\Application\Actions\Admin\User\UpdateOrgAdminAction;
use App\Application\Actions\Admin\User\UpdateRepSubscriptionsAction;
use App\Application\Actions\Auth\LoginAction;
use App\Application\Actions\Auth\MeAction;
use App\Application\Actions\Manager\Brand\ListBrandsAction;
use App\Application\Actions\Manager\Material\ApproveMaterialAction;
use App\Application\Actions\Manager\Material\CreateMaterialAction;
use App\Application\Actions\Manager\Material\ListMaterialsAction;
use App\Application\Actions\Manager\Material\UpdateMaterialAction;
use App\Application\Actions\Manager\Rep\AssignRepAction;
use App\Application\Actions\Manager\Rep\GetAvailableRepsAction;
use App\Application\Actions\Manager\Rep\ListAssignedRepsAction;
use App\Application\Actions\Manager\Rep\RemoveRepAction;
use App\Application\Actions\Public\Material\GetMaterialResourceAction;
use App\Application\Actions\Public\Material\OpenMaterialAction;
use App\Application\Actions\Public\Session\GetPublicSessionAction;
use App\Application\Actions\Rep\Material\ListMaterialsAction as RepListMaterialsAction;
use App\Application\Actions\Rep\VisitSession\AddMaterialsToSessionAction;
use App\Application\Actions\Rep\VisitSession\CreateVisitSessionAction;
use App\Application\Actions\Rep\VisitSession\ListVisitSessionsAction;
use App\Application\Actions\Metrics\GetMaterialViewsAction;
use App\Application\Actions\Metrics\GetMaterialViewsListAction;
use App\Application\Actions\Metrics\GetRepLastLoginAction;
use App\Application\Actions\Metrics\GetTopMaterialsAction;
use App\Application\Middleware\JwtMiddleware;
use App\Application\Middleware\RoleMiddleware;
use App\Infrastructure\Database\Connection;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

return function (App $app) {
    $app->options('/{routes:.*}', function (Request $request, Response $response) {
        // CORS Pre-Flight OPTIONS Request Handler
        return $response;
    });

    // API v1 route group
    $app->group('/v1', function (RouteCollectorProxy $group) use ($app) {

        // -------------------------------------------------------------------------
        // Health check
        // -------------------------------------------------------------------------
        $group->get('/health', function (Request $request, Response $response) {
            $dbStatus = Connection::testConnection();

            $payload = [
                'success' => $dbStatus['status'] === 'ok',
                'data' => [
                    'api' => [
                        'status' => 'ok',
                        'name' => $_ENV['APP_NAME'] ?? 'MEDMETRIC',
                        'version' => '1.0.0',
                        'environment' => $_ENV['APP_ENV'] ?? 'development',
                    ],
                    'database' => $dbStatus,
                ],
            ];

            $response->getBody()->write((string) json_encode($payload, JSON_UNESCAPED_SLASHES));

            return $response
                ->withStatus($dbStatus['status'] === 'ok' ? 200 : 503)
                ->withHeader('Content-Type', 'application/json');
        });

        // -------------------------------------------------------------------------
        // Auth routes (public — no JWT required)
        // -------------------------------------------------------------------------
        $group->group('/auth', function (RouteCollectorProxy $auth) {
            $auth->post('/login', LoginAction::class);
        });

        // -------------------------------------------------------------------------
        // Auth routes (protected — JWT required)
        // -------------------------------------------------------------------------
        $group->group('/auth', function (RouteCollectorProxy $auth) {
            $auth->get('/me', MeAction::class);
        })->add(JwtMiddleware::class);

        // -------------------------------------------------------------------------
        // Super Admin routes (JWT + superadmin role required)
        // Super Admin manages: organizations, org_admins
        // -------------------------------------------------------------------------
        $group->group('/superadmin', function (RouteCollectorProxy $superadmin) {

            // Organizations
            $superadmin->group('/organizations', function (RouteCollectorProxy $orgs) {
                $orgs->get('',        ListOrganizationsAction::class);
                $orgs->post('',       CreateOrganizationAction::class);
                $orgs->put('/{id}',   UpdateOrganizationAction::class);
            });

            // Org Admins management
            $superadmin->group('/org-admins', function (RouteCollectorProxy $orgAdmins) {
                $orgAdmins->get('',      ListOrgAdminsAction::class);
                $orgAdmins->post('',      CreateOrgAdminAction::class);
                $orgAdmins->put('/{id}',  UpdateOrgAdminAction::class);
            });

            // Roles catalog (useful for forms)
            $superadmin->get('/roles', ListRolesAction::class);

        })->add(function ($request, $handler) use ($app) {
            $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
            return (new RoleMiddleware($responseFactory, ['superadmin']))->process($request, $handler);
        })->add(JwtMiddleware::class);

        // -------------------------------------------------------------------------
        // Org Admin routes (JWT + org_admin role required)
        // Org Admin manages: users (managers, reps), brands, brand assignments
        // All filtered by their organization
        // -------------------------------------------------------------------------
        $group->group('/org-admin', function (RouteCollectorProxy $orgAdmin) {

            // Roles catalog (useful for user form)
            $orgAdmin->get('/roles', ListRolesAction::class);

            // Users (managers and reps only - org_admin cannot manage other org_admins)
            $orgAdmin->group('/users', function (RouteCollectorProxy $users) {
                $users->get('',           ListAdminUsersAction::class);
                $users->post('',          CreateAdminUserAction::class);
                $users->put('/{id}',      UpdateAdminUserAction::class);

                // Rep subscriptions to managers
                $users->get('/{id}/subscriptions',  GetRepSubscriptionsAction::class);
                $users->put('/{id}/subscriptions',  UpdateRepSubscriptionsAction::class);
            });

            // Brands (Org Admin manages brands for their organization)
            $orgAdmin->group('/brands', function (RouteCollectorProxy $brands) {
                $brands->get('',       AdminListBrandsAction::class);
                $brands->post('',      CreateBrandAction::class);
                $brands->put('/{id}',  UpdateBrandAction::class);
            });

            // Manager brand assignments
            $orgAdmin->group('/managers/{managerId}/brands', function (RouteCollectorProxy $mb) {
                $mb->get('',  GetManagerBrandsAction::class);
                $mb->post('', AssignBrandsToManagerAction::class);
                $mb->delete('', RemoveBrandsFromManagerAction::class);
            });

        })->add(function ($request, $handler) use ($app) {
            $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
            return (new RoleMiddleware($responseFactory, ['org_admin']))->process($request, $handler);
        })->add(JwtMiddleware::class);

        // -------------------------------------------------------------------------
        // Manager routes (JWT + manager role required)
        // -------------------------------------------------------------------------
        $group->group('/manager', function (RouteCollectorProxy $manager) {

            // Brands (manager only sees assigned brands - no create/update)
            $manager->get('/brands', ListBrandsAction::class);

            // Materials
            $manager->group('/materials', function (RouteCollectorProxy $materials) {
                $materials->get('',            ListMaterialsAction::class);
                $materials->post('',           CreateMaterialAction::class);
                $materials->put('/{id}',       UpdateMaterialAction::class);
                $materials->post('/{id}/approve', ApproveMaterialAction::class);
            });

            // Reps (visitadores médicos)
            $manager->group('/reps', function (RouteCollectorProxy $reps) {
                $reps->get('',                 ListAssignedRepsAction::class);
                $reps->get('/available',      GetAvailableRepsAction::class);
                $reps->post('',               AssignRepAction::class);
                $reps->delete('/{repId}',     RemoveRepAction::class);
            });

        })->add(function ($request, $handler) use ($app) {
            $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
            return (new RoleMiddleware($responseFactory, ['manager']))->process($request, $handler);
        })->add(JwtMiddleware::class);

        // -------------------------------------------------------------------------
        // Rep routes (JWT + rep role required)
        // -------------------------------------------------------------------------
        $group->group('/rep', function (RouteCollectorProxy $rep) {

            // Materials - approved materials from subscribed managers
            $rep->get('/materials', RepListMaterialsAction::class);
            $rep->get('/materials/filters', \App\Application\Actions\Rep\Material\ListRepFilterOptionsAction::class);

            // Visit Sessions
            $rep->group('/visit-sessions', function (RouteCollectorProxy $sessions) {
                $sessions->get('',  ListVisitSessionsAction::class);
                $sessions->post('', CreateVisitSessionAction::class);
                $sessions->patch('/{id}/materials', AddMaterialsToSessionAction::class);
            });

        })->add(function ($request, $handler) use ($app) {
            $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
            return (new RoleMiddleware($responseFactory, ['rep']))->process($request, $handler);
        })->add(JwtMiddleware::class);

        // -------------------------------------------------------------------------
        // Metrics routes (JWT + org_admin or manager role required)
        // -------------------------------------------------------------------------
        $group->group('/metrics', function (RouteCollectorProxy $metrics) {
            $metrics->get('/material-views', GetMaterialViewsAction::class);
            $metrics->get('/material-views-list', GetMaterialViewsListAction::class);
            $metrics->get('/rep-last-login', GetRepLastLoginAction::class);
            $metrics->get('/top-materials', GetTopMaterialsAction::class);
        })->add(function ($request, $handler) use ($app) {
            $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
            return (new RoleMiddleware($responseFactory, ['org_admin', 'manager']))->process($request, $handler);
        })->add(JwtMiddleware::class);

        // -------------------------------------------------------------------------
        // Public routes (no authentication required)
        // For doctor access via token
        // -------------------------------------------------------------------------
        $group->group('/public', function (RouteCollectorProxy $public) {
            
            // Get session by doctor token
            $public->get('/session/{token}', GetPublicSessionAction::class);
            
            // Material tracking endpoints
            $public->group('/material/{id}', function (RouteCollectorProxy $material) {
                $material->post('/open', OpenMaterialAction::class);
                $material->get('/resource', GetMaterialResourceAction::class);
                $material->get('/cover', \App\Application\Actions\Public\Material\GetMaterialCoverAction::class);
            });
            
        });

    });
};
