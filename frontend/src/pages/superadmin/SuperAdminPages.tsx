import { useEffect, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Pencil, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import {
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

import { getNullableNumberParam, getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { formatDateTime } from '@/lib/utils'
import {
  createOrgAdmin,
  createOrganization,
  listOrgAdmins,
  listOrganizations,
  updateOrgAdmin,
  updateOrganization,
} from '@/services/backoffice'
import { AdminUser, Organization } from '@/types/backoffice'

function LoadingState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-border/80 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">{message}</div>
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">{message}</div>
}

interface OrganizationFormState {
  name: string
  slug: string
  active: boolean
}

const emptyOrganizationForm: OrganizationFormState = {
  name: '',
  slug: '',
  active: true,
}

export function SuperAdminOrganizationsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<OrganizationFormState>(emptyOrganizationForm)

  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')

  const organizationsQuery = useQuery({
    queryKey: ['superadmin', 'organizations', q, page],
    queryFn: () => listOrganizations({ q, page }),
  })

  useEffect(() => {
    if (!editingOrganization) {
      setForm(emptyOrganizationForm)
      return
    }
    setForm({
      name: editingOrganization.name,
      slug: editingOrganization.slug,
      active: editingOrganization.active,
    })
    setIsDialogOpen(true)
  }, [editingOrganization])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingOrganization) {
        return updateOrganization(editingOrganization.id, form)
      }
      return createOrganization(form)
    },
    onSuccess: () => {
      toast.success(editingOrganization ? 'Organización actualizada.' : 'Organización creada.')
      setIsDialogOpen(false)
      setEditingOrganization(null)
      setForm(emptyOrganizationForm)
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'organizations'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la organización.'
      toast.error(message)
    },
  })

  const handleSearchChange = (value: string) => {
    setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))
  }

  const handlePageChange = (nextPage: number) => {
    setSearchParams(current => updateSearchParams(current, { page: nextPage }))
  }

  const handleOpenNewDialog = () => {
    setEditingOrganization(null)
    setForm(emptyOrganizationForm)
    setIsDialogOpen(true)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Organizaciones</h1>
          <p className="mt-2 text-sm text-muted-foreground">Gestiona los clientes y su estado en la plataforma.</p>
        </div>
        <Button onClick={handleOpenNewDialog}>
          <Plus className="mr-2 h-4 w-4" /> Nueva Organización
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <SearchToolbar value={q} onChange={handleSearchChange} placeholder="Buscar por nombre o slug..." />

        {organizationsQuery.isLoading && <LoadingState message="Cargando organizaciones..." />}
        {organizationsQuery.isError && <ErrorState message="No se pudo cargar la lista." />}

        {!organizationsQuery.isLoading && !organizationsQuery.isError && organizationsQuery.data?.items.length === 0 && (
          <EmptyState title="Sin resultados" description="No hay organizaciones que coincidan con la búsqueda." />
        )}

        {!organizationsQuery.isLoading && !organizationsQuery.isError && (organizationsQuery.data?.items.length ?? 0) > 0 && (
          <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[30%]">Nombre</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última Actualización</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizationsQuery.data?.items.map(item => (
                  <TableRow key={item.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.slug}</TableCell>
                    <TableCell>
                      <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activa' : 'Inactiva'}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(item.updated_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditingOrganization(item)} className="opacity-70 hover:opacity-100 transition-opacity">
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
          page={organizationsQuery.data?.page ?? page}
          lastPage={organizationsQuery.data?.last_page ?? 1}
          total={organizationsQuery.data?.total ?? 0}
          onPageChange={handlePageChange}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={open => {
        setIsDialogOpen(open)
        if (!open) setEditingOrganization(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOrganization ? 'Editar Organización' : 'Nueva Organización'}</DialogTitle>
            <DialogDescription>
              {editingOrganization ? 'Modifica los datos de la organización.' : 'Completa los datos para crear una nueva organización.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-2 space-y-5"
            onSubmit={event => {
              event.preventDefault()
              void saveMutation.mutateAsync()
            }}
          >
            <Input label="Nombre de la organización" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required />
            <Input
              label="Slug identificador"
              value={form.slug}
              onChange={event => setForm(current => ({ ...current, slug: event.target.value }))}
              placeholder="Se autogenera si lo omites"
            />
            <ToggleField
              checked={form.active}
              onChange={active => setForm(current => ({ ...current, active }))}
              label="Estado de la organización"
              hint="Si está inactiva, la organización no podrá operar en el sistema."
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editingOrganization ? 'Guardar Cambios' : 'Crear Organización'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface OrgAdminFormState {
  name: string
  email: string
  password: string
  organization_id: number | null
  active: boolean
}

const emptyOrgAdminForm: OrgAdminFormState = {
  name: '',
  email: '',
  password: '',
  organization_id: null,
  active: true,
}

export function SuperAdminOrgAdminsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [form, setForm] = useState<OrgAdminFormState>(emptyOrgAdminForm)

  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')
  const organizationId = getNullableNumberParam(searchParams, 'organization_id')

  const [orgAdminsQuery, organizationsQuery] = useQueries({
    queries: [
      {
        queryKey: ['superadmin', 'org-admins', q, page, organizationId],
        queryFn: () => listOrgAdmins({ q, page, organization_id: organizationId }),
      },
      {
        queryKey: ['superadmin', 'organizations', 'form-options'],
        queryFn: () => listOrganizations({ page: 1 }),
      },
    ],
  })

  useEffect(() => {
    if (!editingAdmin) {
      setForm(emptyOrgAdminForm)
      return
    }
    setForm({
      name: editingAdmin.name,
      email: editingAdmin.email,
      password: '',
      organization_id: editingAdmin.organization_id,
      active: editingAdmin.active,
    })
    setIsDialogOpen(true)
  }, [editingAdmin])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.organization_id) throw new Error('Selecciona una organización.')

      if (editingAdmin) {
        return updateOrgAdmin(editingAdmin.id, {
          name: form.name,
          email: form.email,
          password: form.password || undefined,
          organization_id: form.organization_id,
          active: form.active,
        })
      }

      return createOrgAdmin({
        name: form.name,
        email: form.email,
        password: form.password,
        organization_id: form.organization_id,
        active: form.active,
      })
    },
    onSuccess: () => {
      toast.success(editingAdmin ? 'Administrador actualizado.' : 'Administrador creado.')
      setIsDialogOpen(false)
      setEditingAdmin(null)
      setForm(emptyOrgAdminForm)
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'org-admins'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el administrador.'
      toast.error(message)
    },
  })

  const handlePageChange = (nextPage: number) => {
    setSearchParams(current => updateSearchParams(current, { page: nextPage }))
  }

  const handleOpenNewDialog = () => {
    setEditingAdmin(null)
    setForm(emptyOrgAdminForm)
    setIsDialogOpen(true)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Administradores</h1>
          <p className="mt-2 text-sm text-muted-foreground">Gestiona los usuarios administradores vinculados a organizaciones.</p>
        </div>
        <Button onClick={handleOpenNewDialog}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Administrador
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <SearchToolbar
          value={q ?? ''}
          onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
          placeholder="Buscar por nombre o correo..."
          extra={(
            <SegmentedControl
              value={organizationId ? String(organizationId) : 'all'}
              onChange={value => setSearchParams(current => updateSearchParams(current, { organization_id: value === 'all' ? null : Number(value), page: 1 }))}
              options={[
                { label: 'Todas las Orgs', value: 'all' },
                ...(organizationsQuery.data?.items ?? []).map(item => ({ label: item.name, value: String(item.id) })),
              ]}
            />
          )}
        />

        {orgAdminsQuery.isLoading && <LoadingState message="Cargando administradores..." />}
        {orgAdminsQuery.isError && <ErrorState message="No se pudo cargar la lista." />}

        {!orgAdminsQuery.isLoading && !orgAdminsQuery.isError && orgAdminsQuery.data?.items.length === 0 && (
          <EmptyState title="Sin resultados" description="No hay administradores que coincidan con la búsqueda." />
        )}

        {!orgAdminsQuery.isLoading && !orgAdminsQuery.isError && (orgAdminsQuery.data?.items.length ?? 0) > 0 && (
          <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[25%]">Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Organización</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último Acceso</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgAdminsQuery.data?.items.map(item => (
                  <TableRow key={item.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-muted/30">{item.organization_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activo' : 'Inactivo'}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(item.last_login_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditingAdmin(item)} className="opacity-70 hover:opacity-100 transition-opacity">
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
          page={orgAdminsQuery.data?.page ?? page}
          lastPage={orgAdminsQuery.data?.last_page ?? 1}
          total={orgAdminsQuery.data?.total ?? 0}
          onPageChange={handlePageChange}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={open => {
        setIsDialogOpen(open)
        if (!open) setEditingAdmin(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAdmin ? 'Editar Administrador' : 'Nuevo Administrador'}</DialogTitle>
            <DialogDescription>
              {editingAdmin ? 'Actualiza los accesos de este usuario.' : 'Crea un administrador para una organización.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="mt-2 space-y-5"
            onSubmit={event => {
              event.preventDefault()
              void saveMutation.mutateAsync()
            }}
          >
            <Input label="Nombre de usuario" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required />
            <Input label="Correo electrónico" type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required />
            <Input
              label={editingAdmin ? 'Nueva contraseña (opcional)' : 'Contraseña'}
              type="password"
              value={form.password}
              onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
              required={!editingAdmin}
            />
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Asignar a Organización</label>
              <SegmentedControl
                value={form.organization_id ? String(form.organization_id) : 'none'}
                onChange={value => setForm(current => ({ ...current, organization_id: value === 'none' ? null : Number(value) }))}
                options={[
                  { label: 'Sin asignar', value: 'none' },
                  ...(organizationsQuery.data?.items ?? []).map(item => ({ label: item.name, value: String(item.id) })),
                ]}
              />
            </div>
            <ToggleField
              checked={form.active}
              onChange={active => setForm(current => ({ ...current, active }))}
              label="Habilitar acceso"
              hint="Permite que el usuario inicie sesión."
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editingAdmin ? 'Guardar Cambios' : 'Crear Administrador'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function SuperAdminMetricsPage() {
  const [searchParams] = useSearchParams()
  const organizationId = getNullableNumberParam(searchParams, 'organization_id')

  const [organizationsQuery, orgAdminsQuery] = useQueries({
    queries: [
      {
        queryKey: ['superadmin', 'metrics', 'organizations'],
        queryFn: () => listOrganizations({ page: 1 }),
      },
      {
        queryKey: ['superadmin', 'metrics', 'org-admins', organizationId],
        queryFn: () => listOrgAdmins({ page: 1, organization_id: organizationId }),
      },
    ],
  })

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Métricas Generales</h1>
        <p className="mt-2 text-sm text-muted-foreground">Estado operativo y resumen del alcance de la plataforma.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg text-foreground">Organizaciones</h3>
          </div>
          <p className="mt-4 text-5xl font-display text-foreground">{organizationsQuery.data?.total ?? 0}</p>
          <p className="mt-2 text-sm text-muted-foreground">Total de clientes manejados en el portal actual.</p>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg text-foreground">Admins Activos</h3>
          </div>
          <p className="mt-4 text-5xl font-display text-foreground">{orgAdminsQuery.data?.total ?? 0}</p>
          <p className="mt-2 text-sm text-muted-foreground">Responsables habilitados con permisos de acceso.</p>
        </div>
      </div>
    </div>
  )
}
