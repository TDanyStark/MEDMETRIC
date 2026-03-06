import { useQueries } from '@tanstack/react-query'
import { Building2, ShieldCheck } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { getNullableNumberParam } from '@/lib/search'
import {
  listOrgAdmins,
  listOrganizations,
} from '@/services/backoffice'
import { LoadingState } from './components/SuperAdminHelpers'

export function SuperAdminMetricsPage() {
  const [searchParams] = useSearchParams()
  const organizationId = getNullableNumberParam(searchParams, 'organization_id')

  const [organizationsQuery, orgAdminsQuery] = useQueries({
    queries: [
      {
        queryKey: ['superadmin', 'metrics', 'organizations'],
        queryFn: () => listOrganizations({ page: 1 }),
      },
      {
        queryKey: ['superadmin', 'metrics', 'org-admins', organizationId],
        queryFn: () => listOrgAdmins({ page: 1, organization_id: organizationId }),
      },
    ],
  })

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Métricas Generales</h1>
        <p className="mt-2 text-sm text-muted-foreground">Estado operativo y resumen del alcance de la plataforma.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg text-foreground">Organizaciones</h3>
          </div>
          <p className="mt-4 text-5xl font-display text-foreground">{organizationsQuery.data?.total ?? 0}</p>
          <p className="mt-2 text-sm text-muted-foreground">Total de clientes manejados en el portal actual.</p>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg text-foreground">Admins Activos</h3>
          </div>
          <p className="mt-4 text-5xl font-display text-foreground">{orgAdminsQuery.data?.total ?? 0}</p>
          <p className="mt-2 text-sm text-muted-foreground">Responsables habilitados con permisos de acceso.</p>
        </div>
      </div>
    </div>
  )
}
