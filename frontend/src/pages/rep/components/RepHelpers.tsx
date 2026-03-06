import { FileText, PlayCircle, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { MaterialType } from '@/types/rep'

export function LoadingState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">{message}</div>
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">{message}</div>
}

export function MaterialTypeLabel({ type }: { type: MaterialType }) {
  const label = type === 'pdf' ? 'PDF' : type === 'video' ? 'Video' : 'Link'
  const Icon = type === 'pdf' ? FileText : type === 'video' ? PlayCircle : ExternalLink
  return (
    <Badge variant={type === 'pdf' ? 'outline' : type === 'video' ? 'accent' : 'warm'} className="gap-1.5 py-1">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  )
}
