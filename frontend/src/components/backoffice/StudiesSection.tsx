import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/backoffice/Workbench'
import { StudyFormDialog } from '@/components/backoffice/StudyFormDialog'
import { StudyListItem } from '@/components/backoffice/StudyListItem'
import { MaterialStudy, MaterialStudyType, PaginatedData, PendingStudy } from '@/types/backoffice'

interface PersistedStudiesSectionProps {
  /** Default mode — unchanged, API-backed behavior for editing a real material. */
  mode?: 'persisted'
  /** Id of the parent material this studies list belongs to. */
  materialId: number
  /** Namespaces the TanStack Query cache key (org-admin vs manager). */
  scope: 'org-admin' | 'manager'
  listFn: (materialId: number) => Promise<PaginatedData<MaterialStudy>>
  createFn: (materialId: number, payload: FormData) => Promise<MaterialStudy>
  updateFn: (studyId: number, payload: FormData) => Promise<MaterialStudy>
  deleteFn: (studyId: number) => Promise<{ message: string }>
}

interface PendingStudiesSectionProps {
  /** Used while the parent material is still being CREATED (no `material_id` yet). */
  mode: 'pending'
  value: PendingStudy[]
  onChange: (next: PendingStudy[]) => void
}

export type StudiesSectionProps = PersistedStudiesSectionProps | PendingStudiesSectionProps

/** Shape `StudyListItem`/`StudyFormDialog` understand; `tempId` tags pending-mode identity. */
type DisplayStudy = MaterialStudy & { tempId?: string }

function pendingToDisplayStudy(study: PendingStudy): DisplayStudy {
  return {
    id: 0,
    material_id: 0,
    title: study.title,
    type: study.type,
    external_url: study.type === 'link' ? study.external_url ?? null : null,
    created_at: '',
    updated_at: '',
    tempId: study.tempId,
  }
}

/**
 * Shared "estudios médicos" sub-resource manager for a material.
 *
 * - `persisted` (default): unchanged from the original implementation —
 *   requires `materialId` + role-scoped CRUD functions, backed by TanStack
 *   Query against the real API. Used by edit-mode call sites.
 * - `pending`: used while a material is still being CREATED (no `material_id`
 *   yet). Operates purely on a controlled local array (`value`/`onChange`)
 *   with ZERO API calls — add/edit/delete only mutate the in-memory list.
 *   Reuses the exact same `StudyFormDialog`/`StudyListItem` presentational
 *   pieces as persisted mode.
 */
export function StudiesSection(props: StudiesSectionProps) {
  const isPending = props.mode === 'pending'
  const persisted = !isPending ? props : null

  const queryClient = useQueryClient()
  const queryKey = persisted
    ? ([persisted.scope, 'materials', persisted.materialId, 'studies'] as const)
    : (['pending-studies-inert'] as const)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingStudy, setEditingStudy] = useState<DisplayStudy | null>(null)
  const [deletingStudy, setDeletingStudy] = useState<DisplayStudy | null>(null)

  const studiesQuery = useQuery({
    queryKey,
    queryFn: () => persisted!.listFn(persisted!.materialId),
    enabled: !!persisted,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: FormData) => {
      if (!persisted) return Promise.reject(new Error('StudiesSection: not in persisted mode'))
      return editingStudy
        ? persisted.updateFn(editingStudy.id, payload)
        : persisted.createFn(persisted.materialId, payload)
    },
    onSuccess: () => {
      toast.success(editingStudy ? 'Estudio actualizado.' : 'Estudio agregado.')
      void queryClient.invalidateQueries({ queryKey })
      setIsFormOpen(false)
      setEditingStudy(null)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el estudio.'
      toast.error(message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (studyId: number) => {
      if (!persisted) return Promise.reject(new Error('StudiesSection: not in persisted mode'))
      return persisted.deleteFn(studyId)
    },
    onSuccess: () => {
      toast.success('Estudio eliminado.')
      void queryClient.invalidateQueries({ queryKey })
      setDeletingStudy(null)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el estudio.'
      toast.error(message)
    },
  })

  const studies: DisplayStudy[] = isPending
    ? props.value.map(pendingToDisplayStudy)
    : studiesQuery.data?.items ?? []

  const isLoadingList = !isPending && studiesQuery.isLoading

  const openAddDialog = () => {
    setEditingStudy(null)
    setIsFormOpen(true)
  }

  const handleFormSave = async (payload: FormData) => {
    if (!isPending) {
      await saveMutation.mutateAsync(payload)
      return
    }

    const title = String(payload.get('title') ?? '')
    const typeFromForm = payload.get('type') as MaterialStudyType | null
    const newFile = payload.get('file')
    const externalUrlValue = payload.get('external_url')

    if (editingStudy?.tempId) {
      const type = typeFromForm ?? editingStudy.type
      props.onChange(
        props.value.map((item) =>
          item.tempId === editingStudy.tempId
            ? {
                ...item,
                title,
                type,
                file: newFile instanceof File ? newFile : type === 'pdf' ? item.file : undefined,
                external_url:
                  type === 'link'
                    ? typeof externalUrlValue === 'string'
                      ? externalUrlValue
                      : item.external_url
                    : undefined,
              }
            : item,
        ),
      )
    } else {
      const type: MaterialStudyType = typeFromForm ?? 'pdf'
      const newStudy: PendingStudy = {
        tempId: crypto.randomUUID(),
        title,
        type,
        file: type === 'pdf' && newFile instanceof File ? newFile : undefined,
        external_url:
          type === 'link' && typeof externalUrlValue === 'string' ? externalUrlValue : undefined,
      }
      props.onChange([...props.value, newStudy])
    }

    toast.success(editingStudy ? 'Estudio actualizado.' : 'Estudio agregado.')
    setIsFormOpen(false)
    setEditingStudy(null)
  }

  const handleDeleteConfirm = () => {
    if (!deletingStudy) return

    if (isPending) {
      props.onChange(props.value.filter((item) => item.tempId !== deletingStudy.tempId))
      toast.success('Estudio eliminado.')
      setDeletingStudy(null)
      return
    }

    void deleteMutation.mutateAsync(deletingStudy.id)
  }

  return (
    <div className="rounded-3xl border border-border/50 bg-muted/10 p-6 animate-in fade-in duration-500 sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">Estudios médicos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPending
              ? 'Se guardarán junto con el material al crearlo.'
              : 'Documentos y enlaces de respaldo científico asociados a este material.'}
          </p>
        </div>
        <Button type="button" size="sm" onClick={openAddDialog}>
          <Plus className="h-4 w-4" /> Agregar estudio
        </Button>
      </div>

      <div className="mt-5">
        {isLoadingList ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : studies.length === 0 ? (
          <EmptyState
            title="Sin estudios todavía"
            description="Agrega el primer estudio (PDF o enlace) para respaldar este material."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {studies.map((study) => (
              <StudyListItem
                key={isPending ? study.tempId : study.id}
                study={study}
                onEdit={(item) => {
                  setEditingStudy(item)
                  setIsFormOpen(true)
                }}
                onDelete={(item) => setDeletingStudy(item)}
              />
            ))}
          </div>
        )}
      </div>

      <StudyFormDialog
        isOpen={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open)
          if (!open) setEditingStudy(null)
        }}
        editingStudy={editingStudy}
        onSave={handleFormSave}
        isSaving={!isPending && saveMutation.isPending}
      />

      <Dialog
        open={!!deletingStudy}
        onOpenChange={(open) => {
          if (!open) setDeletingStudy(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <DialogTitle className="pt-3">¿Eliminar estudio?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-left">
                <p>
                  Estás a punto de eliminar{' '}
                  <strong className="text-foreground">{deletingStudy?.title}</strong>.
                </p>
                <p className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive">
                  {isPending
                    ? 'Puedes volver a agregarlo antes de crear el material.'
                    : 'Esta acción es permanente e irreversible.'}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 border-t border-border/50 pt-4">
            <Button type="button" variant="outline" onClick={() => setDeletingStudy(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={!isPending && deleteMutation.isPending}
              onClick={handleDeleteConfirm}
            >
              Eliminar definitivamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
