import { useEffect, useState } from 'react'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import {
  EmptyState,
  PaginationBar,
  SearchToolbar,
  ToggleField,
} from '@/components/backoffice/Workbench'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'

import { getNullableNumberParam, getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { formatDateTime } from '@/lib/utils'
import {
  createOrgAdmin,
  listOrgAdmins,
  listOrganizations,
  updateOrgAdmin,
} from '@/services/backoffice'
import { AdminUser } from '@/types/backoffice'
import { LoadingState, ErrorState } from './components/SuperAdminHelpers'

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
          <CustomSelect
            instanceId="org-filter"
            value={organizationId ? { label: organizationsQuery.data?.items.find(o => o.id === organizationId)?.name ?? 'Todas las Orgs', value: organizationId } : { label: 'Todas las Orgs', value: 'all' }}
            onChange={(option: any) => setSearchParams(current => updateSearchParams(current, { organization_id: option.value === 'all' ? null : Number(option.value), page: 1 }))}
            options={[
              { label: 'Todas las Orgs', value: 'all' },
              ...(organizationsQuery.data?.items ?? []).map(item => ({ label: item.name, value: item.id })),
            ]}
            className="w-full min-w-48 sm:w-auto"
            isLoading={organizationsQuery.isLoading}
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
            <CustomSelect
              label="Asignar a Organización"
              instanceId="org-assignment"
              placeholder="Selecciona una organización"
              value={form.organization_id ? { label: organizationsQuery.data?.items.find(o => o.id === form.organization_id)?.name ?? '', value: form.organization_id } : null}
              onChange={(option: any) => setForm(current => ({ ...current, organization_id: option ? Number(option.value) : null }))}
              options={organizationsQuery.data?.items.map(item => ({ label: item.name, value: item.id })) || []}
              isLoading={organizationsQuery.isLoading}
              required
            />
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
