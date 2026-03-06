import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Network, Tags, Users, Plus, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import {
  ChoicePills,
  EmptyState,
  PaginationBar,
  SearchToolbar,
  SegmentedControl,
  ToggleField,
} from '@/components/backoffice/Workbench'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'

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

function LoadingState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">{message}</div>
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">{message}</div>
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
  role_id: 3, // manager default
  active: true,
}

export function OrgAdminUsersPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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
    enabled: !!editingUser && editingUser.role === 'rep',
  })

  useEffect(() => {
    if (!editingUser) {
      setForm({ ...emptyUserForm, role_id: managerRoleId })
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
    setIsDialogOpen(true)
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
      setIsDialogOpen(false)
      setEditingUser(null)
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'users'] })
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'managers'] })
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'rep-subscriptions', savedUser.id] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el usuario.'
      toast.error(message)
    },
  })

  const managerOptions = (managersQuery.data?.items ?? []).map(item => ({
    value: item.id,
    label: item.name,
    hint: item.email,
  }))

  const handleOpenNewDialog = () => {
    setEditingUser(null)
    setForm({ ...emptyUserForm, role_id: managerRoleId })
    setSubscriptionManagerIds([])
    setIsDialogOpen(true)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Usuarios</h1>
          <p className="mt-2 text-sm text-muted-foreground">Gestiona los gerentes y visitadores de tu organización.</p>
        </div>
        <Button onClick={handleOpenNewDialog}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Usuario
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <SearchToolbar
          value={q ?? ''}
          onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
          placeholder="Buscar por nombre o correo..."
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
        {usersQuery.isError && <ErrorState message="No se pudo cargar la lista." />}

        {!usersQuery.isLoading && !usersQuery.isError && usersQuery.data?.items.length === 0 && (
          <EmptyState title="Sin resultados" description="No hay usuarios registrados con esos filtros." />
        )}

        {!usersQuery.isLoading && !usersQuery.isError && (usersQuery.data?.items.length ?? 0) > 0 && (
          <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[30%]">Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último Acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.data?.items.map(item => (
                  <TableRow key={item.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.email}</TableCell>
                    <TableCell>
                      <Badge variant={item.role === 'manager' ? 'accent' : 'outline'}>{item.role === 'manager' ? 'Gerente' : 'Visitador'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activo' : 'Inactivo'}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(item.last_login_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditingUser(item)} className="opacity-70 hover:opacity-100 transition-opacity">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <PaginationBar
          page={usersQuery.data?.page ?? page}
          lastPage={usersQuery.data?.last_page ?? 1}
          total={usersQuery.data?.total ?? 0}
          onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={open => {
        setIsDialogOpen(open)
        if (!open) setEditingUser(null)
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Actualiza los datos del usuario.' : 'Crea un nuevo gerente o visitador.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-2 space-y-5"
            onSubmit={event => {
              event.preventDefault()
              void saveMutation.mutateAsync()
            }}
          >
            <Input label="Nombre completo" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required />
            <Input label="Correo electrónico" type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required />
            <Input
              label={editingUser ? 'Nueva contraseña (opcional)' : 'Contraseña'}
              type="password"
              value={form.password}
              onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
              required={!editingUser}
            />

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Rol del Usuario</label>
              <SegmentedControl
                value={String(form.role_id)}
                onChange={value => setForm(current => ({ ...current, role_id: Number(value) }))}
                options={[
                  { label: 'Gerente (Administra contenido)', value: String(managerRoleId) },
                  { label: 'Visitador (Campo)', value: String(repRoleId) },
                ]}
              />
            </div>

            <ToggleField
              checked={form.active}
              onChange={active => setForm(current => ({ ...current, active }))}
              label="Habilitado"
              hint="El usuario puede iniciar sesión en la plataforma."
            />

            {isRepForm && (
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 mt-6">
                <p className="text-sm font-semibold text-foreground">Suscripciones del visitador</p>
                <p className="mt-1 text-sm text-muted-foreground">Selecciona los gerentes cuyo contenido verá este visitador.</p>
                <div className="mt-4">
                  {subscriptionsQuery.isLoading && editingUser?.role === 'rep' && <p className="text-xs text-muted-foreground">Cargando suscripciones...</p>}
                  <ChoicePills
                    value={subscriptionManagerIds}
                    onToggle={managerId => setSubscriptionManagerIds(current => current.includes(managerId) ? current.filter(item => item !== managerId) : [...current, managerId])}
                    options={managerOptions}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editingUser ? 'Guardar Cambios' : 'Crear Usuario'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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

export function OrgAdminBrandsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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
    setIsDialogOpen(true)
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
      setIsDialogOpen(false)
      setEditingBrand(null)
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'brands'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la marca.'
      toast.error(message)
    },
  })

  const handleOpenNewDialog = () => {
    setEditingBrand(null)
    setForm(emptyBrandForm)
    setIsDialogOpen(true)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Marcas</h1>
          <p className="mt-2 text-sm text-muted-foreground">Catálogo maestro de marcas de la organización.</p>
        </div>
        <Button onClick={handleOpenNewDialog}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Marca
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <SearchToolbar
          value={q ?? ''}
          onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
          placeholder="Buscar marcas..."
        />

        {brandsQuery.isLoading && <LoadingState message="Cargando marcas..." />}
        {brandsQuery.isError && <ErrorState message="No se pudo cargar la lista." />}

        {!brandsQuery.isLoading && !brandsQuery.isError && brandsQuery.data?.items.length === 0 && (
          <EmptyState title="Sin resultados" description="No hay marcas en el catálogo." />
        )}

        {!brandsQuery.isLoading && !brandsQuery.isError && (brandsQuery.data?.items.length ?? 0) > 0 && (
          <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[30%]">Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-[10%]">Estado</TableHead>
                  <TableHead className="w-[15%]">Última Actualización</TableHead>
                  <TableHead className="text-right w-[10%]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brandsQuery.data?.items.map(item => (
                  <TableRow key={item.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-md" title={item.description || ''}>{item.description || <span className="text-muted-foreground/50 italic">Sin descripción</span>}</TableCell>
                    <TableCell>
                      <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activa' : 'Inactiva'}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDateTime(item.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditingBrand(item)} className="opacity-70 hover:opacity-100 transition-opacity">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <PaginationBar
          page={brandsQuery.data?.page ?? page}
          lastPage={brandsQuery.data?.last_page ?? 1}
          total={brandsQuery.data?.total ?? 0}
          onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={open => {
        setIsDialogOpen(open)
        if (!open) setEditingBrand(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBrand ? 'Editar Marca' : 'Nueva Marca'}</DialogTitle>
            <DialogDescription>
              {editingBrand ? 'Actualiza la información de la marca.' : 'Agrega una nueva marca al catálogo maestro.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-2 space-y-5"
            onSubmit={event => {
              event.preventDefault()
              void saveMutation.mutateAsync()
            }}
          >
            <Input label="Nombre de la marca" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required />
            <Textarea
              label="Descripción"
              value={form.description}
              onChange={event => setForm(current => ({ ...current, description: event.target.value }))}
              placeholder="Contexto comercial o científico"
              rows={4}
            />
            <ToggleField
              checked={form.active}
              onChange={active => setForm(current => ({ ...current, active }))}
              label="Marca activa"
              hint="Permite asignar a gerentes y crear materiales."
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editingBrand ? 'Guardar Cambios' : 'Crear Marca'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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
        queryFn: () => listOrgBrands({ page: 1 }), // Assuming we want almost all active brands
      },
    ],
  })

  // We could implement an infinite query or specific search for brands, but for simplicity we rely on listOrgBrands.
  // In a real scenario, this endpoint should likely not paginate or should be searchable for assignments.

  const assignedBrandsQuery = useQuery({
    queryKey: ['org-admin', 'manager-brands', managerId],
    queryFn: () => getManagerAssignedBrands(managerId!, { page: 1 }),
    enabled: managerId !== null,
  })

  useEffect(() => {
    if (assignedBrandsQuery.data) {
      setDraftBrandIds(assignedBrandsQuery.data.items.map(item => item.id))
    } else {
      setDraftBrandIds([])
    }
  }, [assignedBrandsQuery.data, managerId])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!managerId) throw new Error('Selecciona un gerente.')

      const currentIds = assignedBrandsQuery.data?.items.map(item => item.id) ?? []
      const toAssign = draftBrandIds.filter(id => !currentIds.includes(id))
      const toRemove = currentIds.filter(id => !draftBrandIds.includes(id))

      if (toAssign.length > 0) await assignBrandsToManager(managerId, toAssign)
      if (toRemove.length > 0) await removeBrandsFromManager(managerId, toRemove)
    },
    onSuccess: () => {
      toast.success('Asignaciones guardadas.')
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'manager-brands', managerId] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudieron guardar las asignaciones.'
      toast.error(message)
    },
  })

  const selectedManager = managersQuery.data?.items.find(item => item.id === managerId) ?? null

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      
      {/* Left panel: Managers */}
      <div className="w-1/3 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground">Gerentes</h1>
          <p className="mt-2 text-sm text-muted-foreground">Selecciona un gerente para asignar marcas.</p>
        </div>

        <SearchToolbar
          value={q ?? ''}
          onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
          placeholder="Buscar..."
        />

        {managersQuery.isLoading && <LoadingState message="Cargando..." />}
        
        <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2">
          {(managersQuery.data?.items ?? []).map(item => (
            <button
              key={item.id}
              onClick={() => setSearchParams(current => updateSearchParams(current, { manager_id: item.id }))}
              className={`w-full p-4 rounded-2xl text-left transition-all duration-200 border ${
                item.id === managerId 
                  ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                  : 'bg-background hover:bg-muted/50 border-border/50 text-foreground'
              }`}
            >
              <p className="font-semibold">{item.name}</p>
              <p className="text-xs opacity-70 truncate">{item.email}</p>
            </button>
          ))}
        </div>
        
        <PaginationBar
          page={managersQuery.data?.page ?? page}
          lastPage={managersQuery.data?.last_page ?? 1}
          total={managersQuery.data?.total ?? 0}
          onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
        />
      </div>

      {/* Right panel: Assigments */}
      <div className="w-2/3 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground">
            {selectedManager ? `Marcas de ${selectedManager.name}` : 'Asignaciones'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {selectedManager ? 'Elige las marcas que este gerente administrará.' : 'Selecciona un gerente a la izquierda.'}
          </p>
        </div>

        {!managerId && (
          <div className="h-full min-h-[40vh] rounded-3xl border border-dashed border-border/50 flex items-center justify-center text-muted-foreground bg-muted/10">
            <p>Selecciona un gerente para ver sus asignaciones.</p>
          </div>
        )}

        {managerId && (
          <div className="bg-background/50 rounded-3xl border border-border/50 p-6 shadow-sm flex flex-col gap-6">
             <ChoicePills
                value={draftBrandIds}
                onToggle={brandId => setDraftBrandIds(current => current.includes(brandId) ? current.filter(item => item !== brandId) : [...current, brandId])}
                options={(brandsQuery.data?.items ?? []).map(item => ({
                  value: item.id,
                  label: item.name,
                  hint: item.description ?? '',
                  disabled: !item.active,
                }))}
              />
              
              <div className="flex justify-start gap-3 mt-4 pt-6 border-t border-border/20">
                <Button loading={saveMutation.isPending} onClick={() => void saveMutation.mutateAsync()}>Guardar Asignaciones</Button>
                <Button variant="ghost" onClick={() => setDraftBrandIds(assignedBrandsQuery.data?.items.map(item => item.id) ?? [])}>Deshacer cambios</Button>
              </div>
          </div>
        )}
      </div>
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Vista General</h1>
        <p className="mt-2 text-sm text-muted-foreground">Métricas operativas de la organización.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">Gerentes</h3>
          <p className="mt-2 text-4xl font-display text-foreground">{managersQuery.data?.total ?? 0}</p>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Network className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">Visitadores</h3>
          <p className="mt-2 text-4xl font-display text-foreground">{repsQuery.data?.total ?? 0}</p>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Tags className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">Marcas</h3>
          <p className="mt-2 text-4xl font-display text-foreground">{brandsQuery.data?.total ?? 0}</p>
        </div>
      </div>
    </div>
  )
}
