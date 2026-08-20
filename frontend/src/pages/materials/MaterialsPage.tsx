import { lazy } from 'react'

import { useDispatchRole } from '@/lib/roleDispatch'

const OrgAdminMaterialsPage = lazy(() =>
  import('@/pages/org-admin/OrgAdminMaterialsPage').then(m => ({ default: m.OrgAdminMaterialsPage })),
)
const ManagerMaterialsPage = lazy(() =>
  import('@/pages/manager/ManagerMaterialsPage').then(m => ({ default: m.ManagerMaterialsPage })),
)

/**
 * Dispatcher for the unified `/materials` route (route-role-prefix-removal,
 * Fase 4). `OrgAdminMaterialsPage` (manager filter/column + delete) and
 * `ManagerMaterialsPage` (no manager filter, no delete, `lockApprovedEdit`)
 * stay separate components — this is a dispatcher, NOT a fusion, precisely
 * so `ManagerMaterialsPage` can never render the delete action org_admin
 * has. Each already persists its own filters in the URL via
 * `useSearchParams`; unifying the path doesn't touch that.
 *
 * Role comes strictly from `useDispatchRole()` (wraps `useAuth().user.role`
 * — never the URL, a prop, or a default). An unmatched role falls through
 * to `null` — it must NOT default to the org_admin variant (which can
 * delete). See `lib/roleDispatch.ts`.
 */
export function MaterialsPage() {
  const role = useDispatchRole()

  switch (role) {
    case 'org_admin':
      return <OrgAdminMaterialsPage />
    case 'manager':
      return <ManagerMaterialsPage />
    default:
      return null
  }
}
