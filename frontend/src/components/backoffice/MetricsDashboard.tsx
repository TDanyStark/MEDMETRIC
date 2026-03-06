import { useQuery } from '@tanstack/react-query'
import { LogIn, TrendingUp, Presentation, FileText, CheckCircle2 } from 'lucide-react'
import { metricsApi } from '@/services/metrics'
import { cn } from '@/lib/utils'
import { MaterialViewsTable } from './MaterialViewsTable'

export function MetricsDashboard() {
  const { data: viewsData, isLoading: isLoadingViews } = useQuery({
    queryKey: ['metrics', 'material-views'],
    queryFn: () => metricsApi.getMaterialViews().then(res => res.data)
  })

  const { data: topMaterials, isLoading: isLoadingTop } = useQuery({
    queryKey: ['metrics', 'top-materials'],
    queryFn: () => metricsApi.getTopMaterials(10).then(res => res.data)
  })

  const { data: repsLogin, isLoading: isLoadingLogins } = useQuery({
    queryKey: ['metrics', 'rep-last-login'],
    queryFn: () => metricsApi.getRepLastLogin().then(res => res.data)
  })

  // Basic stats calc
  const totalViews = viewsData?.reduce((acc, curr) => acc + curr.views, 0) ?? 0
  const activeReps = repsLogin?.filter(rep => rep.last_login_at !== null).length ?? 0
  const totalReps = repsLogin?.length ?? 0
  const activePercent = totalReps > 0 ? Math.round((activeReps / totalReps) * 100) : 0

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      
      {/* Resumen Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">Visualizaciones (30d)</h3>
          </div>
          <p className="mt-2 text-4xl font-display font-medium text-foreground">{isLoadingViews ? '-' : totalViews}</p>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">Adopción de Equipo</h3>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-4xl font-display font-medium text-foreground">{isLoadingLogins ? '-' : `${activePercent}%`}</p>
            <span className="text-sm text-muted-foreground">{activeReps} de {totalReps} activos</span>
          </div>
        </div>
        
        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <Presentation className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-lg text-foreground">Materiales Destacados</h3>
          </div>
          <p className="mt-2 text-4xl font-display font-medium text-foreground">{isLoadingTop ? '-' : (topMaterials?.length ?? 0)}</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Top Materiales */}
        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-xl font-display font-medium">Materiales más vistos</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
                <tr>
                  <th className="px-4 py-3 font-medium rounded-tl-lg">Material</th>
                  <th className="px-4 py-3 font-medium text-center">Tipo</th>
                  <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Vistas totales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoadingTop ? (
                   <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td>
                   </tr>
                ) : topMaterials?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No hay datos de visualizaciones aún</td>
                  </tr>
                ) : (
                  topMaterials?.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{item.title}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          item.type === 'pdf' ? "bg-red-500/10 text-red-500" : 
                          item.type === 'video' ? "bg-blue-500/10 text-blue-500" : 
                          "bg-purple-500/10 text-purple-500"
                        )}>
                          {item.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-display font-medium">{item.total_views}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Últimos Logins */}
        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <LogIn className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-xl font-display font-medium">Actividad reciente (Visitadores)</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
                <tr>
                  <th className="px-4 py-3 font-medium rounded-tl-lg">Nombre</th>
                  <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Último acceso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoadingLogins ? (
                   <tr>
                     <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td>
                   </tr>
                ) : repsLogin?.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">No hay visitadores</td>
                  </tr>
                ) : (
                  repsLogin?.slice(0, 8).map((rep) => (
                    <tr key={rep.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div>{rep.name}</div>
                        <div className="text-xs text-muted-foreground font-normal">{rep.email}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rep.last_login_at ? (
                          <span className="text-muted-foreground">
                            {new Date(rep.last_login_at).toLocaleDateString()} a las {new Date(rep.last_login_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs italic">Nunca</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Tabla detallada de visualizaciones */}
      <MaterialViewsTable />
    </div>
  )
}
