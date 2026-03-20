import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import { Material } from '@/types/backoffice'
import { getManagerMaterialPreview } from '@/services/backoffice'
import { LoadingState, ErrorState } from './ManagerHelpers'
import { PdfViewer } from '@/pages/public/components/PdfViewer'
import { VideoViewer } from '@/pages/public/components/VideoViewer'
import { LinkViewer } from '@/pages/public/components/LinkViewer'
import { PublicMaterial } from '@/types'
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

  // Map Material to PublicMaterial for the viewer components
  // ensuring we provide all required fields correctly
  const publicMaterial: PublicMaterial | null = material ? {
    id: material.id,
    title: material.title,
    description: material.description,
    cover_path: material.cover_path,
    cover_url: material.cover_url,
    type: material.type,
    status: material.status,
  } : null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-3xl border-border/50 bg-background/95 backdrop-blur-xl">
        <DialogHeader className="p-6 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div className="flex flex-col text-left">
              <DialogTitle className="text-xl">Vista Previa de Material</DialogTitle>
              <DialogDescription>
                Visualiza cómo se verá el contenido para los médicos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {isLoading && (
            <div className="py-20">
              <LoadingState message="Obteniendo recurso de previsualización..." />
            </div>
          )}
          
          {isError && (
            <div className="py-20">
              <ErrorState message="No se pudo cargar la previsualización del material." />
            </div>
          )}

          {!isLoading && !isError && resource && publicMaterial && (
            <div className="animate-in fade-in duration-500">
               {resource.type === 'pdf' && (
                 <PdfViewer material={publicMaterial} resource={resource} />
               )}
               {resource.type === 'video' && (
                 <VideoViewer material={publicMaterial} resource={resource} />
               )}
               {resource.type === 'link' && (
                 <div className="flex flex-col gap-6">
                   <LinkViewer material={publicMaterial} resource={resource} />
                   <div className="flex justify-center">
                     <Button 
                       variant="outline"
                       onClick={() => window.open(resource.url, '_blank', 'noopener,noreferrer')}
                       className="rounded-full px-8 border-primary/20 hover:bg-primary/10"
                     >
                       Reabrir Enlace <ExternalLink className="ml-2 h-4 w-4 text-primary" />
                     </Button>
                   </div>
                 </div>
               )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
