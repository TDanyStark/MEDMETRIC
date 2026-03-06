import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, PlayCircle, ExternalLink, Link2, Copy, Stethoscope, ArrowRight } from 'lucide-react'
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
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'

import { getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { formatDateTime } from '@/lib/utils'
import {
  listRepMaterials,
  createRepSession,
  listRepSessions,
} from '@/services/rep'
import { MaterialType } from '@/types/rep'

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

  const materialsQuery = useQuery({
    queryKey: ['rep', 'materials', q, page, type],
    queryFn: () => listRepMaterials({ q, page, type: type === 'all' ? undefined : type }),
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
                    className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'}`}
                    onClick={() => toggleMaterial(item.id)}
                  >
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/10 space-y-0">
                      <MaterialTypeLabel type={item.type} />
                      <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-background" />}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-3">
                      <p className="text-xs text-muted-foreground mb-1">Cód. {item.id}</p>
                      <h3 className="font-semibold text-foreground line-clamp-2">{item.title}</h3>
                      {item.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
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
                  <h3 className="font-semibold text-lg text-foreground">Nueva Sesión</h3>
                </div>
                <p className="text-sm text-muted-foreground">{selectedMaterialIds.length} materiales seleccionados</p>
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
              <div className="p-5 bg-background border-t border-border">
                <Button className="w-full" onClick={() => setIsSessionDialogOpen(true)}>
                  Preparar link <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isSessionDialogOpen} onOpenChange={setIsSessionDialogOpen}>
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
                  <Button type="button" variant="outline" onClick={() => setIsSessionDialogOpen(false)}>Cancelar</Button>
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
                   <Button variant="outline" className="flex-1" onClick={() => { setIsSessionDialogOpen(false); setCreatedSessionToken(null); }}>Cerrar</Button>
                   <Button className="flex-1" asChild>
                     <Link to={`/public/visit/${createdSessionToken}`} target="_blank">Abrir link</Link>
                   </Button>
                </div>
             </div>
           )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function RepHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = getNumberParam(searchParams, 'page')

  const sessionsQuery = useQuery({
    queryKey: ['rep', 'sessions', page],
    queryFn: () => listRepSessions({ page }),
  })

  // Group materials (if we had them in response, but typical listing doesn't fetch nested full materials unless requested. The backend list action may just return sessions without materials, or we just display session metadata)

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
        <p className="mt-2 text-sm text-muted-foreground">Revisa las sesiones que has creado previamente.</p>
      </div>

      <div className="flex flex-col gap-6">
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
                  <TableHead className="text-right">Enlace de Visita</TableHead>
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
                       <div className="flex justify-end gap-2">
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
    </div>
  )
}
