import { PublicMaterial, MaterialResource } from '@/types'
import { PublicVisitEmptyState } from './PublicVisitEmptyState'
import { PdfViewer } from './PdfViewer'
import { LinkViewer } from './LinkViewer'
import { VideoViewer } from './VideoViewer'

interface PublicVisitContentViewProps {
  activeMaterial: PublicMaterial | null
  resource: MaterialResource | null
}

export function PublicVisitContentView({ activeMaterial, resource }: PublicVisitContentViewProps) {
  return (
    <div className="relative">
      <div className="sticky top-8 space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Vista activa</h2>
        </div>

        {!activeMaterial ? (
          <PublicVisitEmptyState />
        ) : (
          <>
            {resource?.type === 'pdf' && (
              <PdfViewer material={activeMaterial} resource={resource} />
            )}
            {resource?.type === 'link' && (
              <LinkViewer material={activeMaterial} resource={resource} />
            )}
            {resource?.type === 'video' && (
              <VideoViewer material={activeMaterial} resource={resource} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
