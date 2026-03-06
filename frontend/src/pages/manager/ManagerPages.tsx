import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileStack, Orbit, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import {
  ChoicePills,
  EmptyState,
  MetricGrid,
  PageIntro,
  PaginationBar,
  SearchToolbar,
  SegmentedControl,
  ToggleField,
  WorkPanel,
  Workspace,
} from '@/components/backoffice/Workbench'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { getBooleanParam, getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  approveManagerMaterial,
  assignManagerReps,
  createManagerMaterial,
  listAvailableManagerReps,
  listManagerBrands,
  listManagerMaterials,
  listManagerReps,
  removeManagerRep,
  updateManagerMaterial,
} from '@/services/backoffice'
import { Brand, Material, MaterialType, RepAccess } from '@/types/backoffice'
import { useSearchParams } from 'react-router-dom'

function LoadingState({ message }: { message: string }) {
  return <div className="rounded-[24px] border border-border/80 bg-background/70 px-4 py-5 text-sm text-muted-foreground">{message}</div>
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-[24px] border border-destructive/20 bg-destructive/5 px-4 py-5 text-sm text-destructive">{message}</div>
}

function MaterialTypeLabel({ type }: { type: MaterialType }) {
  const label = type === 'pdf' ? 'PDF' : type === 'video' ? 'Video' : 'Link'
  return <Badge variant={type === 'pdf' ? 'outline' : type === 'video' ? 'accent' : 'warm'}>{label}</Badge>
}

function StatusBadge({ status }: { status: Material['status'] }) {
  if (status === 'approved') {
    return <Badge variant="success">Aprobado</Badge>
  }

  if (status === 'archived') {
    return <Badge variant="outline">Archivado</Badge>
  }

  return <Badge variant="warm">Borrador</Badge>
}

export function ManagerBrandsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')

  const brandsQuery = useQuery({
    queryKey: ['manager', 'brands', q, page],
    queryFn: () => listManagerBrands({ q, page }),
  })

  const metrics = useMemo(() => {
    const items = brandsQuery.data?.items ?? []
    return [
      { label: 'Marcas asignadas', value: brandsQuery.data?.total ?? 0, detail: 'Espacio habilitado para crear contenido.' },
      { label: 'Con descripcion', value: items.filter(item => item.description).length, detail: 'Marcas con contexto visible en la pagina.' },
      { label: 'Activas', value: items.filter(item => item.active).length, detail: 'Marcas disponibles para el trabajo editorial.' },
      { label: 'Filtro', value: q ? 'Busqueda' : 'Completo', detail: q ? `Consulta: ${q}` : 'Sin filtro aplicado.' },
    ]
  }, [brandsQuery.data, q])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <PageIntro
        eyebrow="Base editorial"
        title="Tus marcas asignadas quedan visibles como materia prima del contenido."
        badge="Marcas del gerente"
      />

      <MetricGrid items={metrics} />

      <WorkPanel title="Marcas habilitadas">
        <SearchToolbar
          value={q}
          onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
          placeholder="Buscar marcas asignadas"
        />

        {brandsQuery.isLoading && <LoadingState message="Cargando marcas asignadas..." />}
        {brandsQuery.isError && <ErrorState message="No se pudieron cargar las marcas del gerente." />}

        {!brandsQuery.isLoading && !brandsQuery.isError && brandsQuery.data?.items.length === 0 && (
          <EmptyState title="Sin marcas asignadas" description="Cuando el admin de organizacion te asigne marcas apareceran aqui." />
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {(brandsQuery.data?.items ?? []).map(item => (
            <div key={item.id} className="rounded-[28px] border border-border/80 bg-background/75 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{item.name}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description || 'Sin descripcion cargada.'}</p>
                </div>
                <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activa' : 'Pausada'}</Badge>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Actualizada {formatDateTime(item.updated_at)}</p>
            </div>
          ))}
        </div>

        <PaginationBar
          page={brandsQuery.data?.page ?? page}
          lastPage={brandsQuery.data?.last_page ?? 1}
          total={brandsQuery.data?.total ?? 0}
          onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
        />
      </WorkPanel>
    </div>
  )
}

interface MaterialFormState {
  title: string
  description: string
  brand_id: number | null
  type: MaterialType
  external_url: string
  file: File | null
}

const emptyMaterialForm: MaterialFormState = {
  title: '',
  description: '',
  brand_id: null,
  type: 'pdf',
  external_url: '',
  file: null,
}

function buildMaterialPayload(form: MaterialFormState, editingMaterial: Material | null) {
  if (form.type === 'pdf') {
    const payload = new FormData()
    payload.append('title', form.title)
    payload.append('description', form.description)
    payload.append('brand_id', String(form.brand_id ?? ''))

    if (!editingMaterial) {
      payload.append('type', form.type)
    }

    if (form.file) {
      payload.append('file', form.file)
    }

    return payload
  }

  const payload = {
    title: form.title,
    description: form.description,
    brand_id: form.brand_id ?? 0,
    external_url: form.external_url,
    ...(editingMaterial ? {} : { type: form.type }),
  }

  return payload
}

function MaterialCard({
  item,
  brandLabel,
  onEdit,
  onApprove,
  approvePending,
}: {
  item: Material
  brandLabel: string
  onEdit: (material: Material) => void
  onApprove: (materialId: number) => void
  approvePending: boolean
}) {
  return (
    <div className="rounded-[28px] border border-border/80 bg-background/75 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{item.title}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description || 'Sin descripcion cargada.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MaterialTypeLabel type={item.type} />
          <StatusBadge status={item.status} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{brandLabel}</Badge>
        <span>Actualizado {formatDateTime(item.updated_at)}</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {item.status === 'draft' && (
          <>
            <Button type="button" variant="outline" onClick={() => onEdit(item)}>Editar</Button>
            <Button type="button" loading={approvePending} onClick={() => onApprove(item.id)}>Aprobar</Button>
          </>
        )}
      </div>
    </div>
  )
}

export function ManagerMaterialsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
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
          q,
          page,
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
    })
  }, [editingMaterial])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.brand_id) {
        throw new Error('Selecciona una marca.')
      }

      if (!editingMaterial && form.type === 'pdf' && !form.file) {
        throw new Error('Adjunta un PDF para crear el material.')
      }

      const payload = buildMaterialPayload(form, editingMaterial)
      return editingMaterial ? updateManagerMaterial(editingMaterial.id, payload) : createManagerMaterial(payload)
    },
    onSuccess: () => {
      toast.success(editingMaterial ? 'Material actualizado.' : 'Material creado.')
      setEditingMaterial(null)
      setForm(emptyMaterialForm)
      void queryClient.invalidateQueries({ queryKey: ['manager', 'materials'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el material.'
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
      const message = error instanceof Error ? error.message : 'No se pudo aprobar el material.'
      toast.error(message)
    },
  })

  const brandMap = useMemo(() => {
    return new Map((brandsQuery.data?.items ?? []).map(item => [item.id, item.name]))
  }, [brandsQuery.data])

  const metrics = useMemo(() => {
    const items = materialsQuery.data?.items ?? []
    return [
      { label: 'Materiales', value: materialsQuery.data?.total ?? 0, detail: 'Piezas creadas por el gerente.' },
      { label: 'Borradores', value: items.filter(item => item.status === 'draft').length, detail: 'Piezas listas para pulir o aprobar.' },
      { label: 'Aprobados visibles', value: items.filter(item => item.status === 'approved').length, detail: 'Contenido ya disponible para campo en la pagina actual.' },
      { label: 'Filtro activo', value: status === 'all' && type === 'all' ? 'Todos' : `${status}/${type}`, detail: 'Filtros persistidos en URL.' },
    ]
  }, [materialsQuery.data, status, type])

  const resetForm = () => {
    setEditingMaterial(null)
    setForm(emptyMaterialForm)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <PageIntro
        eyebrow="Mesa editorial"
        title="Crea, ajusta y aprueba materiales sin perder el contexto de marca."
        badge="PDF + video + link"
        actions={<Button type="button" variant="outline" onClick={resetForm}>Nuevo material</Button>}
      />

      <MetricGrid items={metrics} />

      <Workspace
        primary={(
          <WorkPanel title="Biblioteca del gerente">
            <SearchToolbar
              value={q}
              onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
              placeholder="Buscar por titulo o descripcion"
              extra={(
                <>
                  <SegmentedControl
                    value={status}
                    onChange={value => setSearchParams(current => updateSearchParams(current, { status: value === 'all' ? null : value, page: 1 }))}
                    options={[
                      { label: 'Todos', value: 'all' },
                      { label: 'Draft', value: 'draft' },
                      { label: 'Approved', value: 'approved' },
                      { label: 'Archived', value: 'archived' },
                    ]}
                  />
                  <SegmentedControl
                    value={type}
                    onChange={value => setSearchParams(current => updateSearchParams(current, { type: value === 'all' ? null : value, page: 1 }))}
                    options={[
                      { label: 'Todo tipo', value: 'all' },
                      { label: 'PDF', value: 'pdf' },
                      { label: 'Video', value: 'video' },
                      { label: 'Link', value: 'link' },
                    ]}
                  />
                </>
              )}
            />

            {materialsQuery.isLoading && <LoadingState message="Cargando materiales..." />}
            {materialsQuery.isError && <ErrorState message="No se pudo cargar la biblioteca del gerente." />}

            {!materialsQuery.isLoading && !materialsQuery.isError && materialsQuery.data?.items.length === 0 && (
              <EmptyState title="Sin materiales" description="Crea la primera pieza para empezar a poblar la biblioteca del gerente." />
            )}

            <div className="space-y-3">
              {(materialsQuery.data?.items ?? []).map(item => (
                <MaterialCard
                  key={item.id}
                  item={item}
                  brandLabel={brandMap.get(item.brand_id) ?? `Marca #${item.brand_id}`}
                  onEdit={setEditingMaterial}
                  onApprove={materialId => void approveMutation.mutateAsync(materialId)}
                  approvePending={approveMutation.isPending && approveMutation.variables === item.id}
                />
              ))}
            </div>

            <PaginationBar
              page={materialsQuery.data?.page ?? page}
              lastPage={materialsQuery.data?.last_page ?? 1}
              total={materialsQuery.data?.total ?? 0}
              onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
            />
          </WorkPanel>
        )}
        secondary={(
          <WorkPanel
            title={editingMaterial ? 'Editar material' : 'Crear material'}
            aside={editingMaterial ? <Badge variant="warm">Edicion</Badge> : <Badge variant="outline">Alta</Badge>}
          >
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault()
                void saveMutation.mutateAsync()
              }}
            >
              <Input label="Titulo" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} required />
              <Textarea label="Descripcion" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} />

              <SegmentedControl
                value={String(form.brand_id ?? 'none')}
                onChange={value => setForm(current => ({ ...current, brand_id: value === 'none' ? null : Number(value) }))}
                options={[
                  { label: 'Elige marca', value: 'none' },
                  ...(brandsQuery.data?.items ?? []).map(item => ({ label: item.name, value: String(item.id) })),
                ]}
              />

              {!editingMaterial && (
                <SegmentedControl
                  value={form.type}
                  onChange={value => setForm(current => ({ ...current, type: value as MaterialType, file: null, external_url: '' }))}
                  options={[
                    { label: 'PDF', value: 'pdf' },
                    { label: 'Video', value: 'video' },
                    { label: 'Link', value: 'link' },
                  ]}
                />
              )}

              {editingMaterial && (
                <div className="rounded-[24px] border border-border/80 bg-background/75 p-4 text-sm text-muted-foreground">
                  Tipo actual: <span className="font-semibold text-foreground">{editingMaterial.type.toUpperCase()}</span>
                </div>
              )}

              {(editingMaterial?.type ?? form.type) === 'pdf' && (
                <div className="rounded-[24px] border border-border/80 bg-background/75 p-4">
                  <label className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Archivo PDF</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="mt-3 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-primary-foreground"
                    onChange={event => setForm(current => ({ ...current, file: event.target.files?.[0] ?? null }))}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">{editingMaterial ? 'Adjunta un PDF solo si quieres reemplazar el archivo actual.' : 'El PDF es obligatorio para crear el material.'}</p>
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

              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={saveMutation.isPending}>{editingMaterial ? 'Guardar cambios' : 'Crear material'}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Limpiar</Button>
              </div>
            </form>
          </WorkPanel>
        )}
      />
    </div>
  )
}

function RepCard({
  item,
  onRemove,
  loading,
}: {
  item: RepAccess
  onRemove: (repId: number) => void
  loading: boolean
}) {
  return (
    <div className="rounded-[28px] border border-border/80 bg-background/75 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{item.rep.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.rep.email}</p>
        </div>
        <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activo' : 'Pausado'}</Badge>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Desde {formatDate(item.created_at)}</span>
        <Button type="button" variant="outline" size="sm" loading={loading} onClick={() => onRemove(item.rep_id)}>Quitar</Button>
      </div>
    </div>
  )
}

export function ManagerRepsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = getStringParam(searchParams, 'q')
  const availableQ = getStringParam(searchParams, 'available_q')
  const page = getNumberParam(searchParams, 'page')
  const activeFilter = getBooleanParam(searchParams, 'active')

  const [assignedQuery, availableQuery] = useQueries({
    queries: [
      {
        queryKey: ['manager', 'reps', q, page, activeFilter],
        queryFn: () => listManagerReps({ q, page, active: activeFilter }),
      },
      {
        queryKey: ['manager', 'reps', 'available', availableQ],
        queryFn: () => listAvailableManagerReps({ q: availableQ }),
      },
    ],
  })

  const [selectedRepIds, setSelectedRepIds] = useState<number[]>([])

  const assignMutation = useMutation({
    mutationFn: () => assignManagerReps(selectedRepIds),
    onSuccess: () => {
      toast.success('Visitadores asignados.')
      setSelectedRepIds([])
      void queryClient.invalidateQueries({ queryKey: ['manager', 'reps'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudieron asignar visitadores.'
      toast.error(message)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (repId: number) => removeManagerRep(repId),
    onSuccess: () => {
      toast.success('Visitador removido.')
      void queryClient.invalidateQueries({ queryKey: ['manager', 'reps'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo quitar el visitador.'
      toast.error(message)
    },
  })

  const metrics = useMemo(() => [
    { label: 'Asignados', value: assignedQuery.data?.total ?? 0, detail: 'Visitadores conectados al contenido del gerente.' },
    { label: 'Activos visibles', value: (assignedQuery.data?.items ?? []).filter(item => item.active).length, detail: 'Estado actual en la pagina de resultados.' },
    { label: 'Disponibles', value: availableQuery.data?.length ?? 0, detail: 'Candidatos listos para sumar desde la organizacion.' },
    { label: 'Filtro', value: activeFilter === null ? 'Todos' : activeFilter ? 'Activos' : 'Inactivos', detail: 'Estado del roster guardado en la URL.' },
  ], [activeFilter, assignedQuery.data, availableQuery.data])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <PageIntro
        eyebrow="Distribucion a campo"
        title="Conecta visitadores al contenido del gerente sin perder visibilidad del roster."
        badge="Suscripciones del gerente"
      />

      <MetricGrid items={metrics} />

      <Workspace
        primary={(
          <WorkPanel title="Visitadores asignados">
            <SearchToolbar
              value={q}
              onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
              placeholder="Buscar visitador asignado"
              extra={(
                <SegmentedControl
                  value={activeFilter === null ? 'all' : activeFilter ? 'true' : 'false'}
                  onChange={value => setSearchParams(current => updateSearchParams(current, { active: value === 'all' ? null : value === 'true', page: 1 }))}
                  options={[
                    { label: 'Todos', value: 'all' },
                    { label: 'Activos', value: 'true' },
                    { label: 'Inactivos', value: 'false' },
                  ]}
                />
              )}
            />

            {assignedQuery.isLoading && <LoadingState message="Cargando visitadores asignados..." />}
            {assignedQuery.isError && <ErrorState message="No se pudo cargar el roster asignado." />}

            {!assignedQuery.isLoading && !assignedQuery.isError && assignedQuery.data?.items.length === 0 && (
              <EmptyState title="Sin visitadores asignados" description="Usa el panel lateral para conectar a tu primer visitador." />
            )}

            <div className="space-y-3">
              {(assignedQuery.data?.items ?? []).map(item => (
                <RepCard
                  key={item.id}
                  item={item}
                  onRemove={repId => void removeMutation.mutateAsync(repId)}
                  loading={removeMutation.isPending && removeMutation.variables === item.rep_id}
                />
              ))}
            </div>

            <PaginationBar
              page={assignedQuery.data?.page ?? page}
              lastPage={assignedQuery.data?.last_page ?? 1}
              total={assignedQuery.data?.total ?? 0}
              onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
            />
          </WorkPanel>
        )}
        secondary={(
          <WorkPanel title="Agregar visitadores">
            <SearchToolbar
              value={availableQ}
              onChange={value => setSearchParams(current => updateSearchParams(current, { available_q: value || null }))}
              placeholder="Buscar candidato disponible"
            />

            {availableQuery.isLoading && <LoadingState message="Cargando candidatos disponibles..." />}
            {availableQuery.isError && <ErrorState message="No se pudo cargar el listado de candidatos." />}

            {!availableQuery.isLoading && !availableQuery.isError && (availableQuery.data?.length ?? 0) === 0 && (
              <EmptyState title="Sin candidatos" description="No hay visitadores libres con el filtro actual." />
            )}

            <ChoicePills
              value={selectedRepIds}
              onToggle={repId => setSelectedRepIds(current => current.includes(repId) ? current.filter(item => item !== repId) : [...current, repId])}
              options={(availableQuery.data ?? []).map(item => ({ value: item.id, label: item.name, hint: item.email }))}
            />

            <ToggleField
              checked={selectedRepIds.length > 0}
              onChange={() => setSelectedRepIds([])}
              label="Seleccion activa"
              hint={selectedRepIds.length > 0 ? `${selectedRepIds.length} visitadores listos para asignar.` : 'Selecciona al menos un visitador para activar el envio.'}
            />

            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={selectedRepIds.length === 0} loading={assignMutation.isPending} onClick={() => void assignMutation.mutateAsync()}>
                Asignar visitadores
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelectedRepIds([])}>Limpiar seleccion</Button>
            </div>
          </WorkPanel>
        )}
      />
    </div>
  )
}
