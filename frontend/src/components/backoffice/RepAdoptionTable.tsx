import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Eye, Layers, Filter } from 'lucide-react'
import { metricsApi } from '@/services/metrics'
import { cn, formatDateTime, getInitials } from '@/lib/utils'
import { PaginationBar } from '@/components/backoffice/Workbench'
import { useAuth } from '@/contexts/useAuth'
import { useDidDepsChange } from '@/hooks/useDidDepsChange'

interface RepAdoptionTableProps {
  repIds: number[]
  startDate: string
  endDate: string
  onToggleRep: (repId: number) => void
}

function adoptionColor(percent: number): string {
  if (percent >= 75) return 'bg-emerald-500'
  if (percent >= 40) return 'bg-amber-500'
  if (percent > 0) return 'bg-orange-500'
  return 'bg-muted-foreground/30'
}

export function RepAdoptionTable({
  repIds,
  startDate,
  endDate,
  onToggleRep,
}: RepAdoptionTableProps) {
  const { user } = useAuth()
  const repKey = repIds.join(',')
  const [page, setPage] = useState(1)

  // Reset to first page whenever any global filter changes. Adjusted during
  // render (not in an effect) — see useDidDepsChange for rationale.
  if (useDidDepsChange([repKey, startDate, endDate])) {
    setPage(1)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['metrics', 'rep-adoption', repKey, startDate, endDate, page],
    queryFn: () =>
      metricsApi
        .getRepAdoption({
          rep_id: repIds.length ? repIds : undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          page,
        })
        .then((res) => res.data),
  })

  const reps = data?.items ?? []
  const meta = data?.meta

  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-xl font-display font-medium">
          Adopción por representante
        </h3>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
            <tr>
              <th className="px-4 py-3 font-medium">Representante</th>
              <th className="px-4 py-3 font-medium text-center">
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" /> Materiales
                </span>
              </th>
              <th className="px-4 py-3 font-medium text-center">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> Vistas
                </span>
              </th>
              <th className="px-4 py-3 font-medium min-w-[180px]">Adopción</th>
              <th className="px-4 py-3 font-medium text-right">Última actividad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  Cargando datos...
                </td>
              </tr>
            ) : reps.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  No hay representantes en este alcance
                </td>
              </tr>
            ) : (
              reps.map((rep) => {
                const percent = Number(rep.adoption_percent) || 0
                const distinct = Number(rep.distinct_materials) || 0
                const available = Number(rep.available_materials) || 0
                const totalViews = Number(rep.total_views) || 0
                const isSelected = repIds.includes(rep.rep_id)
                return (
                  <tr
                    key={rep.rep_id}
                    onClick={() => onToggleRep(rep.rep_id)}
                    className={cn(
                      'group cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/30',
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {getInitials(rep.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate max-w-[180px]">
                            {rep.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {rep.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-display font-medium text-foreground">
                        {distinct}
                      </span>
                      <span className="text-xs text-muted-foreground"> / {available}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-display font-medium text-foreground">
                      {totalViews}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', adoptionColor(percent))}
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
                        <span className="w-9 text-right text-xs font-medium text-foreground">
                          {percent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {rep.last_view_at ? (
                        formatDateTime(rep.last_view_at, user?.organization_timezone)
                      ) : (
                        <span className="text-xs italic text-muted-foreground/50">
                          Sin actividad
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {meta && (
        <div className="mt-4">
          <PaginationBar
            page={meta.page}
            lastPage={meta.last_page}
            total={meta.total}
            onPageChange={setPage}
          />
        </div>
      )}

      {reps.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" />
          Toca uno o varios representantes para filtrar todo el panel por su actividad.
        </p>
      )}
    </div>
  )
}
