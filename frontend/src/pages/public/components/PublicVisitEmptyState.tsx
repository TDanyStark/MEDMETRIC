import { Share2 } from 'lucide-react'

export function PublicVisitEmptyState() {
  return (
    <div className="flex min-h-125 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 backdrop-blur-sm px-10 text-center transition-all duration-500">
      <div className="rounded-full bg-primary/5 p-8 mb-6 ring-1 ring-primary/20">
        <Share2 className="h-10 w-10 text-primary animate-pulse" />
      </div>
      <h3 className="text-xl font-semibold text-foreground">Listo para comenzar</h3>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground/70">
        Selecciona un material de la lista izquierda para iniciar la experiencia interactiva de la visita médica.
      </p>
    </div>
  )
}
