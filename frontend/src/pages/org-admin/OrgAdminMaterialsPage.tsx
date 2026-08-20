import { useMemo, useState } from 'react'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { EmptyState, PaginationBar } from '@/components/backoffice/Workbench'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'

import { getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { routePath } from '@/lib/routes'
import { getUserFriendlyErrorMessage } from '@/services/api'
import {
  approveOrgMaterial,
  deleteOrgMaterial,
  listOrgBrands,
  listOrgMaterials,
  listOrgUsers,
  setOrgMaterialVisibility,
} from '@/services/backoffice'
import { Material } from '@/types/backoffice'

import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'
import { OrgMaterialsTable } from './components/OrgMaterialsTable'
import { OrgMaterialFilters } from './components/OrgMaterialFilters'
import { OrgPreviewDialog } from './components/OrgPreviewDialog'

export function OrgAdminMaterialsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [previewingMaterial, setPreviewingMaterial] = useState<Material | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null)

  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')
  const status = getStringParam(searchParams, 'status', 'all')
  const type = getStringParam(searchParams, 'type', 'all')
  const brandId = getStringParam(searchParams, 'brand_id', 'all')
  const managerId = getStringParam(searchParams, 'manager_id', 'all')

  const [materialsQuery, brandsQuery, managersQuery] = useQueries({
    queries: [
      {
        queryKey: ['org-admin', 'materials', q, page, status, type, brandId, managerId],
        queryFn: () =>
          listOrgMaterials({
            q,
            page,
            status: status === 'all' ? undefined : status,
            type: type === 'all' ? undefined : type,
            brand_id: brandId === 'all' ? undefined : Number(brandId),
            manager_id: managerId === 'all' ? undefined : Number(managerId),
          }),
      },
      {
        queryKey: ['org-admin', 'brands', 'material-options'],
        queryFn: () => listOrgBrands({ all: true }),
      },
      {
        queryKey: ['org-admin', 'managers', 'material-options'],
        queryFn: () => listOrgUsers({ role: 'manager', page: 1 }),
      },
    ],
  })

  const brandMap = useMemo(() => {
    return new Map((brandsQuery.data?.items ?? []).map((item) => [item.id, item.name]))
  }, [brandsQuery.data])

  const managerOptions = useMemo(() => {
    return (managersQuery.data?.items ?? []).map((m) => ({ id: m.id, name: m.name }))
  }, [managersQuery.data])

  const approveMutation = useMutation({
    mutationFn: (materialId: number) => approveOrgMaterial(materialId),
    onSuccess: () => {
      toast.success('Material aprobado.')
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'materials'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo aprobar.'
      toast.error(message)
    },
  })

  const visibilityMutation = useMutation({
    mutationFn: ({ id, isVisible }: { id: number; isVisible: boolean }) => setOrgMaterialVisibility(id, isVisible),
    onSuccess: () => {
      toast.success('Visibilidad actualizada.')
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'materials'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la visibilidad.'
      toast.error(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (materialId: number) => deleteOrgMaterial(materialId),
    onSuccess: () => {
      toast.success('Material eliminado.')
      setDeletingMaterial(null)
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'materials'] })
    },
    onError: (error) => {
      toast.error(
        getUserFriendlyErrorMessage(
          error,
          'Ocurrió un error inesperado al eliminar el material. Intenta de nuevo o contacta soporte si el problema persiste.',
        ),
      )
    },
  })

  const handleOpenNewDialog = () => {
    navigate(routePath('/materials/new'))
  }

  const handleEdit = (material: Material) => {
    navigate(routePath('/materials/:id/edit', { id: material.id }))
  }

  const handlePreview = (material: Material) => {
    setPreviewingMaterial(material)
    setIsPreviewOpen(true)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
            Materiales
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Todos los materiales de la organización y la marca a la que pertenecen.
          </p>
        </div>
        <Button onClick={handleOpenNewDialog}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Material
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <OrgMaterialFilters
          q={q ?? ''}
          status={status}
          type={type}
          brandId={brandId}
          managerId={managerId}
          brands={brandsQuery.data?.items ?? []}
          managers={managerOptions}
          onSearchChange={(value) =>
            setSearchParams((current) => updateSearchParams(current, { q: value || null, page: 1 }))
          }
          onStatusChange={(value) =>
            setSearchParams((current) =>
              updateSearchParams(current, { status: value === 'all' ? null : value, page: 1 }),
            )
          }
          onTypeChange={(value) =>
            setSearchParams((current) =>
              updateSearchParams(current, { type: value === 'all' ? null : value, page: 1 }),
            )
          }
          onBrandChange={(value) =>
            setSearchParams((current) =>
              updateSearchParams(current, { brand_id: value === 'all' ? null : value, page: 1 }),
            )
          }
          onManagerChange={(value) =>
            setSearchParams((current) =>
              updateSearchParams(current, { manager_id: value === 'all' ? null : value, page: 1 }),
            )
          }
          onClear={() =>
            setSearchParams((current) =>
              updateSearchParams(current, {
                q: null,
                status: null,
                type: null,
                brand_id: null,
                manager_id: null,
                page: 1,
              }),
            )
          }
        />

        {materialsQuery.isLoading && <LoadingState message="Cargando materiales..." />}
        {materialsQuery.isError && <ErrorState message="No se pudieron cargar los materiales." />}

        {!materialsQuery.isLoading &&
          !materialsQuery.isError &&
          materialsQuery.data?.items.length === 0 && (
            <EmptyState title="Sin materiales" description="Aún no hay materiales en la organización." />
          )}

        {!materialsQuery.isLoading &&
          !materialsQuery.isError &&
          (materialsQuery.data?.items.length ?? 0) > 0 && (
            <OrgMaterialsTable
              materials={materialsQuery.data?.items ?? []}
              brandMap={brandMap}
              onEdit={handleEdit}
              onApprove={(id) => void approveMutation.mutateAsync(id)}
              isApproving={(id) => approveMutation.isPending && approveMutation.variables === id}
              onToggleVisible={(id, value) => void visibilityMutation.mutateAsync({ id, isVisible: value })}
              isTogglingVisible={(id) => visibilityMutation.isPending && visibilityMutation.variables?.id === id}
              onDelete={(material) => setDeletingMaterial(material)}
              onPreview={handlePreview}
            />
          )}

        <PaginationBar
          page={materialsQuery.data?.page ?? page}
          lastPage={materialsQuery.data?.last_page ?? 1}
          total={materialsQuery.data?.total ?? 0}
          onPageChange={(nextPage) =>
            setSearchParams((current) => updateSearchParams(current, { page: nextPage }))
          }
        />
      </div>

      <OrgPreviewDialog
        isOpen={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        material={previewingMaterial}
      />

      <Dialog
        open={!!deletingMaterial}
        onOpenChange={(open) => {
          if (!open) setDeletingMaterial(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <DialogTitle className="pt-3">¿Eliminar material?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  Estás a punto de eliminar <strong className="text-foreground">{deletingMaterial?.title}</strong>.
                </p>
                <p className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive">
                  Se eliminarán también, de forma <strong>permanente e irreversible</strong>, todas
                  las métricas de visualización y sesiones de visita asociadas a este material. Esta
                  acción no se puede deshacer.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => setDeletingMaterial(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (deletingMaterial) void deleteMutation.mutateAsync(deletingMaterial.id)
              }}
            >
              Eliminar definitivamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
