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
}

export function CommentsList({ comments, onDelete }: CommentsListProps) {
  return (
    <div className="rounded-3xl border border-border/50 bg-background/50 shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[16%]">Médico</TableHead>
            <TableHead className="w-[14%]">Representante</TableHead>
            <TableHead className="w-[14%]">Autor</TableHead>
            <TableHead>Comentario</TableHead>
            <TableHead className="w-[16%]">Material</TableHead>
            <TableHead className="w-[14%]">Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comments.map(comment => (
            <CommentRow key={comment.id} comment={comment} onDelete={onDelete} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
