import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { formatDateTime, getInitials } from '@/lib/utils'
import { Comment } from '@/types/comment'
import { useAuth } from '@/contexts/useAuth'

interface CommentDetailDialogProps {
  comment: Comment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleteRequest: (comment: Comment) => void
}

export function CommentDetailDialog({
  comment,
  open,
  onOpenChange,
  onDeleteRequest,
}: CommentDetailDialogProps) {
  const { user } = useAuth()

  if (!comment) return null

  const authorLabel = comment.author_type === 'doctor' ? 'Médico' : 'Representante'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Comentario</DialogTitle>
          <DialogDescription>
            Detalle completo del comentario dejado sobre la sesión de visita.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-border/50 pb-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Médico
            </p>
            <p className="mt-1 font-medium text-foreground">{comment.doctor_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Representante
            </p>
            <p className="mt-1 font-medium text-foreground">{comment.rep_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Autor
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[0.6rem]">
                  {getInitials(comment.author_name ?? authorLabel)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">
                {comment.author_name ?? '—'}
              </span>
              <Badge variant={comment.author_type === 'doctor' ? 'accent' : 'outline'}>
                {authorLabel}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Material
            </p>
            <div className="mt-1">
              {comment.material_title ? (
                <Badge variant="default">{comment.material_title}</Badge>
              ) : (
                <Badge variant="outline">Abierto</Badge>
              )}
            </div>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fecha
            </p>
            <p className="mt-1 font-medium text-foreground">
              {formatDateTime(comment.created_at, user?.organization_timezone)}
            </p>
          </div>
        </div>

        <div className="max-h-[45vh] overflow-y-auto rounded-2xl bg-muted/20 p-4">
          <p className="select-text whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {comment.body}
          </p>
        </div>

        {comment.can_delete && (
          <div className="flex justify-end border-t border-border/50 pt-4">
            <Button
              type="button"
              variant="outline"
              className="border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/5"
              onClick={() => onDeleteRequest(comment)}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar comentario
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
