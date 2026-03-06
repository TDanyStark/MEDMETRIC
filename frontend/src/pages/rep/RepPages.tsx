import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, PlayCircle, ExternalLink, Link2, Copy, Stethoscope, Plus, PackagePlus, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams, Link } from 'react-router-dom'

import {
  EmptyState,
  PaginationBar,
  SearchToolbar,
  SegmentedControl,
} from '@/components/backoffice/Workbench'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Card, CardContent } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'

import { getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { formatDateTime } from '@/lib/utils'
import {
  listRepMaterials,
  createRepSession,
  listRepSessions,
  addMaterialsToSession,
} from '@/services/rep'
import { Material, MaterialType, RepSession } from '@/types/rep'

function LoadingState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">{message}</div>
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">{message}</div>
}

function MaterialTypeLabel({ type }: { type: MaterialType }) {
  const label = type === 'pdf' ? 'PDF' : type === 'video' ? 'Video' : 'Link'
  const Icon = type === 'pdf' ? FileText : type === 'video' ? PlayCircle : ExternalLink
  return (
    <Badge variant={type === 'pdf' ? 'outline' : type === 'video' ? 'accent' : 'warm'} className="gap-1.5 py-1">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  )
}

// ─── Add-Materials-to-Existing-Session dialog ───────────────────────────────

interface AddMaterialsDialogProps {
  session: RepSession
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddMaterialsDialog({ session, open, onOpenChange }: AddMaterialsDialogProps) {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
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
    queryKey: ['rep', 'materials-picker', q, type],
    queryFn: () => listRepMaterials({ q: q || undefined, page: 1, type: type === 'all' ? undefined : type }),
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
    onOpenChange(false)
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
      <DialogContent className="max-w-2xl">
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
                  <SegmentedControl
                    value={type}
                    onChange={setType}
                    options={[
                      { label: 'Todos', value: 'all' },
                      { label: 'PDF', value: 'pdf' },
                      { label: 'Video', value: 'video' },
                      { label: 'Link', value: 'link' },
                    ]}
                  />
                }
              />
            </div>

            {/* Material Grid */}
            <div className="mt-2 max-h-[50vh] overflow-y-auto pr-1">
              {materialsQuery.isLoading && <LoadingState message="Cargando materiales..." />}
              {materialsQuery.isError && <ErrorState message="No se pudo cargar la biblioteca." />}
              {!materialsQuery.isLoading && !materialsQuery.isError && (materialsQuery.data?.items.length ?? 0) === 0 && (
                <EmptyState title="Sin materiales" description="No hay materiales disponibles." />
              )}
              {!materialsQuery.isLoading && !materialsQuery.isError && (materialsQuery.data?.items.length ?? 0) > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                            {isExisting && (
                              <Badge variant="outline" className="text-[9px] py-0 h-3.5 px-1.5 opacity-60">En sesión</Badge>
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


// ─── Library Page ─────────────────────────────────────────────────────────────

export function RepLibraryPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')
  const type = getStringParam(searchParams, 'type', 'all')

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([])
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false)
  const [sessionForm, setSessionForm] = useState({ doctor_name: '', notes: '' })
  const [createdSessionToken, setCreatedSessionToken] = useState<string | null>(null)

  // For "add to existing session" flow
  const [isAddToExistingOpen, setIsAddToExistingOpen] = useState(false)
  const [sessionSearch, setSessionSearch] = useState('')
  const [targetSessionForAdd, setTargetSessionForAdd] = useState<RepSession | null>(null)
  const [addDone, setAddDone] = useState(false)

  const materialsQuery = useQuery({
    queryKey: ['rep', 'materials', q, page, type],
    queryFn: () => listRepMaterials({ q, page, type: type === 'all' ? undefined : type }),
  })

  // Fetch recent sessions to allow "add to existing"
  const sessionsQuery = useQuery({
    queryKey: ['rep', 'sessions', 1, sessionSearch],
    queryFn: () => listRepSessions({ page: 1, q: sessionSearch || undefined }),
  })

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (selectedMaterialIds.length === 0) throw new Error('Selecciona al menos un material.')
      return createRepSession({
        doctor_name: sessionForm.doctor_name || undefined,
        notes: sessionForm.notes || undefined,
        material_ids: selectedMaterialIds,
      })
    },
    onSuccess: (data) => {
      toast.success('Sesión médica creada exitosamente.')
      setCreatedSessionToken(data.session.doctor_token)
      setSelectedMaterialIds([])
      setSessionForm({ doctor_name: '', notes: '' })
      void queryClient.invalidateQueries({ queryKey: ['rep', 'sessions'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Error al crear la sesión.'
      toast.error(message)
    },
  })

  const addToExistingMutation = useMutation({
    mutationFn: () => {
      if (!targetSessionForAdd) throw new Error('No hay sesión seleccionada.')
      return addMaterialsToSession(targetSessionForAdd.id, selectedMaterialIds)
    },
    onSuccess: () => {
      toast.success('Materiales agregados a la sesión.')
      setAddDone(true)
      setSelectedMaterialIds([])
      void queryClient.invalidateQueries({ queryKey: ['rep', 'sessions'] })
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Error al agregar materiales.'
      toast.error(msg)
    },
  })

  const toggleMaterial = (id: number) => {
    setSelectedMaterialIds(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Enlace copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  const handleCloseSessionDialog = () => {
    setIsSessionDialogOpen(false)
    setCreatedSessionToken(null)
  }

  const handleCloseAddToExisting = () => {
    setIsAddToExistingOpen(false)
    setTargetSessionForAdd(null)
    setSessionSearch('')
    setAddDone(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Biblioteca de Materiales</h1>
          <p className="mt-2 text-sm text-muted-foreground">Explora contenido aprobado y selecciona piezas para tu visita médica.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side: Material List */}
        <div className="flex-1 flex flex-col gap-6">
          <SearchToolbar
            value={q ?? ''}
            onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
            placeholder="Buscar material..."
            extra={(
              <SegmentedControl
                value={type}
                onChange={value => setSearchParams(current => updateSearchParams(current, { type: value === 'all' ? null : value, page: 1 }))}
                options={[
                  { label: 'Todos', value: 'all' },
                  { label: 'PDF', value: 'pdf' },
                  { label: 'Video', value: 'video' },
                  { label: 'Link', value: 'link' },
                ]}
              />
            )}
          />

          {materialsQuery.isLoading && <LoadingState message="Cargando biblioteca..." />}
          {materialsQuery.isError && <ErrorState message="No se pudo cargar la biblioteca." />}

          {!materialsQuery.isLoading && !materialsQuery.isError && materialsQuery.data?.items.length === 0 && (
            <EmptyState title="Sin materiales" description="Aún no hay materiales aprobados para ti." />
          )}

          {!materialsQuery.isLoading && !materialsQuery.isError && (materialsQuery.data?.items.length ?? 0) > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {materialsQuery.data?.items.map(item => {
                const isSelected = selectedMaterialIds.includes(item.id)
                return (
                  <Card 
                    key={item.id} 
                    className={`group cursor-pointer overflow-hidden transition-all duration-300 ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50 hover:shadow-md'}`}
                    onClick={() => toggleMaterial(item.id)}
                  >
                    <div className="relative aspect-[5/4] bg-muted border-b border-border/10 overflow-hidden">
                      {item.cover_path ? (
                        <img 
                          src={`/api/v1/public/material/${item.id}/cover`} 
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          alt={item.title} 
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center opacity-20 transition-transform duration-500 group-hover:scale-110">
                           <FileText className="h-12 w-12" />
                           <span className="text-[10px] font-bold mt-2 uppercase tracking-widest">{item.type}</span>
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <MaterialTypeLabel type={item.type} />
                      </div>
                      <div className={`absolute top-3 right-3 h-5 w-5 rounded-full border flex items-center justify-center shadow-sm ${isSelected ? 'bg-primary border-primary' : 'bg-background/80 border-muted-foreground/30'}`}>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-background" />}
                      </div>
                    </div>
                    <CardContent className="p-4 pt-3">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-1">Cód. {item.id}</p>
                      <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{item.title}</h3>
                      {item.description && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          <PaginationBar
            page={materialsQuery.data?.page ?? page}
            lastPage={materialsQuery.data?.last_page ?? 1}
            total={materialsQuery.data?.total ?? 0}
            onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
          />
        </div>

        {/* Right Side: Selected items */}
        {selectedMaterialIds.length > 0 && (
          <div className="w-full lg:w-80 shrink-0">
            <div className="sticky top-6 bg-background rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg text-foreground">Materiales seleccionados</h3>
                </div>
                <p className="text-sm text-muted-foreground">{selectedMaterialIds.length} material{selectedMaterialIds.length > 1 ? 'es' : ''} listo{selectedMaterialIds.length > 1 ? 's' : ''}</p>
              </div>
              <div className="flex-1 p-5 pt-4 bg-muted/10 max-h-[40vh] overflow-y-auto">
                <div className="space-y-3">
                  {selectedMaterialIds.map(id => {
                    const material = materialsQuery.data?.items.find(m => m.id === id)
                    if (!material) return null
                    return (
                      <div key={id} className="text-sm bg-background p-3 rounded-2xl border border-border shadow-sm flex items-start gap-3">
                         <div className="mt-0.5"><MaterialTypeLabel type={material.type} /></div>
                         <span className="font-medium text-foreground line-clamp-2 leading-tight">{material.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="p-5 bg-background border-t border-border flex flex-col gap-2">
                {/* NEW SESSION */}
                <Button className="w-full" onClick={() => setIsSessionDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Nueva sesión
                </Button>
                {/* ADD TO EXISTING SESSION */}
                {(sessionsQuery.data?.items.length ?? 0) > 0 && (
                  <Button variant="outline" className="w-full" onClick={() => setIsAddToExistingOpen(true)}>
                    <PackagePlus className="mr-2 h-4 w-4" /> Agregar a sesión existente
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Create new session dialog ───────────────────────────────── */}
      <Dialog open={isSessionDialogOpen} onOpenChange={handleCloseSessionDialog}>
        <DialogContent>
           <DialogHeader>
             <DialogTitle>Crear Visita Médica</DialogTitle>
             <DialogDescription>
               Registra notas o a quién visitas (opcional). El enlace que generes incluirá los {selectedMaterialIds.length} materiales seleccionados.
             </DialogDescription>
           </DialogHeader>
           
           {!createdSessionToken ? (
             <form onSubmit={e => { e.preventDefault(); void createSessionMutation.mutateAsync(); }} className="space-y-5 mt-4">
                <Input label="Médico (Opcional)" value={sessionForm.doctor_name} onChange={e => setSessionForm(c => ({ ...c, doctor_name: e.target.value }))} placeholder="Dr. Juan Pérez" />
                <Textarea label="Notas de la visita (Opcional)" value={sessionForm.notes} onChange={e => setSessionForm(c => ({ ...c, notes: e.target.value }))} placeholder="Interés en cardiopatías..." />
                
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseSessionDialog}>Cancelar</Button>
                  <Button type="submit" loading={createSessionMutation.isPending}>Generar Link</Button>
                </div>
             </form>
           ) : (
             <div className="mt-4 flex flex-col items-center gap-6">
                <div className="p-4 bg-success/10 text-success rounded-full">
                   <Link2 className="h-8 w-8" />
                </div>
                <div className="text-center">
                   <h3 className="font-semibold text-lg text-foreground">¡Sesión lista para compartir!</h3>
                   <p className="text-sm text-muted-foreground mt-1">Comparte este enlace con el médico. No requiere inicio de sesión.</p>
                </div>
                <div className="flex w-full items-center gap-2">
                   <Input readOnly value={`${window.location.origin}/public/visit/${createdSessionToken}`} className="flex-1" />
                   <Button variant="secondary" onClick={() => copyToClipboard(`${window.location.origin}/public/visit/${createdSessionToken}`)}>
                      <Copy className="h-4 w-4" />
                   </Button>
                </div>
                <div className="flex w-full gap-3 pt-4 border-t border-border mt-2">
                   <Button variant="outline" className="flex-1" onClick={handleCloseSessionDialog}>Cerrar</Button>
                   <Button className="flex-1" asChild>
                     <Link to={`/public/visit/${createdSessionToken}`} target="_blank">Abrir link</Link>
                   </Button>
                </div>
             </div>
           )}
        </DialogContent>
      </Dialog>

      {/* ── Add to existing session dialog ──────────────────────────── */}
      <Dialog open={isAddToExistingOpen} onOpenChange={handleCloseAddToExisting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar a sesión existente</DialogTitle>
            <DialogDescription>
              Selecciona la sesión a la que deseas agregar los {selectedMaterialIds.length} materiales seleccionados.
            </DialogDescription>
          </DialogHeader>

          {addDone ? (
            <div className="mt-4 flex flex-col items-center gap-6 py-4">
              <div className="p-4 bg-success/10 text-success rounded-full">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg text-foreground">¡Materiales agregados!</h3>
                <p className="text-sm text-muted-foreground mt-1">El enlace de la sesión ya incluye los nuevos materiales.</p>
              </div>
              {targetSessionForAdd && (
                <div className="flex w-full items-center gap-2">
                  <Input readOnly value={`${window.location.origin}/public/visit/${targetSessionForAdd.doctor_token}`} className="flex-1" />
                  <Button variant="secondary" onClick={() => copyToClipboard(`${window.location.origin}/public/visit/${targetSessionForAdd!.doctor_token}`)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Button className="w-full" onClick={handleCloseAddToExisting}>Cerrar</Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <SearchToolbar
                value={sessionSearch}
                onChange={setSessionSearch}
                placeholder="Buscar médico..."
              />
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {sessionsQuery.isLoading && <LoadingState message="Cargando sesiones..." />}
                {sessionsQuery.data?.items.map(session => (
                  <div
                    key={session.id}
                    onClick={() => setTargetSessionForAdd(s => s?.id === session.id ? null : session)}
                    className={`flex items-center gap-3 cursor-pointer rounded-2xl border p-4 transition-all ${targetSessionForAdd?.id === session.id ? 'ring-2 ring-primary border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                  >
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${targetSessionForAdd?.id === session.id ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                      {targetSessionForAdd?.id === session.id && <div className="h-2 w-2 rounded-full bg-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{session.doctor_name || <span className="italic text-muted-foreground">Sin nombre</span>}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(session.created_at)}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">ID {session.id}</Badge>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={handleCloseAddToExisting}>Cancelar</Button>
                <Button
                  disabled={!targetSessionForAdd}
                  loading={addToExistingMutation.isPending}
                  onClick={() => void addToExistingMutation.mutateAsync()}
                >
                  <PackagePlus className="mr-2 h-4 w-4" /> Agregar materiales
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── History Page ─────────────────────────────────────────────────────────────

export function RepHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = getNumberParam(searchParams, 'page')
  const q = getStringParam(searchParams, 'q')
  const date = getStringParam(searchParams, 'date')

  const sessionsQuery = useQuery({
    queryKey: ['rep', 'sessions', page, q, date],
    queryFn: () => listRepSessions({ page, q: q || undefined, date: date || undefined }),
  })

  const [addMaterialsTarget, setAddMaterialsTarget] = useState<RepSession | null>(null)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Enlace copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar el enlace')
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Historial de Sesiones</h1>
        <p className="mt-2 text-sm text-muted-foreground">Revisa las sesiones que has creado y agrega más materiales cuando lo necesites.</p>
      </div>

      <div className="flex flex-col gap-6">
        <SearchToolbar
          value={q ?? ''}
          placeholder="Buscar médico..."
          onChange={val => setSearchParams(prev => updateSearchParams(prev, { q: val || null, page: 1 }))}
          extra={(
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Filtrar por fecha:</span>
              <Input
                type="date"
                value={date ?? ''}
                onChange={e => setSearchParams(prev => updateSearchParams(prev, { date: e.target.value || null, page: 1 }))}
                className="w-40 h-10 px-3 bg-background border-border"
              />
            </div>
          )}
        />

        {sessionsQuery.isLoading && <LoadingState message="Cargando historial..." />}
        {sessionsQuery.isError && <ErrorState message="No se pudo cargar el historial." />}

        {!sessionsQuery.isLoading && !sessionsQuery.isError && sessionsQuery.data?.items.length === 0 && (
          <EmptyState title="Sin sesiones" description="Crea tu primera visita médica desde la biblioteca." />
        )}

        {!sessionsQuery.isLoading && !sessionsQuery.isError && (sessionsQuery.data?.items.length ?? 0) > 0 && (
          <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[30%]">Médico / Etiqueta</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsQuery.data?.items.map(item => (
                  <TableRow key={item.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">
                      {item.doctor_name || <span className="italic text-muted-foreground">Sin nombre</span>}
                      <p className="text-xs text-muted-foreground">ID {item.id}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="line-clamp-2 max-w-[250px]">{item.notes || 'Ninguna'}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDateTime(item.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddMaterialsTarget(item)}
                            title="Agregar materiales"
                          >
                            <PackagePlus className="h-4 w-4 mr-1.5" /> Agregar
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/public/visit/${item.doctor_token}`} target="_blank">
                              <ExternalLink className="h-4 w-4 mr-2" /> Abrir
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${window.location.origin}/public/visit/${item.doctor_token}`)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <PaginationBar
          page={sessionsQuery.data?.page ?? page}
          lastPage={sessionsQuery.data?.last_page ?? 1}
          total={sessionsQuery.data?.total ?? 0}
          onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
        />
      </div>

      {/* Add Materials Dialog (from history page) */}
      {addMaterialsTarget && (
        <AddMaterialsDialog
          session={addMaterialsTarget}
          open={Boolean(addMaterialsTarget)}
          onOpenChange={(open) => { if (!open) setAddMaterialsTarget(null) }}
        />
      )}
    </div>
  )
}
