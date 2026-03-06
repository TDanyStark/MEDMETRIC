import { useEffect, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil } from 'lucide-react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'

import { getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { formatDateTime } from '@/lib/utils'
import {
  createOrgUser,
  getRepSubscriptions,
  listOrgUsers,
  listRoles,
  updateOrgUser,
  updateRepSubscriptions,
} from '@/services/backoffice'
import { AdminUser } from '@/types/backoffice'

import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'

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
