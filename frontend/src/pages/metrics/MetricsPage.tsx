import { lazy } from 'react'

import { useDispatchRole } from '@/lib/roleDispatch'

const SuperAdminMetricsPage = lazy(() =>
  import('@/pages/superadmin/SuperAdminMetricsPage').then(m => ({ default: m.SuperAdminMetricsPage })),
)
const OrgAdminMetricsPage = lazy(() =>
  import('@/pages/org-admin/OrgAdminMetricsPage').then(m => ({ default: m.OrgAdminMetricsPage })),
)
const ManagerMetricsPage = lazy(() =>
  import('@/pages/manager/ManagerMetricsPage').then(m => ({ default: m.ManagerMetricsPage })),
)
const RepMetricsPage = lazy(() =>
  import('@/pages/rep/RepMetricsPage').then(m => ({ default: m.RepMetricsPage })),
)

/**
 * Dispatcher for the unified `/metrics` route (route-role-prefix-removal,
 * Fase 4). The 4 roles land on genuinely different components — most
 * notably `SuperAdminMetricsPage`, which doesn't use `MetricsDashboard` at
 * all — so this stays a thin switch instead of merging them into one
 * mega-component (design decision: "Branching por rol en páginas
 * compartidas", `sdd/route-role-prefix-removal/design`).
 *
 * Role comes strictly from `useDispatchRole()` (wraps `useAuth().user.role`
 * — never the URL, a prop, or a default). An unmatched role falls through
 * to `null`, never to any branch — see `lib/roleDispatch.ts`.
 */
export function MetricsPage() {
  const role = useDispatchRole()

  switch (role) {
    case 'superadmin':
      return <SuperAdminMetricsPage />
    case 'org_admin':
      return <OrgAdminMetricsPage />
    case 'manager':
      return <ManagerMetricsPage />
    case 'rep':
      return <RepMetricsPage />
    default:
      return null
  }
}
