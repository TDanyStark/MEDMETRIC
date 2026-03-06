import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import {
  EmptyState,
  PaginationBar,
  SearchToolbar,
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
  createOrganization,
  listOrganizations,
  updateOrganization,
} from '@/services/backoffice'
import { Organization } from '@/types/backoffice'
import { LoadingState, ErrorState } from './components/SuperAdminHelpers'

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
