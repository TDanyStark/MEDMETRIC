import { lazy } from 'react'

import { useDispatchRole } from '@/lib/roleDispatch'

const OrgAdminBrandsPage = lazy(() =>
  import('@/pages/org-admin/OrgAdminBrandsPage').then(m => ({ default: m.OrgAdminBrandsPage })),
)
const ManagerBrandsPage = lazy(() =>
  import('@/pages/manager/ManagerBrandsPage').then(m => ({ default: m.ManagerBrandsPage })),
)

/**
 * Dispatcher for the unified `/brands` route (route-role-prefix-removal,
 * Fase 4). `OrgAdminBrandsPage` (full CRUD + manager assignment) and
 * `ManagerBrandsPage` (read-only) are genuinely different components — this
 * stays a dispatcher, not a merge, so `ManagerBrandsPage` never gains the
 * create/edit affordances it isn't allowed to expose.
 *
 * Role comes strictly from `useDispatchRole()` (wraps `useAuth().user.role`
 * — never the URL, a prop, or a default). An unmatched role (`superadmin`,
 * `rep`, or unauthenticated) falls through to `null` — it must NOT default
 * to the CRUD variant. See `lib/roleDispatch.ts`.
 */
export function BrandsPage() {
  const role = useDispatchRole()

  switch (role) {
    case 'org_admin':
      return <OrgAdminBrandsPage />
    case 'manager':
      return <ManagerBrandsPage />
    default:
      return null
  }
}
