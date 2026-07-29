import { MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { formatDateTime } from '@/lib/utils'
import { Comment } from '@/types/comment'

interface PublicOwnCommentsProps {
  comments: Comment[] | undefined
  isLoading: boolean
  isError: boolean
  organizationTimezone?: string | null
}

export function PublicOwnComments({ comments, isLoading, isError, organizationTimezone }: PublicOwnCommentsProps) {
  if (isLoading) {
    return <LoadingState message="Cargando tus comentarios..." />
  }

  if (isError) {
    return <ErrorState message="No pudimos cargar tus comentarios." />
  }

  if (!comments || comments.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold tracking-tight text-foreground">Tus comentarios</h2>
      </div>

      <div className="flex flex-col gap-3">
        {comments.map(comment => (
          <div key={comment.id} className="rounded-2xl border border-border/50 bg-background/50 px-4 py-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              {comment.material_title ? (
                <Badge variant="accent" className="rounded-full">
                  {comment.material_title}
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-full">
                  Abierto
                </Badge>
              )}
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {formatDateTime(comment.created_at, organizationTimezone)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">{comment.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
