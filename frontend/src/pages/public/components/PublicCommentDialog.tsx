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
import { createPublicComment } from '@/services/comments'
import { PublicMaterial } from '@/types'

interface PublicCommentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  materials: PublicMaterial[]
  /**
   * Material id to preselect in the "¿Sobre qué quieres comentar?" picker,
   * e.g. when the dialog was opened from a specific material card's
   * "Comentar" button instead of the header's general composer button.
   * `null`/`undefined` falls back to the general (no material) option.
   */
  initialMaterialId?: number | null
}

export function PublicCommentDialog({ open, onOpenChange, token, materials, initialMaterialId }: PublicCommentDialogProps) {
  const queryClient = useQueryClient()
  const [body, setBody] = useState('')
  const [selectedOption, setSelectedOption] = useState<CommentMaterialOption | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)

  const options = buildCommentMaterialOptions(materials)
  const defaultOption =
    (initialMaterialId != null && options.find(option => option.value === String(initialMaterialId))) || options[0]
  const currentOption = selectedOption ?? defaultOption

  const resetForm = () => {
    setBody('')
    setSelectedOption(null)
    setBodyError(null)
  }

  const mutation = useMutation({
    mutationFn: () => {
      const trimmedBody = body.trim()
      const materialId = currentOption.value ? Number(currentOption.value) : undefined
      return createPublicComment(token, {
        body: trimmedBody,
        ...(materialId ? { material_id: materialId } : {}),
      })
    },
    onSuccess: () => {
      toast.success('Tu comentario fue enviado. ¡Gracias por tu opinión!')
      resetForm()
      onOpenChange(false)
      void queryClient.invalidateQueries({ queryKey: ['public-comments', token] })
    },
    onError: (error: unknown) => {
      if (error instanceof ApiRequestError && error.status === 429) {
        toast.error('Enviaste demasiados comentarios en poco tiempo. Espera un minuto e intenta de nuevo.')
        return
      }
      if (error instanceof ApiRequestError && error.status === 422) {
        const friendly = getUserFriendlyErrorMessage(error, 'Revisa tu comentario e intenta de nuevo.')
        setBodyError(friendly)
        return
      }
      toast.error(getUserFriendlyErrorMessage(error, 'No pudimos enviar tu comentario. Intenta de nuevo.'))
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
            Dejar un comentario
          </DialogTitle>
          <DialogDescription>
            Comparte tu opinión sobre esta visita o sobre un material en particular. Solo tú podrás ver este comentario.
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
              Enviar comentario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
