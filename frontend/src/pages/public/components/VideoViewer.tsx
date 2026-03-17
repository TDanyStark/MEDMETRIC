import { Card, CardContent } from '@/components/ui/Card'
import { PublicMaterial, MaterialResource } from '@/types'

interface VideoViewerProps {
  material: PublicMaterial
  resource: MaterialResource
}

export function VideoViewer({ material, resource }: VideoViewerProps) {
  if (resource.type !== 'video') return null

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-2xl">
        <iframe
          title={resource.title || material.title}
          src={resource.embed_url ?? resource.url}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <Card className="rounded-2xl border-none bg-background/20 backdrop-blur-md">
        <CardContent className="p-8">
          <h3 className="text-2xl font-bold text-foreground">{resource.title || material.title}</h3>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {resource.description || material.description || 'Contenido audiovisual disponible.'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
