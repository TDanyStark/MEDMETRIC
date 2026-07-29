import { FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageSquarePlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import {
  CommentComposerFields,
  CommentMaterialOption,
  MAX_COMMENT_LENGTH,
  buildCommentMaterialOptions,
} from '@/components/comments/CommentComposerFields'
import { ApiRequestError, getUserFriendlyErrorMessage } from '@/services/api'
import { createComment } from '@/services/comments'
import { PublicMaterial, PublicSession } from '@/types'

/**
 * Authenticated representative comment composer.
 *
 * Rendered on the SAME `/public/visit/:token` page the rep already opens
 * from "Historial de Sesiones" (via the "Abrir" link) — that page renders
 * in "Modo Visitador" for a logged-in rep and has already loaded
 * `session` + `materials` for this exact visit, so no extra fetch is
 * needed here (see `PublicVisitPage.tsx`).
 *
 * Differs from `PublicCommentDialog` (doctor, unauthenticated) in:
 * - Endpoint: authenticated `POST /v1/comments` (JWT) with `visit_session_id`
 *   in the body, vs the public per-token route.
 * - Error handling: surfaces a clear 403 message (rep viewing a session
 *   that isn't theirs — should not normally happen since the page is only
 *   reached from the rep's own history, but the backend re-validates
 *   ownership and we must not leak internals if it ever fires).
 * - No rate-limit (429) handling — the public endpoint is rate-limited,
 *   the authenticated rep endpoint is not.
 * - No "own comments" read-back — the rep already has a dedicated
 *   "Comentarios" module (`/rep/comments`) to browse everything they and
 *   doctors have written, so this composer only needs to CREATE.
 */

interface RepCommentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: PublicSession
  materials: PublicMaterial[]
}

export function RepCommentDialog({ open, onOpenChange, session, materials }: RepCommentDialogProps) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [selectedOption, setSelectedOption] = useState<CommentMaterialOption | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)

  const options = buildCommentMaterialOptions(materials)
  const currentOption = selectedOption ?? options[0]

  const resetForm = () => {
    setBody('')
    setSelectedOption(null)
    setBodyError(null)
  }

  const mutation = useMutation({
    mutationFn: () => {
      const trimmedBody = body.trim()
      const materialId = currentOption.value ? Number(currentOption.value) : undefined
      return createComment({
        visit_session_id: session.id,
        body: trimmedBody,
        ...(materialId ? { material_id: materialId } : {}),
      })
    },
    onSuccess: () => {
      toast.success('Tu comentario fue publicado.')
      resetForm()
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
    onError: (error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 403) {
        toast.error('No tienes permiso para comentar en esta sesión.')
        return
      }
      if (error instanceof ApiRequestError && error.status === 422) {
        const friendly = getUserFriendlyErrorMessage(error, 'Revisa tu comentario e intenta de nuevo.')
        setBodyError(friendly)
        return
      }
      toast.error(getUserFriendlyErrorMessage(error, 'No pudimos publicar tu comentario. Intenta de nuevo.'))
    },
  })

  const trimmedLength = body.trim().length
  const canSubmit = trimmedLength > 0 && trimmedLength <= MAX_COMMENT_LENGTH && !mutation.isPending

  const handleOpenChange = (next: boolean) => {
    if (mutation.isPending) return
    onOpenChange(next)
    if (!next) resetForm()
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setBodyError(null)

    if (trimmedLength === 0) {
      setBodyError('Escribe un comentario antes de enviarlo.')
      return
    }

    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            Comentar esta visita
          </DialogTitle>
          <DialogDescription>
            Deja una nota sobre esta visita o sobre un material en particular. Visible para tu organización en
            Comentarios.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <CommentComposerFields
            options={options}
            selectedOption={currentOption}
            onSelectedOptionChange={setSelectedOption}
            body={body}
            onBodyChange={value => {
              setBody(value)
              setBodyError(null)
            }}
            bodyError={bodyError}
          />

          <DialogFooter>
            <Button type="submit" size="lg" className="w-full sm:w-auto" loading={mutation.isPending} disabled={!canSubmit}>
              Publicar comentario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
