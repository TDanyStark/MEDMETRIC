import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { CommentRow } from '@/components/comments/CommentRow'
import { Comment } from '@/types/comment'

interface CommentsListProps {
  comments: Comment[]
  onDelete: (comment: Comment) => void
  onView: (comment: Comment) => void
}

export function CommentsList({ comments, onDelete, onView }: CommentsListProps) {
  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[12%]">Médico</TableHead>
            <TableHead className="w-[10%]">Representante</TableHead>
            <TableHead className="w-[10%]">Autor</TableHead>
            <TableHead>Comentario</TableHead>
            <TableHead className="w-[12%]">Material</TableHead>
            <TableHead className="w-[11%]">Fecha</TableHead>
            <TableHead className="w-30 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comments.map(comment => (
            <CommentRow
              key={comment.id}
              comment={comment}
              onDelete={onDelete}
              onView={onView}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
