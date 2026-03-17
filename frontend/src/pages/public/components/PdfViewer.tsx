import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { PublicMaterial, MaterialResource } from '@/types'

interface PdfViewerProps {
  material: PublicMaterial
  resource: MaterialResource
}

export function PdfViewer({ material, resource }: PdfViewerProps) {
  if (resource.type !== 'pdf') return null

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-muted shadow-2xl">
        <iframe
          title={material.title}
          src={`${resource.url}#toolbar=0`}
          className="h-full w-full"
        />
      </div>
      <Card className="rounded-2xl border-none bg-background/40 backdrop-blur-md">
        <CardContent className="p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold text-foreground">{material.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {material.description || 'Documento disponible para visualizar.'}
              </p>
            </div>
            <Button 
              variant="secondary" 
              className="rounded-full px-6"
              onClick={() => window.open(resource.url, '_blank')}
            >
              Ampliar <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
