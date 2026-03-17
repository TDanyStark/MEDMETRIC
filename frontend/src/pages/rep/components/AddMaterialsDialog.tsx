import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Copy, Plus, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { 
  EmptyState, 
  SearchToolbar, 
} from '@/components/backoffice/Workbench'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { listRepMaterials, addMaterialsToSession, listRepMaterialFilters } from '@/services/rep'
import { Material, RepSession } from '@/types/rep'
import { LoadingState, ErrorState, MaterialTypeLabel } from './RepHelpers'
import { Badge } from '@/components/ui/Badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AddMaterialsDialogProps {
  session: RepSession
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddMaterialsDialog({ session, open, onOpenChange }: AddMaterialsDialogProps) {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [managerId, setManagerId] = useState<number | null>(null)
  const [brandId, setBrandId] = useState<number | null>(null)
  const [selected, setSelected] = useState<number[]>(session.material_ids ?? [])
  const [done, setDone] = useState(false)
  const [createdToken] = useState(session.doctor_token)

  // Sync state when session target changes or opens
  useEffect(() => {
    if (open) {
      setSelected(session.material_ids ?? [])
    }
  }, [open, session.material_ids])

  const materialsQuery = useQuery({
    queryKey: ['rep', 'materials-picker', q, type, managerId, brandId],
    queryFn: () => listRepMaterials({ 
      q: q || undefined, 
      page: 1, 
      type: type === 'all' ? undefined : type,
      manager_id: managerId ?? undefined,
      brand_id: brandId ?? undefined
    }),
    enabled: open,
  })

  const filtersOptionsQuery = useQuery({
    queryKey: ['rep', 'material-filters-picker'],
    queryFn: () => listRepMaterialFilters(),
    enabled: open,
  })

  const existingIds = session.material_ids ?? []
  const hasChanges = selected.length !== existingIds.length || selected.some(id => !existingIds.includes(id))

  const addMutation = useMutation({
    mutationFn: () => {
      if (!hasChanges) throw new Error('No has realizado ningún cambio.')
      return addMaterialsToSession(session.id, selected)
    },
    onSuccess: () => {
      toast.success('Sesión actualizada exitosamente.')
      setDone(true)
      void queryClient.invalidateQueries({ queryKey: ['rep', 'sessions'] })
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Error al actualizar sesión.'
      toast.error(msg)
    },
  })

  const toggle = (id: number) => {
    setSelected(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])
  }

  const handleClose = () => {
    setDone(false)
    setSelected([])
    setQ('')
    setType('all')
    setManagerId(null)
    setBrandId(null)
    onOpenChange(false)
  }

  const resetFilters = () => {
    setQ('')
    setType('all')
    setManagerId(null)
    setBrandId(null)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Enlace copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Agregar materiales a la sesión</DialogTitle>
          <DialogDescription>
            {session.doctor_name ? `Sesión de ${session.doctor_name} — ` : ''}
            Selecciona los materiales que deseas agregar. Los duplicados serán ignorados automáticamente.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="mt-4 flex flex-col items-center gap-6 py-6">
            <div className="p-4 bg-success/10 text-success rounded-full">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg text-foreground">¡Materiales agregados!</h3>
              <p className="text-sm text-muted-foreground mt-1">El enlace de la sesión ya incluye los nuevos materiales.</p>
            </div>
            <div className="flex w-full items-center gap-2">
              <Input readOnly value={`${window.location.origin}/public/visit/${createdToken}`} className="flex-1" />
              <Button variant="secondary" onClick={() => copyToClipboard(`${window.location.origin}/public/visit/${createdToken}`)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button className="w-full" onClick={handleClose}>Cerrar</Button>
          </div>
        ) : (
          <>
            {/* Search & Filter */}
            <div className="mt-4 flex flex-col gap-3">
              <SearchToolbar
                value={q}
                onChange={setQ}
                placeholder="Buscar material..."
                extra={
                  <div className="flex flex-wrap items-center gap-2">
                    {(q || type !== 'all' || managerId || brandId) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetFilters}
                        className="h-10 px-2 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Limpiar
                      </Button>
                    )}

                    <Select
                      value={type}
                      onChange={e => setType(e.target.value)}
                      className="h-10 w-full min-w-[110px] sm:w-auto text-xs"
                    >
                      <option value="all">Tipos</option>
                      <option value="pdf">PDF</option>
                      <option value="video">Video</option>
                      <option value="link">Link</option>
                    </Select>

                    <Select
                      value={managerId?.toString() ?? ''}
                      onChange={e => {
                        setManagerId(e.target.value ? Number(e.target.value) : null)
                        setBrandId(null)
                      }}
                      className="h-10 w-full min-w-[140px] sm:w-auto text-xs"
                      disabled={filtersOptionsQuery.isLoading}
                    >
                      <option value="">Gerentes</option>
                      {filtersOptionsQuery.data?.managers.map(m => (
                        <option key={m.manager_id} value={m.manager_id}>{m.manager_name}</option>
                      ))}
                    </Select>

                    <Select
                      value={brandId?.toString() ?? ''}
                      onChange={e => setBrandId(e.target.value ? Number(e.target.value) : null)}
                      className="h-10 w-full min-w-[140px] sm:w-auto text-xs"
                      disabled={filtersOptionsQuery.isLoading}
                    >
                      <option value="">Marcas</option>
                      {filtersOptionsQuery.data?.brands
                        .filter(b => !managerId || b.manager_id === managerId)
                        .map(b => (
                          <option key={`${b.id}-${b.manager_id}`} value={b.id}>{b.name}</option>
                        ))}
                    </Select>
                  </div>
                }
              />
            </div>

            {/* Material Grid */}
            <div className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
              {materialsQuery.isLoading && <LoadingState message="Cargando materiales..." />}
              {materialsQuery.isError && <ErrorState message="No se pudo cargar la biblioteca." />}
              {!materialsQuery.isLoading && !materialsQuery.isError && (materialsQuery.data?.items.length ?? 0) === 0 && (
                <EmptyState title="Sin materiales" description="No hay materiales disponibles con esos filtros." />
              )}
              {!materialsQuery.isLoading && !materialsQuery.isError && (materialsQuery.data?.items.length ?? 0) > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                  {materialsQuery.data?.items.map((item: Material) => {
                    const isExisting = existingIds.includes(item.id)
                    const isSelected = selected.includes(item.id)
                    
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggle(item.id)}
                        className={`group flex items-center gap-3 rounded-2xl border p-2.5 transition-all cursor-pointer ${isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      >
                        {/* Cover / Icon */}
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted border border-border/50">
                          {item.cover_path ? (
                            <img 
                              src={`/api/v1/public/material/${item.id}/cover`} 
                              className="h-full w-full object-cover" 
                              alt="" 
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center opacity-20">
                               <FileText className="h-5 w-5" />
                            </div>
                          )}
                          <div className={`absolute inset-0 flex items-center justify-center bg-primary/20 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                             <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center border border-background">
                                <div className="h-2 w-2 rounded-full bg-background" />
                             </div>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight cursor-default">
                                  {item.title}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{item.title}</p>
                              </TooltipContent>
                            </Tooltip>
                            {isExisting && (
                              <Badge variant="outline" className="text-[9px] py-0 h-3.5 px-1.5 opacity-60 shrink-0">En sesión</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                             <MaterialTypeLabel type={item.type} />
                             <span className="text-[10px] text-muted-foreground font-mono">#{item.id}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-border mt-2">
              <span className="text-sm text-muted-foreground">
                {selected.length > 0 ? `${selected.length} seleccionado${selected.length > 1 ? 's' : ''}` : 'Ninguno seleccionado'}
              </span>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button
                  disabled={!hasChanges}
                  loading={addMutation.isPending}
                  onClick={() => void addMutation.mutateAsync()}
                >
                  <Plus className="mr-2 h-4 w-4" /> 
                  {hasChanges ? 'Guardar cambios' : 'Sin cambios'}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
