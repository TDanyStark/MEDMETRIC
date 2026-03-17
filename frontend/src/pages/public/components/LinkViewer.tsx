import { ExternalLink } from 'lucide-react'
import { PublicMaterial, MaterialResource } from '@/types'

interface LinkViewerProps {
  material: PublicMaterial
  resource: MaterialResource
}

export function LinkViewer({ material, resource }: LinkViewerProps) {
  if (resource.type !== 'link') return null

  return (
    <div className="flex min-h-125 flex-col items-center justify-center rounded-2xl border border-border bg-background shadow-2xl shadow-purple-500/5 px-10 text-center animate-in zoom-in-95 duration-500">
      <div className="rounded-full bg-amber-500/10 p-8 mb-6 ring-1 ring-amber-500/20">
        <ExternalLink className="h-12 w-12 text-amber-600" />
      </div>
      <h3 className="text-2xl font-bold text-foreground">{material.title}</h3>
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
        El enlace externo se ha abierto en una ventana independiente manteniendo su sesión activa.
      </p>
    </div>
  )
}
