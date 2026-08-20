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
use App\Application\Actions\OrgAdmin\Organization\GetMyOrganizationAction;
use App\Application\Actions\OrgAdmin\Organization\UpdateMyOrganizationAction;
use App\Application\Actions\Timezone\ListTimezonesAction;
use App\Application\Actions\Admin\User\CreateAdminUserAction;
use App\Application\Actions\Admin\User\CreateOrgAdminAction;
use App\Application\Actions\Admin\User\GetRepSubscriptionsAction;
use App\Application\Actions\Admin\User\ListAdminUsersAction;
use App\Application\Actions\Admin\User\ListOrgAdminsAction;
use App\Application\Actions\Admin\User\ListRolesAction;
use App\Application\Actions\Admin\User\UpdateAdminUserAction;
use App\Application\Actions\Admin\User\UpdateOrgAdminAction;
use App\Application\Actions\Admin\User\UpdateRepSubscriptionsAction;
use App\Application\Actions\Auth\ChangePasswordAction;
use App\Application\Actions\Auth\LoginAction;
use App\Application\Actions\Auth\MeAction;
use App\Application\Actions\Comment\CreateCommentAction;
use App\Application\Actions\Comment\DeleteCommentAction;
use App\Application\Actions\Comment\ListCommentsAction;
use App\Application\Actions\Doctor\CreateDoctorAction;
use App\Application\Actions\Doctor\DeleteDoctorAction;
use App\Application\Actions\Doctor\ListDoctorsAction;
use App\Application\Actions\Doctor\RepSearchAction;
use App\Application\Actions\Doctor\SearchDoctorsAction;
use App\Application\Actions\Doctor\UpdateDoctorAction;
use App\Application\Actions\Manager\Brand\ListBrandsAction;
use App\Application\Actions\Manager\Material\ApproveMaterialAction;
use App\Application\Actions\Manager\Material\CreateMaterialAction;
use App\Application\Actions\Manager\Material\GetMaterialAction as ManagerGetMaterialAction;
use App\Application\Actions\Manager\Material\ListMaterialsAction;
use App\Application\Actions\Manager\Material\SetMaterialVisibilityAction;
use App\Application\Actions\Manager\Material\UpdateMaterialAction;
use App\Application\Actions\Material\PreviewMaterialAction;
use App\Application\Actions\OrgAdmin\Material\ApproveMaterialAction as OrgAdminApproveMaterialAction;
use App\Application\Actions\OrgAdmin\Material\CreateMaterialAction as OrgAdminCreateMaterialAction;
use App\Application\Actions\OrgAdmin\Material\DeleteMaterialAction as OrgAdminDeleteMaterialAction;
use App\Application\Actions\OrgAdmin\Material\GetBrandManagersAction as OrgAdminGetBrandManagersAction;
use App\Application\Actions\OrgAdmin\Material\GetMaterialAction as OrgAdminGetMaterialAction;
use App\Application\Actions\OrgAdmin\Material\ListMaterialsAction as OrgAdminListMaterialsAction;
use App\Application\Actions\OrgAdmin\Material\SetMaterialVisibilityAction as OrgAdminSetMaterialVisibilityAction;
use App\Application\Actions\OrgAdmin\Material\UpdateMaterialAction as OrgAdminUpdateMaterialAction;
use App\Application\Actions\OrgAdmin\Study\ListStudyAction as OrgAdminListStudyAction;
use App\Application\Actions\OrgAdmin\Study\CreateStudyAction as OrgAdminCreateStudyAction;
use App\Application\Actions\OrgAdmin\Study\UpdateStudyAction as OrgAdminUpdateStudyAction;
use App\Application\Actions\OrgAdmin\Study\DeleteStudyAction as OrgAdminDeleteStudyAction;
use App\Application\Actions\Manager\Study\ListStudyAction as ManagerListStudyAction;
use App\Application\Actions\Manager\Study\CreateStudyAction as ManagerCreateStudyAction;
use App\Application\Actions\Manager\Study\UpdateStudyAction as ManagerUpdateStudyAction;
use App\Application\Actions\Manager\Study\DeleteStudyAction as ManagerDeleteStudyAction;
use App\Application\Actions\Study\PreviewStudyAction;
use App\Application\Actions\Manager\Rep\AssignRepAction;
use App\Application\Actions\Manager\Rep\GetAvailableRepsAction;
use App\Application\Actions\Manager\Rep\ListAssignedRepsAction;
use App\Application\Actions\Manager\Rep\RemoveRepAction;
use App\Application\Actions\Public\Comment\CreatePublicCommentAction;
use App\Application\Actions\Public\Comment\ListPublicCommentsAction;
use App\Application\Actions\Public\Material\GetMaterialResourceAction;
use App\Application\Actions\Public\Material\OpenMaterialAction;
use App\Application\Actions\Public\Session\GetPublicSessionAction;
use App\Application\Actions\Public\Study\GetStudyResourceAction;
use App\Application\Actions\Rep\Material\ListMaterialsAction as RepListMaterialsAction;
use App\Application\Actions\Rep\Metrics\DeviceSplitAction as RepMetricsDeviceSplitAction;
use App\Application\Actions\Rep\Metrics\HourHistogramAction as RepMetricsHourHistogramAction;
use App\Application\Actions\Rep\Metrics\OpenTrendAction as RepMetricsOpenTrendAction;
use App\Application\Actions\Rep\Metrics\SessionsAction as RepMetricsSessionsAction;
use App\Application\Actions\Rep\Metrics\SummaryAction as RepMetricsSummaryAction;
use App\Application\Actions\Rep\Metrics\TopMaterialsAction as RepMetricsTopMaterialsAction;
use App\Application\Actions\Rep\Metrics\UnopenedMaterialsAction as RepMetricsUnopenedMaterialsAction;
use App\Application\Actions\Rep\VisitSession\AddMaterialsToSessionAction;
use App\Application\Actions\Rep\VisitSession\CreateVisitSessionAction;
use App\Application\Actions\Rep\VisitSession\ListVisitSessionsAction;
use App\Application\Actions\Metrics\GetMaterialViewsAction;
use App\Application\Actions\Metrics\GetMaterialViewsListAction;
use App\Application\Actions\Metrics\GetRepLastLoginAction;
use App\Application\Actions\Metrics\GetTopMaterialsAction;
use App\Application\Actions\Metrics\GetTopMaterialsListAction;
use App\Application\Actions\Metrics\GetRepAdoptionAction;
use App\Application\Actions\Metrics\GetStudyViewsAction;
use App\Application\Actions\Metrics\GetStudyViewsListAction;
use App\Application\Middleware\JwtMiddleware;
use App\Application\Middleware\RoleMiddleware;
use App\Infrastructure\Config\CommentAccessConfig;
use App\Infrastructure\Config\DoctorAccessConfig;
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

            // Check exec() availability
            $execEnabled = function_exists('exec') &&
                !in_array('exec', array_map('trim', explode(',', ini_get('disable_functions'))), true);

            // Check GhostScript binary (via exec PATH lookup and absolute path probe)
            $gsPath = null;

            // 1. Try which/where if exec is available
            if ($execEnabled) {
                foreach (['gs', 'gswin64c', 'gswin32c'] as $bin) {
                    $whereCmd = (PHP_OS_FAMILY === 'Windows') ? "where {$bin}" : "which {$bin}";
                    exec($whereCmd . ' 2>&1', $out, $code);
                    if ($code === 0 && !empty($out[0])) {
                        $gsPath = trim($out[0]);
                        break;
                    }
                    $out = [];
                }
            }

            // 2. Probe common absolute paths regardless of exec (useful to diagnose
            //    before enabling exec — if gs is installed, it will show here)
            $absolutePaths = [
                '/usr/bin/gs',
                '/usr/local/bin/gs',
                '/usr/bin/ghostscript',
                '/usr/local/bin/ghostscript',
            ];
            $gsExecutable = null;
            foreach ($absolutePaths as $p) {
                if (is_executable($p)) {
                    $gsExecutable = $p;
                    break;
                }
            }

            // Determine effective strategy
            $gsFound = $gsPath ?? $gsExecutable;
            if ($gsFound && $execEnabled) {
                $strategy = 'ghostscript';
            } elseif ($gsExecutable && !$execEnabled) {
                $strategy = 'copy — gs found at ' . $gsExecutable . ' but exec() disabled';
            } elseif ($execEnabled) {
                $strategy = 'copy (gs not found)';
            } else {
                $strategy = 'copy (exec disabled)';
            }

            $payload = [
                'success' => $dbStatus['status'] === 'ok',
                'data' => [
                    'api' => [
                        'status'      => 'ok',
                        'name'        => $_ENV['APP_NAME'] ?? 'MEDMETRIC',
                        'version'     => '1.0.0',
                        'environment' => $_ENV['APP_ENV'] ?? 'development',
                    ],
                    'database'      => $dbStatus,
                    'pdf_processor' => [
                        'exec_available'  => $execEnabled,
                        'gs_in_path'      => $gsPath ?? 'not found',
                        'gs_on_disk'      => $gsExecutable ?? 'not found',
                        'strategy'        => $strategy,
                    ],
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
            $auth->post('/change-password', ChangePasswordAction::class);
        })->add(JwtMiddleware::class);

        // -------------------------------------------------------------------------
        // Timezones catalog (JWT required, any role). Curated allow-list —
        // single source of truth shared by backend validation and the
        // frontend timezone selectors (superadmin org forms, org_admin
        // organization settings). See ListTimezonesAction for the auth
        // rationale.
        // -------------------------------------------------------------------------
        $group->get('/timezones', ListTimezonesAction::class)->add(JwtMiddleware::class);

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
                // Managers relevant to a brand (for material owner resolution)
                $brands->get('/{brandId}/managers', OrgAdminGetBrandManagersAction::class);
            });

            // Materials (Org Admin manages all materials in their organization)
            $orgAdmin->group('/materials', function (RouteCollectorProxy $materials) {
                $materials->get('',               OrgAdminListMaterialsAction::class);
                $materials->get('/{id}',          OrgAdminGetMaterialAction::class);
                $materials->post('',              OrgAdminCreateMaterialAction::class);
                $materials->put('/{id}',          OrgAdminUpdateMaterialAction::class);
                $materials->delete('/{id}',       OrgAdminDeleteMaterialAction::class);
                $materials->post('/{id}/approve', OrgAdminApproveMaterialAction::class);
                $materials->patch('/{id}/visibility', OrgAdminSetMaterialVisibilityAction::class);
                $materials->get('/{id}/preview',  PreviewMaterialAction::class);

                // Studies nested under a material ({id} = materialId)
                $materials->get('/{id}/studies',  OrgAdminListStudyAction::class);
                $materials->post('/{id}/studies', OrgAdminCreateStudyAction::class);
            });

            // Studies ({id} = studyId)
            $orgAdmin->group('/studies', function (RouteCollectorProxy $studies) {
                $studies->put('/{id}',           OrgAdminUpdateStudyAction::class);
                $studies->delete('/{id}',        OrgAdminDeleteStudyAction::class);
                $studies->get('/{id}/preview',   PreviewStudyAction::class);
            });

            // Manager brand assignments
            $orgAdmin->group('/managers/{managerId}/brands', function (RouteCollectorProxy $mb) {
                $mb->get('',  GetManagerBrandsAction::class);
                $mb->post('', AssignBrandsToManagerAction::class);
                $mb->delete('', RemoveBrandsFromManagerAction::class);
            });

            // Organization (org_admin manages ONLY their own organization's
            // settings, e.g. timezone — no {id} param, resolved from the
            // authenticated user's organization_id, see
            // GetMyOrganizationAction / UpdateMyOrganizationAction)
            $orgAdmin->group('/organization', function (RouteCollectorProxy $org) {
                $org->get('', GetMyOrganizationAction::class);
                $org->put('', UpdateMyOrganizationAction::class);
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
                $materials->get('/{id}',       ManagerGetMaterialAction::class);
                $materials->post('',           CreateMaterialAction::class);
                $materials->put('/{id}',       UpdateMaterialAction::class);
                $materials->post('/{id}/approve', ApproveMaterialAction::class);
                $materials->patch('/{id}/visibility', SetMaterialVisibilityAction::class);
                $materials->get('/{id}/preview', PreviewMaterialAction::class);

                // Studies nested under a material ({id} = materialId)
                $materials->get('/{id}/studies',  ManagerListStudyAction::class);
                $materials->post('/{id}/studies', ManagerCreateStudyAction::class);
            });

            // Studies ({id} = studyId)
            $manager->group('/studies', function (RouteCollectorProxy $studies) {
                $studies->put('/{id}',           ManagerUpdateStudyAction::class);
                $studies->delete('/{id}',        ManagerDeleteStudyAction::class);
                $studies->get('/{id}/preview',   PreviewStudyAction::class);
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
            $rep->get('/materials/{id}/preview', PreviewMaterialAction::class);

            // Studies - shared preview Action (org-scoped internally)
            $rep->get('/studies/{id}/preview', PreviewStudyAction::class);

            // Visit Sessions
            $rep->group('/visit-sessions', function (RouteCollectorProxy $sessions) {
                $sessions->get('',  ListVisitSessionsAction::class);
                $sessions->post('', CreateVisitSessionAction::class);
                $sessions->patch('/{id}/materials', AddMaterialsToSessionAction::class);
            });

            // Rep-scoped metrics (sdd/rep-metrics-module). repId is ALWAYS
            // resolved from the JWT (RepMetricsAction::resolveRepId()) —
            // never from a query param. Inherits this group's JWT +
            // RoleMiddleware(['rep']) below; no separate middleware wiring
            // needed since a rep can only ever see their own data here.
            $rep->group('/metrics', function (RouteCollectorProxy $metrics) {
                $metrics->get('/summary', RepMetricsSummaryAction::class);
                $metrics->get('/open-trend', RepMetricsOpenTrendAction::class);
                $metrics->get('/hour-histogram', RepMetricsHourHistogramAction::class);
                $metrics->get('/device-split', RepMetricsDeviceSplitAction::class);
                $metrics->get('/top-materials', RepMetricsTopMaterialsAction::class);
                $metrics->get('/sessions', RepMetricsSessionsAction::class);
                $metrics->get('/unopened-materials', RepMetricsUnopenedMaterialsAction::class);
            });

        })->add(function ($request, $handler) use ($app) {
            $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
            return (new RoleMiddleware($responseFactory, ['rep']))->process($request, $handler);
        })->add(JwtMiddleware::class);

        // -------------------------------------------------------------------------
        // Doctors routes (JWT + roles in DoctorAccessConfig::MANAGE_ROLES)
        // Shared doctor directory used by org_admin/manager/rep. Deleting a
        // doctor is further restricted to DoctorAccessConfig::DELETE_ROLES.
        // -------------------------------------------------------------------------
        $group->group('/doctors', function (RouteCollectorProxy $doctors) use ($app) {
            $doctors->get('/reps/search', RepSearchAction::class);
            $doctors->get('/search', SearchDoctorsAction::class);
            $doctors->get('',        ListDoctorsAction::class);
            $doctors->post('',       CreateDoctorAction::class);
            $doctors->put('/{id}',   UpdateDoctorAction::class);

            $doctors->delete('/{id}', DeleteDoctorAction::class)
                ->add(function ($request, $handler) use ($app) {
                    $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
                    return (new RoleMiddleware($responseFactory, DoctorAccessConfig::DELETE_ROLES))->process($request, $handler);
                });
        })->add(function ($request, $handler) use ($app) {
            $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
            return (new RoleMiddleware($responseFactory, DoctorAccessConfig::MANAGE_ROLES))->process($request, $handler);
        })->add(JwtMiddleware::class);

        // -------------------------------------------------------------------------
        // Metrics routes (JWT + org_admin or manager role required)
        // -------------------------------------------------------------------------
        $group->group('/metrics', function (RouteCollectorProxy $metrics) {
            $metrics->get('/material-views', GetMaterialViewsAction::class);
            $metrics->get('/material-views-list', GetMaterialViewsListAction::class);
            $metrics->get('/rep-last-login', GetRepLastLoginAction::class);
            $metrics->get('/top-materials', GetTopMaterialsAction::class);
            $metrics->get('/top-materials-list', GetTopMaterialsListAction::class);
            $metrics->get('/rep-adoption', GetRepAdoptionAction::class);
            $metrics->get('/study-views', GetStudyViewsAction::class);
            $metrics->get('/study-views-list', GetStudyViewsListAction::class);
        })->add(function ($request, $handler) use ($app) {
            $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
            return (new RoleMiddleware($responseFactory, ['org_admin', 'manager']))->process($request, $handler);
        })->add(JwtMiddleware::class);

        // -------------------------------------------------------------------------
        // Comment routes (JWT + CommentAccessConfig roles). superadmin is
        // deliberately EXCLUDED from every allow-list here (locked decision).
        // -------------------------------------------------------------------------
        $group->group('/comments', function (RouteCollectorProxy $comments) use ($app) {
            $comments->get('', ListCommentsAction::class);
            $comments->post('', CreateCommentAction::class);

            $comments->delete('/{id}', DeleteCommentAction::class)
                ->add(function ($request, $handler) use ($app) {
                    $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
                    return (new RoleMiddleware($responseFactory, CommentAccessConfig::DELETE_ROLES))->process($request, $handler);
                });
        })->add(function ($request, $handler) use ($app) {
            $responseFactory = $app->getContainer()->get(ResponseFactoryInterface::class);
            return (new RoleMiddleware($responseFactory, CommentAccessConfig::LIST_ROLES))->process($request, $handler);
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

            // Study resource endpoint (nested study links opened by the doctor)
            $public->group('/study/{id}', function (RouteCollectorProxy $study) {
                $study->get('/resource', GetStudyResourceAction::class);
            });

            // Doctor comments on their own visit session (no auth — token IS
            // the credential). See CommentAccessConfig for the authenticated
            // equivalent; superadmin/doctor-delete never exist for this route.
            $public->group('/session/{token}/comments', function (RouteCollectorProxy $comments) {
                $comments->get('', ListPublicCommentsAction::class);
                $comments->post('', CreatePublicCommentAction::class);
            });
            
        });

    });
};
