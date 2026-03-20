import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Share2, User } from 'lucide-react'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/utils'
import { PublicSession } from '@/types'

interface PublicVisitHeaderProps {
  viewerType: 'rep' | 'doctor'
  session: PublicSession | undefined
  materialCount: number | undefined
}

export function PublicVisitHeader({ viewerType, session, materialCount }: PublicVisitHeaderProps) {
  const handleShare = () => {
    const url = new URL(window.location.href)
    url.searchParams.set('viewer_type', 'doctor')
    navigator.clipboard.writeText(url.toString())
    toast.success('Enlace de visita copiado para el médico')
  }

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
          {session?.doctor_name ? `Hola, ${session.doctor_name} 👋🏻` : 'Sesión Médica'}
        </h1>
        <div className="flex flex-col gap-1 mt-1">
          {session?.rep_name && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <User className="w-3.5 h-3.5 text-primary/70" />
              <span>Representante: <span className="text-foreground/80">{session.rep_name}</span></span>
            </div>
          )}
          {session?.notes && (
            <p className="text-sm text-muted-foreground/80 italic line-clamp-1">
              "{session.notes}"
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {viewerType === 'rep' && (
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-full gap-2 border-primary/20 hover:bg-primary/5 text-primary"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4" />
            Compartir con Médico
          </Button>
        )}
        <Badge variant="outline" className="rounded-full bg-background/50 backdrop-blur-sm border-border/50 px-4 py-1.5 shadow-sm">
          <span className="font-bold text-primary mr-1">{materialCount}</span> materiales listos
        </Badge>
      </div>
    </div>
  )
}
