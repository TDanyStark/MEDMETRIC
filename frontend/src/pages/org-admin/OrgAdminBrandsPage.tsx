import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil } from 'lucide-react'
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
import { Textarea } from '@/components/ui/Textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'

import { getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { formatDateTime } from '@/lib/utils'
import {
  createOrgBrand,
  listOrgBrands,
  updateOrgBrand,
} from '@/services/backoffice'
import { Brand } from '@/types/backoffice'

import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'

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
