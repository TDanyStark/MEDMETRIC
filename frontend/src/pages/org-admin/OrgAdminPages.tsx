import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, BriefcaseMedical, Network, Tags, Users } from 'lucide-react'
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
import { getNullableNumberParam, getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  assignBrandsToManager,
  createOrgBrand,
  createOrgUser,
  getManagerAssignedBrands,
  getRepSubscriptions,
  listOrgBrands,
  listOrgUsers,
  listRoles,
  removeBrandsFromManager,
  updateOrgBrand,
  updateOrgUser,
  updateRepSubscriptions,
} from '@/services/backoffice'
import { AdminUser, Brand } from '@/types/backoffice'
import { useSearchParams } from 'react-router-dom'

function LoadingState({ message }: { message: string }) {
  return <div className="rounded-[24px] border border-border/80 bg-background/70 px-4 py-5 text-sm text-muted-foreground">{message}</div>
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-[24px] border border-destructive/20 bg-destructive/5 px-4 py-5 text-sm text-destructive">{message}</div>
}

interface UserFormState {
  name: string
  email: string
  password: string
  role_id: number
  active: boolean
}

const emptyUserForm: UserFormState = {
  name: '',
  email: '',
  password: '',
  role_id: 3,
  active: true,
}

function UserCard({ item, onEdit }: { item: AdminUser; onEdit: (user: AdminUser) => void }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(item)}
      className="w-full rounded-[28px] border border-border/80 bg-background/75 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{item.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.email}</p>
        </div>
        <Badge variant={item.role === 'manager' ? 'accent' : 'warm'}>{item.role === 'manager' ? 'Gerente' : 'Visitador'}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activo' : 'Inactivo'}</Badge>
        <span>Ultimo login {formatDateTime(item.last_login_at)}</span>
      </div>
    </button>
  )
}

export function OrgAdminUsersPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<UserFormState>(emptyUserForm)
  const [subscriptionManagerIds, setSubscriptionManagerIds] = useState<number[]>([])

  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')
  const roleFilter = getStringParam(searchParams, 'role', 'all')

  const [usersQuery, rolesQuery, managersQuery] = useQueries({
    queries: [
      {
        queryKey: ['org-admin', 'users', q, page, roleFilter],
        queryFn: () => listOrgUsers({ q, page, role: roleFilter === 'all' ? undefined : roleFilter }),
      },
      {
        queryKey: ['org-admin', 'roles'],
        queryFn: () => listRoles('org-admin'),
      },
      {
        queryKey: ['org-admin', 'managers', 'subscription-options'],
        queryFn: () => listOrgUsers({ role: 'manager', page: 1 }),
      },
    ],
  })

  const subscriptionsQuery = useQuery({
    queryKey: ['org-admin', 'rep-subscriptions', editingUser?.id],
    queryFn: () => getRepSubscriptions(editingUser!.id),
    enabled: editingUser?.role === 'rep',
  })

  useEffect(() => {
    if (!editingUser) {
      setForm(emptyUserForm)
      setSubscriptionManagerIds([])
      return
    }

    setForm({
      name: editingUser.name,
      email: editingUser.email,
      password: '',
      role_id: editingUser.role_id,
      active: editingUser.active,
    })

    if (editingUser.role !== 'rep') {
      setSubscriptionManagerIds([])
    }
  }, [editingUser])

  useEffect(() => {
    if (subscriptionsQuery.data) {
      setSubscriptionManagerIds(subscriptionsQuery.data.filter(item => item.active).map(item => item.manager_id))
    }
  }, [subscriptionsQuery.data])

  const managerRoleId = rolesQuery.data?.find(item => item.name === 'manager')?.id ?? 3
  const repRoleId = rolesQuery.data?.find(item => item.name === 'rep')?.id ?? 4
  const isRepForm = form.role_id === repRoleId

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role_id: form.role_id,
        active: form.active,
      }

      const savedUser = editingUser
        ? await updateOrgUser(editingUser.id, {
            name: payload.name,
            email: payload.email,
            password: payload.password || undefined,
            active: payload.active,
          })
        : await createOrgUser(payload)

      if (savedUser.role === 'rep') {
        await updateRepSubscriptions(savedUser.id, subscriptionManagerIds)
      }

      return savedUser
    },
    onSuccess: (savedUser) => {
      toast.success(editingUser ? 'Usuario actualizado.' : 'Usuario creado.')
      setEditingUser(savedUser)
      setForm({
        name: savedUser.name,
        email: savedUser.email,
        password: '',
        role_id: savedUser.role_id,
        active: savedUser.active,
      })
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'users'] })
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'managers'] })
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'rep-subscriptions', savedUser.id] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el usuario.'
      toast.error(message)
    },
  })

  const metrics = useMemo(() => {
    const items = usersQuery.data?.items ?? []
    return [
      { label: 'Usuarios', value: usersQuery.data?.total ?? 0, detail: 'Gerentes y visitadores dentro de la organizacion.' },
      { label: 'Gerentes visibles', value: items.filter(item => item.role === 'manager').length, detail: 'Responsables de contenido en la pagina actual.' },
      { label: 'Visitadores visibles', value: items.filter(item => item.role === 'rep').length, detail: 'Equipo de campo visible con el filtro actual.' },
      { label: 'Filtro', value: roleFilter === 'all' ? 'Todos' : roleFilter, detail: 'Estado navegable desde la URL.' },
    ]
  }, [roleFilter, usersQuery.data])

  const resetForm = () => {
    setEditingUser(null)
    setForm({ ...emptyUserForm, role_id: managerRoleId })
    setSubscriptionManagerIds([])
  }

  const managerOptions = (managersQuery.data?.items ?? []).map(item => ({
    value: item.id,
    label: item.name,
    hint: item.email,
  }))

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <PageIntro
        eyebrow="Equipo interno"
        title="Gerentes y visitadores ordenados desde la mesa de coordinacion."
        badge="Personas + acceso"
        actions={<Button type="button" variant="outline" onClick={resetForm}>Nuevo usuario</Button>}
      />

      <MetricGrid items={metrics} />

      <Workspace
        primary={(
          <WorkPanel title="Directorio de usuarios">
            <SearchToolbar
              value={q}
              onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
              placeholder="Buscar por nombre o correo"
              extra={(
                <SegmentedControl
                  value={roleFilter}
                  onChange={value => setSearchParams(current => updateSearchParams(current, { role: value === 'all' ? null : value, page: 1 }))}
                  options={[
                    { label: 'Todos', value: 'all' },
                    { label: 'Gerentes', value: 'manager' },
                    { label: 'Visitadores', value: 'rep' },
                  ]}
                />
              )}
            />

            {usersQuery.isLoading && <LoadingState message="Cargando usuarios..." />}
            {usersQuery.isError && <ErrorState message="No se pudo cargar el directorio de usuarios." />}

            {!usersQuery.isLoading && !usersQuery.isError && usersQuery.data?.items.length === 0 && (
              <EmptyState title="Sin usuarios" description="Crea el primer gerente o visitador para esta organizacion." />
            )}

            <div className="space-y-3">
              {usersQuery.data?.items.map(item => (
                <UserCard key={item.id} item={item} onEdit={setEditingUser} />
              ))}
            </div>

            <PaginationBar
              page={usersQuery.data?.page ?? page}
              lastPage={usersQuery.data?.last_page ?? 1}
              total={usersQuery.data?.total ?? 0}
              onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
            />
          </WorkPanel>
        )}
        secondary={(
          <WorkPanel
            title={editingUser ? 'Editar usuario' : 'Crear usuario'}
            aside={editingUser ? <Badge variant="warm">Edicion</Badge> : <Badge variant="outline">Alta</Badge>}
          >
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault()
                void saveMutation.mutateAsync()
              }}
            >
              <Input label="Nombre" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required />
              <Input label="Correo" type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required />
              <Input
                label={editingUser ? 'Nueva contrasena (opcional)' : 'Contrasena'}
                type="password"
                value={form.password}
                onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                required={!editingUser}
              />

              <SegmentedControl
                value={String(form.role_id)}
                onChange={value => setForm(current => ({ ...current, role_id: Number(value) }))}
                options={[
                  { label: 'Gerente', value: String(managerRoleId) },
                  { label: 'Visitador', value: String(repRoleId) },
                ]}
              />

              <ToggleField
                checked={form.active}
                onChange={active => setForm(current => ({ ...current, active }))}
                label="Acceso habilitado"
                hint="Permite entrar y operar dentro de la organizacion."
              />

              {isRepForm && (
                <div className="rounded-[28px] border border-border/80 bg-background/75 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Suscripciones del visitador</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Selecciona los gerentes cuyo contenido vera este visitador.</p>
                  <div className="mt-4">
                    {subscriptionsQuery.isLoading && editingUser?.role === 'rep' && <LoadingState message="Cargando suscripciones actuales..." />}
                    <ChoicePills
                      value={subscriptionManagerIds}
                      onToggle={managerId => setSubscriptionManagerIds(current => current.includes(managerId) ? current.filter(item => item !== managerId) : [...current, managerId])}
                      options={managerOptions}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={saveMutation.isPending}>{editingUser ? 'Guardar cambios' : 'Crear usuario'}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Limpiar</Button>
              </div>
            </form>
          </WorkPanel>
        )}
      />
    </div>
  )
}

interface BrandFormState {
  name: string
  description: string
  active: boolean
}

const emptyBrandForm: BrandFormState = {
  name: '',
  description: '',
  active: true,
}

function BrandCard({ item, onEdit }: { item: Brand; onEdit: (brand: Brand) => void }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(item)}
      className="w-full rounded-[28px] border border-border/80 bg-background/75 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{item.name}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description || 'Sin descripcion cargada.'}</p>
        </div>
        <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activa' : 'Inactiva'}</Badge>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Actualizada {formatDateTime(item.updated_at)}</p>
    </button>
  )
}

export function OrgAdminBrandsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [form, setForm] = useState<BrandFormState>(emptyBrandForm)

  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')

  const brandsQuery = useQuery({
    queryKey: ['org-admin', 'brands', q, page],
    queryFn: () => listOrgBrands({ q, page }),
  })

  useEffect(() => {
    if (!editingBrand) {
      setForm(emptyBrandForm)
      return
    }

    setForm({
      name: editingBrand.name,
      description: editingBrand.description ?? '',
      active: editingBrand.active,
    })
  }, [editingBrand])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingBrand) {
        return updateOrgBrand(editingBrand.id, form)
      }

      return createOrgBrand({ name: form.name, description: form.description, active: form.active })
    },
    onSuccess: () => {
      toast.success(editingBrand ? 'Marca actualizada.' : 'Marca creada.')
      setEditingBrand(null)
      setForm(emptyBrandForm)
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'brands'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la marca.'
      toast.error(message)
    },
  })

  const metrics = useMemo(() => {
    const items = brandsQuery.data?.items ?? []
    return [
      { label: 'Marcas', value: brandsQuery.data?.total ?? 0, detail: 'Catalogo maestro de la organizacion.' },
      { label: 'Activas visibles', value: items.filter(item => item.active).length, detail: 'Marcas disponibles en la pagina actual.' },
      { label: 'Descripcion', value: items.filter(item => item.description).length, detail: 'Marcas con contexto operativo cargado.' },
      { label: 'Filtro', value: q ? 'Busqueda' : 'Completo', detail: q ? `Consulta: ${q}` : 'Sin filtro aplicado.' },
    ]
  }, [brandsQuery.data, q])

  const resetForm = () => {
    setEditingBrand(null)
    setForm(emptyBrandForm)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <PageIntro
        eyebrow="Catalogo maestro"
        title="Marcas limpias, activas y listas para asignar a gerentes."
        badge="Marca sin duplicados"
        actions={<Button type="button" variant="outline" onClick={resetForm}>Nueva marca</Button>}
      />

      <MetricGrid items={metrics} />

      <Workspace
        primary={(
          <WorkPanel title="Listado de marcas">
            <SearchToolbar
              value={q}
              onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
              placeholder="Buscar marcas"
            />

            {brandsQuery.isLoading && <LoadingState message="Cargando marcas..." />}
            {brandsQuery.isError && <ErrorState message="No se pudo cargar el catalogo de marcas." />}

            {!brandsQuery.isLoading && !brandsQuery.isError && brandsQuery.data?.items.length === 0 && (
              <EmptyState title="Sin marcas" description="Crea la primera marca para empezar a asignarla a gerentes." />
            )}

            <div className="space-y-3">
              {brandsQuery.data?.items.map(item => (
                <BrandCard key={item.id} item={item} onEdit={setEditingBrand} />
              ))}
            </div>

            <PaginationBar
              page={brandsQuery.data?.page ?? page}
              lastPage={brandsQuery.data?.last_page ?? 1}
              total={brandsQuery.data?.total ?? 0}
              onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
            />
          </WorkPanel>
        )}
        secondary={(
          <WorkPanel
            title={editingBrand ? 'Editar marca' : 'Crear marca'}
            aside={editingBrand ? <Badge variant="warm">Edicion</Badge> : <Badge variant="outline">Alta</Badge>}
          >
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault()
                void saveMutation.mutateAsync()
              }}
            >
              <Input label="Nombre de la marca" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required />
              <Textarea
                label="Descripcion"
                value={form.description}
                onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
                placeholder="Contexto comercial o cientifico de la marca"
              />
              <ToggleField
                checked={form.active}
                onChange={active => setForm(current => ({ ...current, active }))}
                label="Marca activa"
                hint="Permite seguir asignandola a gerentes y usandola en materiales."
              />

              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={saveMutation.isPending}>{editingBrand ? 'Guardar cambios' : 'Crear marca'}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Limpiar</Button>
              </div>
            </form>
          </WorkPanel>
        )}
      />
    </div>
  )
}

export function OrgAdminAssignmentsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')
  const managerId = getNullableNumberParam(searchParams, 'manager_id')
  const [draftBrandIds, setDraftBrandIds] = useState<number[]>([])

  const [managersQuery, brandsQuery] = useQueries({
    queries: [
      {
        queryKey: ['org-admin', 'assignment-managers', q, page],
        queryFn: () => listOrgUsers({ role: 'manager', q, page }),
      },
      {
        queryKey: ['org-admin', 'assignment-brands'],
        queryFn: () => listOrgBrands({ page: 1 }),
      },
    ],
  })

  const assignedBrandsQuery = useQuery({
    queryKey: ['org-admin', 'manager-brands', managerId],
    queryFn: () => getManagerAssignedBrands(managerId!, { page: 1 }),
    enabled: managerId !== null,
  })

  useEffect(() => {
    if (assignedBrandsQuery.data) {
      setDraftBrandIds(assignedBrandsQuery.data.items.map(item => item.id))
    }
  }, [assignedBrandsQuery.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!managerId) {
        throw new Error('Selecciona un gerente.')
      }

      const currentIds = assignedBrandsQuery.data?.items.map(item => item.id) ?? []
      const toAssign = draftBrandIds.filter(id => !currentIds.includes(id))
      const toRemove = currentIds.filter(id => !draftBrandIds.includes(id))

      if (toAssign.length > 0) {
        await assignBrandsToManager(managerId, toAssign)
      }

      if (toRemove.length > 0) {
        await removeBrandsFromManager(managerId, toRemove)
      }
    },
    onSuccess: () => {
      toast.success('Asignaciones actualizadas.')
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'manager-brands', managerId] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudieron actualizar las asignaciones.'
      toast.error(message)
    },
  })

  const selectedManager = managersQuery.data?.items.find(item => item.id === managerId) ?? null

  const metrics = useMemo(() => [
    { label: 'Gerentes', value: managersQuery.data?.total ?? 0, detail: 'Responsables disponibles para recibir marcas.' },
    { label: 'Marcas', value: brandsQuery.data?.total ?? 0, detail: 'Catalogo listo para asignacion.' },
    { label: 'Asignadas', value: assignedBrandsQuery.data?.items.length ?? 0, detail: 'Marcas activas del gerente seleccionado.' },
    { label: 'Foco', value: selectedManager?.name ?? 'Pendiente', detail: 'Gerente elegido desde la URL.' },
  ], [assignedBrandsQuery.data, brandsQuery.data, managersQuery.data, selectedManager?.name])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <PageIntro
        eyebrow="Relaciones marca-gerente"
        title="Asignaciones visibles para que cada gerente vea solo sus marcas."
        badge="Operacion de cartera"
      />

      <MetricGrid items={metrics} />

      <Workspace
        primary={(
          <WorkPanel title="Gerentes disponibles">
            <SearchToolbar
              value={q}
              onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
              placeholder="Buscar gerente"
            />

            {managersQuery.isLoading && <LoadingState message="Cargando gerentes..." />}
            {managersQuery.isError && <ErrorState message="No se pudo cargar la lista de gerentes." />}

            <div className="space-y-3">
              {(managersQuery.data?.items ?? []).map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSearchParams(current => updateSearchParams(current, { manager_id: item.id }))}
                  className={`w-full rounded-[28px] border p-5 text-left transition hover:-translate-y-0.5 ${item.id === managerId ? 'border-primary/20 bg-primary text-primary-foreground shadow-[0_16px_35px_rgba(24,90,86,0.22)]' : 'border-border/80 bg-background/75 text-foreground'}`}
                >
                  <p className="font-semibold">{item.name}</p>
                  <p className={`mt-1 text-sm ${item.id === managerId ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{item.email}</p>
                </button>
              ))}
            </div>

            <PaginationBar
              page={managersQuery.data?.page ?? page}
              lastPage={managersQuery.data?.last_page ?? 1}
              total={managersQuery.data?.total ?? 0}
              onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
            />
          </WorkPanel>
        )}
        secondary={(
          <WorkPanel title="Editor de asignaciones">
            {!managerId && <EmptyState title="Selecciona un gerente" description="La URL guardara el gerente elegido para que puedas compartir o retomar la vista." />}
            {managerId && assignedBrandsQuery.isLoading && <LoadingState message="Cargando marcas asignadas..." />}
            {managerId && assignedBrandsQuery.isError && <ErrorState message="No se pudieron cargar las marcas del gerente." />}

            {managerId && !assignedBrandsQuery.isLoading && !assignedBrandsQuery.isError && (
              <>
                <div className="rounded-[24px] border border-border/80 bg-background/75 p-4">
                  <p className="font-semibold text-foreground">{selectedManager?.name ?? 'Gerente seleccionado'}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Activa o desactiva marcas del catalogo para definir su espacio de trabajo.</p>
                </div>

                <ChoicePills
                  value={draftBrandIds}
                  onToggle={brandId => setDraftBrandIds(current => current.includes(brandId) ? current.filter(item => item !== brandId) : [...current, brandId])}
                  options={(brandsQuery.data?.items ?? []).map(item => ({
                    value: item.id,
                    label: item.name,
                    hint: item.description ?? 'Marca lista para asignacion',
                    disabled: !item.active,
                  }))}
                />

                <div className="flex flex-wrap gap-3">
                  <Button type="button" loading={saveMutation.isPending} onClick={() => void saveMutation.mutateAsync()}>Guardar asignaciones</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDraftBrandIds(assignedBrandsQuery.data?.items.map(item => item.id) ?? [])}
                  >
                    Revertir
                  </Button>
                </div>
              </>
            )}
          </WorkPanel>
        )}
      />
    </div>
  )
}

export function OrgAdminMetricsPage() {
  const [managersQuery, repsQuery, brandsQuery] = useQueries({
    queries: [
      { queryKey: ['org-admin', 'metrics', 'managers'], queryFn: () => listOrgUsers({ role: 'manager', page: 1 }) },
      { queryKey: ['org-admin', 'metrics', 'reps'], queryFn: () => listOrgUsers({ role: 'rep', page: 1 }) },
      { queryKey: ['org-admin', 'metrics', 'brands'], queryFn: () => listOrgBrands({ page: 1 }) },
    ],
  })

  const metrics = [
    { label: 'Gerentes', value: managersQuery.data?.total ?? 0, detail: 'Personas a cargo del contenido.' },
    { label: 'Visitadores', value: repsQuery.data?.total ?? 0, detail: 'Equipo de campo de la organizacion.' },
    { label: 'Marcas', value: brandsQuery.data?.total ?? 0, detail: 'Catalogo propio de la organizacion.' },
    {
      label: 'Ultimo acceso visible',
      value: repsQuery.data?.items[0]?.last_login_at ? formatDate(repsQuery.data.items[0].last_login_at) : '—',
      detail: 'Referencia rapida del ultimo login visible de visitadores.',
    },
  ]

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <PageIntro
        eyebrow="Pulso de la organizacion"
        title="Senales operativas para revisar estructura."
        badge="Metrica operativa"
      />

      <MetricGrid items={metrics} />

      <Workspace
        primary={(
          <WorkPanel title="Resumen del roster">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] border border-border/80 bg-background/75 p-4">
                <div className="flex items-center gap-3 text-foreground"><Users className="h-4 w-4 text-primary" /><p className="font-semibold">Equipo</p></div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{(managersQuery.data?.total ?? 0) + (repsQuery.data?.total ?? 0)} usuarios internos visibles para la operacion.</p>
              </div>
              <div className="rounded-[24px] border border-border/80 bg-background/75 p-4">
                <div className="flex items-center gap-3 text-foreground"><Tags className="h-4 w-4 text-primary" /><p className="font-semibold">Catalogo</p></div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{brandsQuery.data?.total ?? 0} marcas listas para relacionarse con los gerentes.</p>
              </div>
              <div className="rounded-[24px] border border-border/80 bg-background/75 p-4">
                <div className="flex items-center gap-3 text-foreground"><Network className="h-4 w-4 text-primary" /><p className="font-semibold">Coordinacion</p></div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Las asignaciones de marca ya viven en una pantalla propia dentro de esta fase.</p>
              </div>
            </div>
          </WorkPanel>
        )}
        secondary={null}
      />
    </div>
  )
}
