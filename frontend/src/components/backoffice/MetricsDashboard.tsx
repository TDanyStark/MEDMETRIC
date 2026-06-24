import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  Presentation,
  FileText,
  CheckCircle2,
  Eye,
  Stethoscope,
  X,
} from 'lucide-react'
import { metricsApi } from '@/services/metrics'
import { cn } from '@/lib/utils'
import { getStringParam, getNumberArrayParam, updateSearchParams } from '@/lib/search'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MultiMaterialSelect } from '@/components/ui/MultiMaterialSelect'
import { MultiRepSelect } from '@/components/ui/MultiRepSelect'
import { DatePicker } from '@/components/ui/DatePicker'
import { MaterialViewsTable } from './MaterialViewsTable'
import { ViewsTrendChart } from './ViewsTrendChart'
import { TopMaterialsChart } from './TopMaterialsChart'
import { RepAdoptionTable } from './RepAdoptionTable'

export function MetricsDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()

  const materialIds = getNumberArrayParam(searchParams, 'material_id')
  const repIds = getNumberArrayParam(searchParams, 'rep_id')
  const startDate = getStringParam(searchParams, 'start_date')
  const endDate = getStringParam(searchParams, 'end_date')

  // Stable string keys for react-query cache invalidation.
  const materialKey = materialIds.join(',')
  const repKey = repIds.join(',')

  const setIdsFilter = (key: string, ids: number[]) => {
    setSearchParams(
      (prev) => updateSearchParams(prev, { [key]: ids.length ? ids.join(',') : null, page: null }),
      { replace: true },
    )
  }

  const setDateFilter = (key: string, value: string) => {
    setSearchParams(
      (prev) => updateSearchParams(prev, { [key]: value, page: null }),
      { replace: true },
    )
  }

  const toggleRep = (repId: number) => {
    const next = repIds.includes(repId)
      ? repIds.filter((id) => id !== repId)
      : [...repIds, repId]
    setIdsFilter('rep_id', next)
  }

  const clearFilters = () => {
    setSearchParams(
      (prev) =>
        updateSearchParams(prev, {
          material_id: null,
          rep_id: null,
          start_date: null,
          end_date: null,
          page: null,
        }),
      { replace: true },
    )
  }

  const hasFilters = Boolean(
    materialIds.length || repIds.length || startDate || endDate,
  )

  const filterArgs = {
    material_id: materialIds.length ? materialIds : undefined,
    rep_id: repIds.length ? repIds : undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  }

  const { data: viewsData, isLoading: isLoadingViews } = useQuery({
    queryKey: ['metrics', 'material-views', materialKey, repKey, startDate, endDate],
    queryFn: () => metricsApi.getMaterialViews(filterArgs).then((res) => res.data),
  })

  const { data: topMaterials, isLoading: isLoadingTop } = useQuery({
    queryKey: ['metrics', 'top-materials', materialKey, repKey, startDate, endDate],
    queryFn: () => metricsApi.getTopMaterials(10, filterArgs).then((res) => res.data),
  })

  const { data: repsLogin, isLoading: isLoadingLogins } = useQuery({
    queryKey: ['metrics', 'rep-last-login'],
    queryFn: () => metricsApi.getRepLastLogin().then((res) => res.data),
  })

  // Aggregated stats
  const repViews = viewsData?.reduce(
    (acc, curr) => acc + (curr.viewer_type === 'rep' ? Number(curr.views) : 0),
    0,
  ) ?? 0
  const doctorViews = viewsData?.reduce(
    (acc, curr) => acc + (curr.viewer_type === 'doctor' ? Number(curr.views) : 0),
    0,
  ) ?? 0
  const totalViews = repViews + doctorViews

  const activeReps = repsLogin?.filter((rep) => rep.last_login_at !== null).length ?? 0
  const totalReps = repsLogin?.length ?? 0
  const activePercent = totalReps > 0 ? Math.round((activeReps / totalReps) * 100) : 0

  const materialsWithViews = topMaterials?.filter((m) => Number(m.total_views) > 0).length ?? 0
  const totalMaterials = topMaterials?.length ?? 0

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      {/* Filtros globales */}
      <div className="rounded-3xl border border-border/50 bg-background/50 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5 min-w-[260px] flex-1">
            <label className="text-xs font-medium text-muted-foreground">Materiales</label>
            <MultiMaterialSelect
              value={materialIds}
              onChange={(ids) => setIdsFilter('material_id', ids)}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5 min-w-[260px] flex-1">
            <label className="text-xs font-medium text-muted-foreground">Representantes</label>
            <MultiRepSelect
              value={repIds}
              onChange={(ids) => setIdsFilter('rep_id', ids)}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Desde</label>
            <DatePicker
              value={startDate}
              onChange={(val) => setDateFilter('start_date', val || '')}
              placeholder="Desde"
              className="w-[180px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hasta</label>
            <DatePicker
              value={endDate}
              onChange={(val) => setDateFilter('end_date', val || '')}
              placeholder="Hasta"
              className="w-[180px]"
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Resumen Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-border/50 bg-background/50 p-5 shadow-sm flex flex-col items-start">
          <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">Visualizaciones</h3>
          <p className="mt-1 text-4xl font-display font-medium text-foreground">
            {isLoadingViews ? '-' : totalViews}
          </p>
          <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-purple-500" /> {repViews} visitadores
            </span>
            <span className="flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5 text-teal-500" /> {doctorViews} médicos
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/50 p-5 shadow-sm flex flex-col items-start">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">Adopción de Equipo</h3>
          <p className="mt-1 text-4xl font-display font-medium text-foreground">
            {isLoadingLogins ? '-' : `${activePercent}%`}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {activeReps} de {totalReps} visitadores con acceso registrado
          </p>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/50 p-5 shadow-sm flex flex-col items-start">
          <div className="h-10 w-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3">
            <Presentation className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">Materiales activos</h3>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-4xl font-display font-medium text-foreground">
              {isLoadingTop ? '-' : materialsWithViews}
            </p>
            <span className="text-sm text-muted-foreground">de {totalMaterials}</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">con al menos una visualización</p>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/50 p-5 shadow-sm flex flex-col items-start">
          <div className="h-10 w-10 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center mb-3">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">Promedio por material</h3>
          <p className="mt-1 text-4xl font-display font-medium text-foreground">
            {isLoadingTop || totalMaterials === 0
              ? '-'
              : Math.round(totalViews / Math.max(1, materialsWithViews))}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">vistas por material activo</p>
        </div>
      </div>

      {/* Tendencia + Top materiales */}
      <div className="grid gap-8 xl:grid-cols-2">
        <ViewsTrendChart data={viewsData} isLoading={isLoadingViews} />
        <TopMaterialsChart data={topMaterials} isLoading={isLoadingTop} />
      </div>

      {/* Adopción por representante */}
      <RepAdoptionTable
        repIds={repIds}
        startDate={startDate}
        endDate={endDate}
        onToggleRep={toggleRep}
      />

      {/* Tabla detallada de materiales más vistos */}
      <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-xl font-display font-medium">Detalle de materiales</h3>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium text-center">Tipo</th>
                <th className="px-4 py-3 font-medium text-right">Visitadores</th>
                <th className="px-4 py-3 font-medium text-right">Médicos</th>
                <th className="px-4 py-3 font-medium text-right">Reps únicos</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoadingTop ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Cargando...
                  </td>
                </tr>
              ) : topMaterials?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No hay datos de visualizaciones aún
                  </td>
                </tr>
              ) : (
                topMaterials?.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate max-w-[220px] block cursor-default">
                            {item.title}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{item.title}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          item.type === 'pdf'
                            ? 'bg-red-500/10 text-red-500'
                            : item.type === 'video'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-purple-500/10 text-purple-500',
                        )}
                      >
                        {item.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {Number(item.rep_views)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {Number(item.doctor_views)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {Number(item.unique_reps)}
                    </td>
                    <td className="px-4 py-3 text-right font-display font-medium text-foreground">
                      {Number(item.total_views)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registro detallado de visualizaciones */}
      <MaterialViewsTable
        materialIds={materialIds}
        repIds={repIds}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  )
}
