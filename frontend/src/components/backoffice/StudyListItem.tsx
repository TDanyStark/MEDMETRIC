import { ExternalLink, FileText, Pencil, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MaterialStudy } from '@/types/backoffice'

interface StudyListItemProps {
  study: MaterialStudy
  onEdit: (study: MaterialStudy) => void
  onDelete: (study: MaterialStudy) => void
}

const typeStyles: Record<MaterialStudy['type'], string> = {
  pdf: 'border-blue-500/30 bg-blue-500/10 text-blue-700',
  link: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
}

export function StudyListItem({ study, onEdit, onDelete }: StudyListItemProps) {
  const Icon = study.type === 'pdf' ? FileText : ExternalLink

  return (
    <div className="group flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-background/60 px-4 py-3 transition-colors hover:border-primary/20 hover:bg-background">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="line-clamp-2 text-sm font-semibold text-foreground">{study.title}</p>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{study.title}</TooltipContent>
          </Tooltip>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className={`gap-1.5 border py-0.5 font-bold ${typeStyles[study.type]}`}>
              {study.type === 'pdf' ? 'PDF' : 'Link'}
            </Badge>
            {typeof study.view_count === 'number' && (
              <span className="text-xs text-muted-foreground">{study.view_count} vistas</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="p-2"
          onClick={() => onEdit(study)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="p-2 text-destructive hover:text-destructive"
          onClick={() => onDelete(study)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
