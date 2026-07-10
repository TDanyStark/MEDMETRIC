import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchParams } from 'react-router-dom'

import { EmptyState, PaginationBar } from '@/components/backoffice/Workbench'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { DoctorFilters } from '@/components/doctors/DoctorFilters'
import { DoctorsTable } from '@/components/doctors/DoctorsTable'
import { CreateDoctorDialog } from '@/components/doctors/CreateDoctorDialog'
import { EditDoctorDialog } from '@/components/doctors/EditDoctorDialog'

import { getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { deleteDoctor, listDoctors } from '@/services/doctors'
import { Doctor } from '@/types/doctor'

export function DoctorsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)
  const [deletingDoctor, setDeletingDoctor] = useState<Doctor | null>(null)

  const q = getStringParam(searchParams, 'q')
  const region = getStringParam(searchParams, 'region')
  const category = getStringParam(searchParams, 'category')
  const page = getNumberParam(searchParams, 'page')

  const doctorsQuery = useQuery({
    queryKey: ['doctors', q, region, category, page],
    queryFn: () =>
      listDoctors({
        q: q || undefined,
        region: region || undefined,
        category: category || undefined,
        page,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (doctorId: number) => deleteDoctor(doctorId),
    onSuccess: () => {
      toast.success('Médico eliminado.')
      setDeletingDoctor(null)
      void queryClient.invalidateQueries({ queryKey: ['doctors'] })
    },
    onError: error => {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el médico.'
      toast.error(message)
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
            Médicos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Directorio de médicos con su historial de visitas y datos de contexto comercial.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo médico
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        <DoctorFilters
          q={q ?? ''}
          region={region ?? ''}
          category={category ?? ''}
          onSearchChange={value =>
            setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))
          }
          onRegionChange={value =>
            setSearchParams(current => updateSearchParams(current, { region: value || null, page: 1 }))
          }
          onCategoryChange={value =>
            setSearchParams(current => updateSearchParams(current, { category: value || null, page: 1 }))
          }
          onClear={() =>
            setSearchParams(current =>
              updateSearchParams(current, { q: null, region: null, category: null, page: 1 }),
            )
          }
        />

        {doctorsQuery.isLoading && <LoadingState message="Cargando médicos..." />}
        {doctorsQuery.isError && <ErrorState message="No se pudieron cargar los médicos." />}

        {!doctorsQuery.isLoading &&
          !doctorsQuery.isError &&
          doctorsQuery.data?.items.length === 0 && (
            <EmptyState
              title="Sin médicos"
              description="Aún no hay médicos registrados. Crea el primero para comenzar a asociar visitas."
            />
          )}

        {!doctorsQuery.isLoading &&
          !doctorsQuery.isError &&
          (doctorsQuery.data?.items.length ?? 0) > 0 && (
            <DoctorsTable
              doctors={doctorsQuery.data?.items ?? []}
              onEdit={setEditingDoctor}
              onDelete={setDeletingDoctor}
            />
          )}

        <PaginationBar
          page={doctorsQuery.data?.page ?? page}
          lastPage={doctorsQuery.data?.last_page ?? 1}
          total={doctorsQuery.data?.total ?? 0}
          onPageChange={nextPage =>
            setSearchParams(current => updateSearchParams(current, { page: nextPage }))
          }
        />
      </div>

      <CreateDoctorDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => setIsCreateOpen(false)}
      />

      <EditDoctorDialog
        doctor={editingDoctor}
        open={!!editingDoctor}
        onOpenChange={open => {
          if (!open) setEditingDoctor(null)
        }}
      />

      <Dialog
        open={!!deletingDoctor}
        onOpenChange={open => {
          if (!open) setDeletingDoctor(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar médico</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar a <strong>{deletingDoctor?.name}</strong>? Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => setDeletingDoctor(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/50"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (deletingDoctor) void deleteMutation.mutateAsync(deletingDoctor.id)
              }}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
