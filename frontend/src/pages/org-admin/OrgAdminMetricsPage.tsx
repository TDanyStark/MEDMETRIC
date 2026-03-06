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

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">Gerentes</h3>
          <p className="mt-2 text-4xl font-display text-foreground">{managersQuery.data?.total ?? 0}</p>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Network className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">Visitadores</h3>
          <p className="mt-2 text-4xl font-display text-foreground">{repsQuery.data?.total ?? 0}</p>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Tags className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">Marcas</h3>
          <p className="mt-2 text-4xl font-display text-foreground">{brandsQuery.data?.total ?? 0}</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-display font-semibold tracking-tight text-foreground mb-6">Métricas de Consumo de Contenido</h2>
        <MetricsDashboard />
      </div>
    </div>
  )
}
