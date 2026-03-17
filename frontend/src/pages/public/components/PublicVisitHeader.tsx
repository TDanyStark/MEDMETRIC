import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/utils'
import { PublicSession } from '@/types'

interface PublicVisitHeaderProps {
  viewerType: 'rep' | 'doctor'
  session: PublicSession | undefined
  materialCount: number | undefined
}

export function PublicVisitHeader({ viewerType, session, materialCount }: PublicVisitHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between px-2">
      <div>
        <div className="flex items-center gap-2 mb-2">
          {viewerType === 'rep' ? (
            <Badge variant="accent" className="rounded-full px-2 py-0 text-[10px] uppercase font-bold tracking-tighter">
              Modo Visitador
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full border-primary/50 text-primary px-2 py-0 text-[10px] uppercase font-bold tracking-tighter">
              Vista Médico
            </Badge>
          )}
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
            {formatDateTime(session?.created_at ?? '')}
          </span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
          {session?.doctor_name || 'Sesion Medica'}
        </h1>
        {session?.notes && (
          <p className="mt-1 text-sm text-muted-foreground/80 italic line-clamp-1">
            "{session.notes}"
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className="rounded-full bg-background/50 backdrop-blur-sm border-border/50 px-4 py-1.5 shadow-sm">
          <span className="font-bold text-primary mr-1">{materialCount}</span> materiales listos
        </Badge>
      </div>
    </div>
  )
}
