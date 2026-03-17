import { useMemo, useState } from 'react'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import {
  EmptyState,
  PaginationBar,
} from '@/components/backoffice/Workbench'
import { Button } from '@/components/ui/Button'

import { getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import {
  approveManagerMaterial,
  createManagerMaterial,
  listManagerBrands,
  listManagerMaterials,
  updateManagerMaterial,
} from '@/services/backoffice'
import { Material } from '@/types/backoffice'
import { LoadingState, ErrorState } from './components/ManagerHelpers'
import { MaterialsTable } from './components/MaterialsTable'
import { MaterialDialog } from './components/MaterialDialog'
import { MaterialFilters } from './components/MaterialFilters'

export function ManagerMaterialsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

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

  const saveMutation = useMutation({
    mutationFn: async (payload: FormData) => {
      return editingMaterial 
        ? updateManagerMaterial(editingMaterial.id, payload) 
        : createManagerMaterial(payload)
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
    setIsDialogOpen(true)
  }

  const handleEdit = (material: Material) => {
    setEditingMaterial(material)
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
        <MaterialFilters
          q={q ?? ''}
          status={status}
          type={type}
          onSearchChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
          onStatusChange={value => setSearchParams(current => updateSearchParams(current, { status: value === 'all' ? null : value, page: 1 }))}
          onTypeChange={value => setSearchParams(current => updateSearchParams(current, { type: value === 'all' ? null : value, page: 1 }))}
        />

        {materialsQuery.isLoading && <LoadingState message="Cargando materiales..." />}
        {materialsQuery.isError && <ErrorState message="No se pudieron cargar los materiales." />}

        {!materialsQuery.isLoading && !materialsQuery.isError && materialsQuery.data?.items.length === 0 && (
          <EmptyState title="Sin materiales" description="Crea tu primer material." />
        )}

        {!materialsQuery.isLoading && !materialsQuery.isError && (materialsQuery.data?.items.length ?? 0) > 0 && (
          <MaterialsTable
            materials={materialsQuery.data?.items ?? []}
            brandMap={brandMap}
            onEdit={handleEdit}
            onApprove={id => void approveMutation.mutateAsync(id)}
            isApproving={id => approveMutation.isPending && approveMutation.variables === id}
          />
        )}

        <PaginationBar
          page={materialsQuery.data?.page ?? page}
          lastPage={materialsQuery.data?.last_page ?? 1}
          total={materialsQuery.data?.total ?? 0}
          onPageChange={nextPage => setSearchParams(current => updateSearchParams(current, { page: nextPage }))}
        />
      </div>

      <MaterialDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingMaterial={editingMaterial}
        brands={brandsQuery.data?.items ?? []}
        onSave={async payload => { await saveMutation.mutateAsync(payload) }}
        isSaving={saveMutation.isPending}
      />
    </div>
  )
}
