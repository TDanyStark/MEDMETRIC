import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { FileStack, Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import {
  EmptyState,
  PaginationBar,
  SearchToolbar,
  SegmentedControl,
} from '@/components/backoffice/Workbench'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'

import { getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import {
  approveManagerMaterial,
  createManagerMaterial,
  listManagerBrands,
  listManagerMaterials,
  updateManagerMaterial,
} from '@/services/backoffice'
import { Material, MaterialType } from '@/types/backoffice'
import { LoadingState, ErrorState, MaterialTypeLabel, StatusBadge } from './components/ManagerHelpers'

interface MaterialFormState {
  title: string
  description: string
  brand_id: number | null
  type: MaterialType
  external_url: string
  file: File | null
  cover_file: File | null
}

const emptyMaterialForm: MaterialFormState = {
  title: '',
  description: '',
  brand_id: null,
  type: 'pdf',
  external_url: '',
  file: null,
  cover_file: null,
}

function buildMaterialPayload(form: MaterialFormState, editingMaterial: Material | null) {
  const payload = new FormData()
  payload.append('title', form.title)
  payload.append('description', form.description)
  payload.append('brand_id', String(form.brand_id ?? ''))
  
  if (!editingMaterial) {
    payload.append('type', form.type)
  }

  if (form.type === 'pdf' && form.file) {
    payload.append('file', form.file)
  } else if (form.type !== 'pdf') {
    payload.append('external_url', form.external_url)
  }

  if (form.cover_file) {
    payload.append('cover_image', form.cover_file)
  }

  return payload
}

export function ManagerMaterialsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<MaterialFormState>(emptyMaterialForm)

  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')
  const status = getStringParam(searchParams, 'status', 'all')
  const type = getStringParam(searchParams, 'type', 'all')

  const [materialsQuery, brandsQuery] = useQueries({
    queries: [
      {
        queryKey: ['manager', 'materials', q, page, status, type],
        queryFn: () => listManagerMaterials({
          q, page,
          status: status === 'all' ? undefined : status,
          type: type === 'all' ? undefined : type,
        }),
      },
      {
        queryKey: ['manager', 'brands', 'material-options'],
        queryFn: () => listManagerBrands({ page: 1 }),
      },
    ],
  })

  const brandMap = useMemo(() => {
    return new Map((brandsQuery.data?.items ?? []).map(item => [item.id, item.name]))
  }, [brandsQuery.data])

  useEffect(() => {
    if (!editingMaterial) {
      setForm(emptyMaterialForm)
      return
    }
    setForm({
      title: editingMaterial.title,
      description: editingMaterial.description ?? '',
      brand_id: editingMaterial.brand_id,
      type: editingMaterial.type,
      external_url: editingMaterial.external_url ?? '',
      file: null,
      cover_file: null,
    })
    setIsDialogOpen(true)
  }, [editingMaterial])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.brand_id) throw new Error('Selecciona una marca.')
      if (!editingMaterial && form.type === 'pdf' && !form.file) throw new Error('Adjunta un PDF.')

      const payload = buildMaterialPayload(form, editingMaterial)
      return editingMaterial ? updateManagerMaterial(editingMaterial.id, payload) : createManagerMaterial(payload)
    },
    onSuccess: () => {
      toast.success(editingMaterial ? 'Material actualizado.' : 'Material creado.')
      setIsDialogOpen(false)
      setEditingMaterial(null)
      void queryClient.invalidateQueries({ queryKey: ['manager', 'materials'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar.'
      toast.error(message)
    },
  })

  const approveMutation = useMutation({
    mutationFn: (materialId: number) => approveManagerMaterial(materialId),
    onSuccess: () => {
      toast.success('Material aprobado.')
      void queryClient.invalidateQueries({ queryKey: ['manager', 'materials'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo aprobar.'
      toast.error(message)
    },
  })

  const handleOpenNewDialog = () => {
    setEditingMaterial(null)
    setForm({ ...emptyMaterialForm, brand_id: brandsQuery.data?.items[0]?.id ?? null })
    setIsDialogOpen(true)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Materiales</h1>
          <p className="mt-2 text-sm text-muted-foreground">Gestiona los materiales que los visitadores presentarán.</p>
        </div>
        <Button onClick={handleOpenNewDialog}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Material
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <SearchToolbar
          value={q ?? ''}
          onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
          placeholder="Buscar materiales..."
          extra={(
            <div className="flex gap-2">
              <SegmentedControl
                value={status}
                onChange={value => setSearchParams(current => updateSearchParams(current, { status: value === 'all' ? null : value, page: 1 }))}
                options={[
                  { label: 'Todos', value: 'all' },
                  { label: 'Borrador', value: 'draft' },
                  { label: 'Aprobado', value: 'approved' },
                ]}
              />
              <SegmentedControl
                value={type}
                onChange={value => setSearchParams(current => updateSearchParams(current, { type: value === 'all' ? null : value, page: 1 }))}
                options={[
                  { label: 'Todos', value: 'all' },
                  { label: 'PDF', value: 'pdf' },
                  { label: 'Video', value: 'video' }
                ]}
              />
            </div>
          )}
        />

        {materialsQuery.isLoading && <LoadingState message="Cargando materiales..." />}
        {materialsQuery.isError && <ErrorState message="No se pudieron cargar los materiales." />}

        {!materialsQuery.isLoading && !materialsQuery.isError && materialsQuery.data?.items.length === 0 && (
          <EmptyState title="Sin materiales" description="Crea tu primer material." />
        )}

        {!materialsQuery.isLoading && !materialsQuery.isError && (materialsQuery.data?.items.length ?? 0) > 0 && (
          <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[30%]">Título</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialsQuery.data?.items.map(item => (
                  <TableRow key={item.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        {item.cover_path ? (
                          <img 
                            src={`/api/v1/public/material/${item.id}/cover`} 
                            className="h-10 w-10 shrink-0 rounded-lg object-cover bg-muted" 
                            alt="" 
                          />
                        ) : (
                          <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                            <FileStack className="h-5 w-5 opacity-20" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.description || ''}>{item.description}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{brandMap.get(item.brand_id) ?? `ID ${item.brand_id}`}</TableCell>
                    <TableCell>
                      <MaterialTypeLabel type={item.type} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingMaterial(item)} className="opacity-70 hover:opacity-100 transition-opacity p-2">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {item.status === 'draft' && (
                             <Button variant="outline" size="sm" loading={approveMutation.isPending && approveMutation.variables === item.id} onClick={() => void approveMutation.mutateAsync(item.id)}>
                                Aprobar
                             </Button>
                          )}
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <PaginationBar
          page={materialsQuery.data?.page ?? page}
          lastPage={materialsQuery.data?.last_page ?? 1}
          total={materialsQuery.data?.total ?? 0}
          onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={open => {
        setIsDialogOpen(open)
        if (!open) setEditingMaterial(null)
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingMaterial ? 'Editar Material' : 'Nuevo Material'}</DialogTitle>
            <DialogDescription>
              {editingMaterial ? 'Edita los datos del material.' : 'Crea un nuevo material para tus visitadores.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-2 space-y-5"
            onSubmit={event => {
              event.preventDefault()
              void saveMutation.mutateAsync()
            }}
          >
            <Input label="Título" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} required />
            <Textarea label="Descripción" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} />

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Marca</label>
              <select
                className="w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={form.brand_id ?? ''}
                onChange={event => setForm(current => ({ ...current, brand_id: Number(event.target.value) }))}
                required
              >
                <option value="" disabled>Selecciona una marca</option>
                {brandsQuery.data?.items.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
              <label className="text-sm font-semibold text-foreground mb-2 block">Imagen de Portada (Feed)</label>
              <div className="flex items-center gap-4">
                {editingMaterial?.cover_path && !form.cover_file && (
                   <img 
                    src={`/api/v1/public/material/${editingMaterial.id}/cover`} 
                    className="h-16 w-16 rounded-xl object-cover bg-background border border-border" 
                    alt="Current cover" 
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full text-sm text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:text-primary file:px-4 file:py-2 file:font-semibold hover:file:bg-primary/20 transition-colors"
                  onChange={event => setForm(current => ({ ...current, cover_file: event.target.files?.[0] ?? null }))}
                />
              </div>
            </div>

            {!editingMaterial && (
              <div className="space-y-2">
               <label className="text-sm font-semibold text-foreground">Tipo de material</label>
                <SegmentedControl
                  value={form.type}
                  onChange={value => setForm(current => ({ ...current, type: value as MaterialType, file: null, external_url: '' }))}
                  options={[
                    { label: 'PDF', value: 'pdf' },
                    { label: 'Video', value: 'video' },
                    { label: 'Link', value: 'link' },
                  ]}
                />
              </div>
            )}

            {(editingMaterial?.type ?? form.type) === 'pdf' && (
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <label className="text-sm font-semibold text-foreground mb-2 block">Archivo PDF</label>
                <input
                  type="file"
                  accept="application/pdf"
                  className="block w-full text-sm text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:text-primary file:px-4 file:py-2 file:font-semibold hover:file:bg-primary/20 transition-colors"
                  onChange={event => setForm(current => ({ ...current, file: event.target.files?.[0] ?? null }))}
                />
              </div>
            )}

            {(editingMaterial?.type ?? form.type) !== 'pdf' && (
              <Input
                label={(editingMaterial?.type ?? form.type) === 'video' ? 'URL de YouTube' : 'URL externa'}
                value={form.external_url}
                onChange={event => setForm(current => ({ ...current, external_url: event.target.value }))}
                placeholder="https://..."
                required
              />
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50 sticky bottom-0 bg-background/95 backdrop-blur-sm -mx-6 px-6 py-4 mt-8 -mb-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editingMaterial ? 'Guardar Cambios' : 'Crear Material'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
