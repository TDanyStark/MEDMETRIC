import { createElement, lazy, type ReactNode } from 'react'
import { Role } from '@/types'

// Paginas neutras (sin prefijo de rol) referenciadas por APP_ROUTES.
//
// NOTA (route-role-prefix-removal, batch 2 = Fases 4-5): las 5 rutas que
// colisionaban entre componentes DISTINTOS segun el rol (`/metrics`,
// `/brands`, `/materials`, `/materials/new`, `/materials/:id/edit`) ya
// tienen su dispatcher por rol (`MetricsPage`, `BrandsPage`,
// `MaterialsPage`, `MaterialFormPage` — este ultimo deriva `scope` de
// `useAuth().user.role` en vez de recibirlo por prop) y viven aca junto con
// las demas 10 rutas. Ya no quedan bloques con prefijo de rol en `App.tsx`.
const RoleHomePage = lazy(() => import('@/pages/RoleHomePage'))
const SuperAdminOrganizationsPage = lazy(() =>
  import('@/pages/superadmin/SuperAdminOrganizationsPage').then(m => ({
    default: m.SuperAdminOrganizationsPage,
  })),
)
const SuperAdminOrgAdminsPage = lazy(() =>
  import('@/pages/superadmin/SuperAdminOrgAdminsPage').then(m => ({
    default: m.SuperAdminOrgAdminsPage,
  })),
)
const OrgAdminUsersPage = lazy(() =>
  import('@/pages/org-admin/OrgAdminUsersPage').then(m => ({ default: m.OrgAdminUsersPage })),
)
const OrgAdminOrganizationPage = lazy(() =>
  import('@/pages/org-admin/OrgAdminOrganizationPage').then(m => ({
    default: m.OrgAdminOrganizationPage,
  })),
)
const ManagerRepsPage = lazy(() =>
  import('@/pages/manager/ManagerRepsPage').then(m => ({ default: m.ManagerRepsPage })),
)
const RepLibraryPage = lazy(() =>
  import('@/pages/rep/RepLibraryPage').then(m => ({ default: m.RepLibraryPage })),
)
const RepHistoryPage = lazy(() =>
  import('@/pages/rep/RepHistoryPage').then(m => ({ default: m.RepHistoryPage })),
)
const DoctorsPage = lazy(() =>
  import('@/pages/doctors/DoctorsPage').then(m => ({ default: m.DoctorsPage })),
)
const CommentsPage = lazy(() =>
  import('@/pages/comments/CommentsPage').then(m => ({ default: m.CommentsPage })),
)
const MetricsPage = lazy(() =>
  import('@/pages/metrics/MetricsPage').then(m => ({ default: m.MetricsPage })),
)
const BrandsPage = lazy(() =>
  import('@/pages/brands/BrandsPage').then(m => ({ default: m.BrandsPage })),
)
const MaterialsPage = lazy(() =>
  import('@/pages/materials/MaterialsPage').then(m => ({ default: m.MaterialsPage })),
)
const MaterialFormPage = lazy(() =>
  import('@/pages/materials/MaterialFormPage').then(m => ({ default: m.MaterialFormPage })),
)

const ALL_ROLES = ['superadmin', 'org_admin', 'manager', 'rep'] as const

export type RoleList = readonly Role[]

export interface RouteDef {
  /** Path neutro, sin rol embebido. */
  readonly path: string
  /** Componente ya envuelto en `lazy()` — evita ciclos de import y preserva code-splitting. */
  readonly element: ReactNode
  /** Allow-list de roles que pueden acceder a esta ruta. */
  readonly roles: RoleList
  /**
   * Paths viejos con prefijo de rol que deben redirigir (`<Navigate replace>`)
   * a `path`, preservando query params y segmentos dinamicos.
   * Transitorio — retirable en un cambio futuro (Fase 7).
   */
  readonly legacy?: readonly string[]
}

export const APP_ROUTES = [
  {
    path: '/',
    element: createElement(RoleHomePage),
    roles: ALL_ROLES,
    // Bare role-root paths (`/superadmin`, `/org-admin`, `/manager`, `/rep`)
    // used to redirect here via each role block's `index` route in
    // App.tsx (batch 1). Removing those blocks in Fase 4 (their only other
    // purpose — hosting the metrics/brands/materials sub-routes — moved
    // into APP_ROUTES) would silently 404 them without this: they MUST
    // keep redirecting to `/`, same as every other legacy path.
    legacy: ['/superadmin', '/org-admin', '/manager', '/rep'],
  },
  {
    path: '/organizations',
    element: createElement(SuperAdminOrganizationsPage),
    roles: ['superadmin'],
    legacy: ['/superadmin/organizations'],
  },
  {
    path: '/org-admins',
    element: createElement(SuperAdminOrgAdminsPage),
    roles: ['superadmin'],
    legacy: ['/superadmin/org-admins'],
  },
  {
    path: '/users',
    element: createElement(OrgAdminUsersPage),
    roles: ['org_admin'],
    legacy: ['/org-admin/users'],
  },
  {
    path: '/organization',
    element: createElement(OrgAdminOrganizationPage),
    roles: ['org_admin'],
    legacy: ['/org-admin/organization'],
  },
  {
    path: '/reps',
    element: createElement(ManagerRepsPage),
    roles: ['manager'],
    legacy: ['/manager/reps'],
  },
  {
    path: '/library',
    element: createElement(RepLibraryPage),
    roles: ['rep'],
    legacy: ['/rep/library'],
  },
  {
    path: '/history',
    element: createElement(RepHistoryPage),
    roles: ['rep'],
    legacy: ['/rep/history'],
  },
  {
    path: '/doctors',
    element: createElement(DoctorsPage),
    roles: ['org_admin', 'manager', 'rep'],
    legacy: ['/org-admin/doctors', '/manager/doctors', '/rep/doctors'],
  },
  {
    path: '/comments',
    element: createElement(CommentsPage),
    roles: ['org_admin', 'manager', 'rep'],
    legacy: ['/org-admin/comments', '/manager/comments', '/rep/comments'],
  },
  {
    path: '/metrics',
    element: createElement(MetricsPage),
    roles: ALL_ROLES,
    legacy: ['/superadmin/metrics', '/org-admin/metrics', '/manager/metrics', '/rep/metrics'],
  },
  {
    path: '/brands',
    element: createElement(BrandsPage),
    roles: ['org_admin', 'manager'],
    legacy: ['/org-admin/brands', '/manager/brands'],
  },
  {
    path: '/materials',
    element: createElement(MaterialsPage),
    roles: ['org_admin', 'manager'],
    legacy: ['/org-admin/materials', '/manager/materials'],
  },
  {
    path: '/materials/new',
    element: createElement(MaterialFormPage),
    roles: ['org_admin', 'manager'],
    legacy: ['/org-admin/materials/new', '/manager/materials/new'],
  },
  {
    path: '/materials/:id/edit',
    element: createElement(MaterialFormPage),
    roles: ['org_admin', 'manager'],
    legacy: ['/org-admin/materials/:id/edit', '/manager/materials/:id/edit'],
  },
] as const satisfies readonly RouteDef[]

export type AppPath = (typeof APP_ROUTES)[number]['path']

/**
 * Resuelve un `AppPath` a una URL concreta, reemplazando tokens `:param` con
 * `params`. Sin params, devuelve el path tal cual (paths estaticos).
 */
export function routePath<P extends AppPath>(
  path: P,
  params?: Record<string, string | number | undefined>,
): string {
  if (!params) {
    return path
  }

  return path.replace(/:([a-zA-Z0-9_]+)/g, (match, key: string) => {
    const value = params[key]
    return value !== undefined ? String(value) : match
  })
}
