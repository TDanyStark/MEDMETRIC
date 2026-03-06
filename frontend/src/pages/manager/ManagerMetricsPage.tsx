import { MetricsDashboard } from '@/components/backoffice/MetricsDashboard'

export function ManagerMetricsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Métricas Interactivas</h1>
        <p className="mt-2 text-sm text-muted-foreground">Consulta el impacto y el rendimiento de tus materiales interactivos en campo.</p>
      </div>

      <MetricsDashboard />
    </div>
  )
}
