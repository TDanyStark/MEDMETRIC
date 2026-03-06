import { Badge } from '@/components/ui/Badge'
import { Material, MaterialType } from '@/types/backoffice'

export function LoadingState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-border/50 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">{message}</div>
}

export function ErrorState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">{message}</div>
}

export function MaterialTypeLabel({ type }: { type: MaterialType }) {
  const label = type === 'pdf' ? 'PDF' : type === 'video' ? 'Video' : 'Link'
  return <Badge variant={type === 'pdf' ? 'outline' : type === 'video' ? 'accent' : 'warm'}>{label}</Badge>
}

export function StatusBadge({ status }: { status: Material['status'] }) {
  if (status === 'approved') return <Badge variant="success">Aprobado</Badge>
  if (status === 'archived') return <Badge variant="outline">Archivado</Badge>
  return <Badge variant="warm">Borrador</Badge>
}
