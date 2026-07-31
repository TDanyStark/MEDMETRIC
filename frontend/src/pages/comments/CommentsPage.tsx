import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { CommentFilters } from '@/components/comments/CommentFilters'
import { CommentsList } from '@/components/comments/CommentsList'
import { CommentDetailDialog } from '@/components/comments/CommentDetailDialog'

import { getBooleanParam, getStringParam, getNumberParam, updateSearchParams } from '@/lib/search'
import { getUserFriendlyErrorMessage } from '@/services/api'
import { deleteComment, listComments } from '@/services/comments'
import { Comment } from '@/types/comment'

export function CommentsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [deletingComment, setDeletingComment] = useState<Comment | null>(null)
  const [viewingComment, setViewingComment] = useState<Comment | null>(null)

  const q = getStringParam(searchParams, 'q')
  const hasMaterialFlag = getBooleanParam(searchParams, 'has_material')
  const hasMaterial = hasMaterialFlag === null ? '' : String(hasMaterialFlag)
  const dateFrom = getStringParam(searchParams, 'date_from')
  const dateTo = getStringParam(searchParams, 'date_to')
  const page = getNumberParam(searchParams, 'page')

  const commentsQuery = useQuery({
    queryKey: ['comments', q, hasMaterial, dateFrom, dateTo, page],
    queryFn: () =>
      listComments({
        q: q || undefined,
        has_material: hasMaterialFlag ?? undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => deleteComment(commentId),
    onSuccess: () => {
      toast.success('Comentario eliminado.')
      setDeletingComment(null)
      setViewingComment(null)
      void queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
    onError: error => {
      toast.error(getUserFriendlyErrorMessage(error, 'No se pudo eliminar el comentario.'))
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
            Comentarios
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Comentarios que médicos y visitadores dejaron sobre las sesiones de visita.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <CommentFilters
          q={q ?? ''}
          hasMaterial={hasMaterial}
          dateFrom={dateFrom ?? ''}
          dateTo={dateTo ?? ''}
          onSearchChange={value =>
            setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))
          }
          onHasMaterialChange={value =>
            setSearchParams(current => updateSearchParams(current, { has_material: value || null, page: 1 }))
          }
          onDateFromChange={value =>
            setSearchParams(current => updateSearchParams(current, { date_from: value || null, page: 1 }))
          }
          onDateToChange={value =>
            setSearchParams(current => updateSearchParams(current, { date_to: value || null, page: 1 }))
          }
          onClear={() =>
            setSearchParams(current =>
              updateSearchParams(current, {
                q: null,
                has_material: null,
                date_from: null,
                date_to: null,
                page: 1,
              }),
            )
          }
        />

        {commentsQuery.isLoading && <LoadingState message="Cargando comentarios..." />}
        {commentsQuery.isError && <ErrorState message="No se pudieron cargar los comentarios." />}

        {!commentsQuery.isLoading &&
          !commentsQuery.isError &&
          commentsQuery.data?.items.length === 0 && (
            <EmptyState
              title="Sin comentarios"
              description="Aún no hay comentarios registrados para estas sesiones de visita."
            />
          )}

        {!commentsQuery.isLoading &&
          !commentsQuery.isError &&
          (commentsQuery.data?.items.length ?? 0) > 0 && (
            <CommentsList
              comments={commentsQuery.data?.items ?? []}
              onDelete={setDeletingComment}
              onView={setViewingComment}
            />
          )}

        <PaginationBar
          page={commentsQuery.data?.page ?? page}
          lastPage={commentsQuery.data?.last_page ?? 1}
          total={commentsQuery.data?.total ?? 0}
          onPageChange={nextPage =>
            setSearchParams(current => updateSearchParams(current, { page: nextPage }))
          }
        />
      </div>

      <CommentDetailDialog
        comment={viewingComment}
        open={!!viewingComment}
        onOpenChange={open => {
          if (!open) setViewingComment(null)
        }}
        onDeleteRequest={setDeletingComment}
      />

      <Dialog
        open={!!deletingComment}
        onOpenChange={open => {
          if (!open) setDeletingComment(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar comentario</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas eliminar este comentario? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => setDeletingComment(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:border-destructive/50"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (deletingComment) void deleteMutation.mutateAsync(deletingComment.id)
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
