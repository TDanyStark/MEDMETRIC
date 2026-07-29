import { Trash2 } from 'lucide-react'
import { TableCell, TableRow } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { formatDateTime, getInitials } from '@/lib/utils'
import { Comment } from '@/types/comment'
import { useAuth } from '@/contexts/useAuth'

interface CommentRowProps {
  comment: Comment
  onDelete: (comment: Comment) => void
}

export function CommentRow({ comment, onDelete }: CommentRowProps) {
  const { user } = useAuth()
  const authorLabel = comment.author_type === 'doctor' ? 'Médico' : 'Representante'

  return (
    <TableRow className="group transition-colors hover:bg-muted/20 align-top">
      <TableCell className="font-medium text-foreground">
        {comment.doctor_name ?? '—'}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {comment.rep_name ?? '—'}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[0.65rem]">
              {getInitials(comment.author_name ?? authorLabel)}
            </AvatarFallback>
          </Avatar>
          <Badge variant={comment.author_type === 'doctor' ? 'accent' : 'outline'}>
            {authorLabel}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="max-w-md whitespace-normal text-sm text-foreground">
        {comment.body}
      </TableCell>
      <TableCell>
        {comment.material_title ? (
          <Badge variant="default">{comment.material_title}</Badge>
        ) : (
          <Badge variant="outline">Abierto</Badge>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDateTime(comment.created_at, user?.organization_timezone)}
      </TableCell>
      <TableCell className="text-right">
        {comment.can_delete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(comment)}
            className="opacity-70 hover:opacity-100 transition-opacity p-2 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
