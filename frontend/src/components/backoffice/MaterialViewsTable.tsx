import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar as CalendarIcon, FileIcon, Eye } from 'lucide-react'
import { metricsApi } from '@/services/metrics'
import { cn } from '@/lib/utils'

export function MaterialViewsTable() {
  const [materialIdFilter, setMaterialIdFilter] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const { data: viewsList, isLoading } = useQuery({
    queryKey: ['metrics', 'material-views-list', materialIdFilter, startDate, endDate],
    queryFn: () => metricsApi.getMaterialViewsList({
      material_id: materialIdFilter ? Number(materialIdFilter) : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined
    }).then(res => res.data)
  })

  // We could also fetch materials to populate a select for materialIdFilter
  const { data: topMaterials } = useQuery({
    queryKey: ['metrics', 'top-materials-filters'],
    queryFn: () => metricsApi.getTopMaterials(100).then(res => res.data)
  })

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 mt-8">
      <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-xl font-display font-medium">Registro de Visualizaciones</h3>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                className="pl-3 pr-8 py-2 rounded-xl border border-border/50 bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                value={materialIdFilter}
                onChange={(e) => setMaterialIdFilter(e.target.value)}
              >
                <option value="">Todos los materiales</option>
                {topMaterials?.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2 bg-background/50 rounded-xl border border-border/50 px-3 py-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <input 
                type="date" 
                className="bg-transparent text-sm outline-none text-foreground"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-muted-foreground text-sm">-</span>
              <input 
                type="date" 
                className="bg-transparent text-sm outline-none text-foreground"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-lg">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Visualizador</th>
                <th className="px-4 py-3 font-medium">Representante</th>
                <th className="px-4 py-3 font-medium">Médico</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                 <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Cargando datos...</td>
                 </tr>
              ) : viewsList?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No hay registros de visualizaciones para este filtro</td>
                </tr>
              ) : (
                viewsList?.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(item.opened_at).toLocaleDateString()} {new Date(item.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {item.cover_path ? (
                          <img src={`/api/v1/public/material/${item.material_id}/cover`} alt="cover" className="h-8 w-8 object-cover rounded-md" />
                        ) : (
                          <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                            <FileIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="truncate max-w-[200px]" title={item.material_title}>{item.material_title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        item.viewer_type === 'doctor' ? "bg-teal-500/10 text-teal-500" : "bg-purple-500/10 text-purple-500"
                      )}>
                        {item.viewer_type === 'doctor' ? 'Médico' : 'Visitador'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.rep_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.doctor_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                       <a 
                          href={`/api/v1/public/material/${item.material_id}/resource`}
                          target="_blank"
                          rel="noopener noreferrer" 
                          className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
                        >
                          Preview
                        </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
