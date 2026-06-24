import { useQueries } from '@tanstack/react-query'
import { Network, Tags, Users } from 'lucide-react'

import {
  listOrgBrands,
  listOrgUsers,
} from '@/services/backoffice'
import { MetricsDashboard } from '@/components/backoffice/MetricsDashboard'

export function OrgAdminMetricsPage() {
  const [managersQuery, repsQuery, brandsQuery] = useQueries({
    queries: [
      { queryKey: ['org-admin', 'metrics', 'managers'], queryFn: () => listOrgUsers({ role: 'manager', page: 1 }) },
      { queryKey: ['org-admin', 'metrics', 'reps'], queryFn: () => listOrgUsers({ role: 'rep', page: 1 }) },
      { queryKey: ['org-admin', 'metrics', 'brands'], queryFn: () => listOrgBrands({ page: 1 }) },
    ],
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Vista General</h1>
        <p className="mt-2 text-sm text-muted-foreground">Métricas operativas de la organización.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-muted-foreground">Gerentes</p>
            <p className="text-2xl font-display font-medium text-foreground">{managersQuery.data?.total ?? 0}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Network className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-muted-foreground">Visitadores</p>
            <p className="text-2xl font-display font-medium text-foreground">{repsQuery.data?.total ?? 0}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Tags className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-medium text-muted-foreground">Marcas</p>
            <p className="text-2xl font-display font-medium text-foreground">{brandsQuery.data?.total ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-display font-semibold tracking-tight text-foreground mb-6">Métricas de Consumo de Contenido</h2>
        <MetricsDashboard />
      </div>
    </div>
  )
}
