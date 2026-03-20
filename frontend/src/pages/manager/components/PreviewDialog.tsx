import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Material } from '@/types/backoffice'
import { getManagerMaterialPreview } from '@/services/backoffice'
import { Button } from '@/components/ui/Button'

interface PreviewDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  material: Material | null
}

export function PreviewDialog({ isOpen, onOpenChange, material }: PreviewDialogProps) {
  const { data: resource, isLoading, isError } = useQuery({
    queryKey: ['manager', 'materials', material?.id, 'preview'],
    queryFn: () => getManagerMaterialPreview(material!.id),
    enabled: isOpen && !!material,
  })

  useEffect(() => {
    if (isOpen && resource?.type === 'link' && resource.url) {
      window.open(resource.url, '_blank', 'noopener,noreferrer')
    }
  }, [isOpen, resource])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden bg-background gap-0 sm:rounded-xl">
        <DialogHeader className="p-4 border-b bg-muted/20">
          <DialogTitle className="text-lg font-semibold">
            {material?.title}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col relative w-full h-[75vh] bg-muted/5">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : isError ? (
            <div className="flex h-full items-center justify-center text-destructive">
              Error al cargar la previsualización.
            </div>
          ) : !resource ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Contenido no disponible.
            </div>
          ) : resource.type === "pdf" ? (
            <iframe
              title={material?.title}
              src={`${resource.url}#toolbar=0`}
              className="h-full w-full border-none bg-muted/20"
            />
          ) : resource.type === "video" ? (
            <div className="flex h-full w-full items-center justify-center bg-black">
              <iframe
                title={material?.title}
                src={resource.embed_url ?? resource.url}
                className="w-full aspect-video max-h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : resource.type === "link" ? (
            <div className="flex h-full flex-col items-center justify-center p-10 text-center">
              <div className="rounded-full bg-amber-500/10 p-8 mb-6 ring-1 ring-amber-500/20">
                <ExternalLink className="h-12 w-12 text-amber-600" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">
                {material?.title}
              </h3>
              <p className="mt-4 max-w-md text-base text-muted-foreground mb-8">
                Este material es un enlace externo. Ábrelo para visualizar el
                contenido en una nueva pestaña.
              </p>
              <Button
                size="lg"
                onClick={() =>
                  window.open(
                    resource.url ?? material?.external_url ?? "",
                    "_blank",
                  )
                }
              >
                Abrir enlace externo <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Contenido no disponible.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
