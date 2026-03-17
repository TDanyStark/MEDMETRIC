import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import api from '@/services/api'
import { ApiResponse, MaterialResource, PublicMaterial, PublicVisitPayload } from '@/types'

// Sub-components
import { PublicVisitLoading } from './components/PublicVisitLoading'
import { PublicVisitError } from './components/PublicVisitError'
import { PublicVisitHeader } from './components/PublicVisitHeader'
import { PublicVisitSidebar } from './components/PublicVisitSidebar'
import { PublicVisitContentView } from './components/PublicVisitContentView'

export default function PublicVisitPage() {
  const { token = '' } = useParams()
  const [activeMaterialId, setActiveMaterialId] = useState<number | null>(null)
  const [resource, setResource] = useState<MaterialResource | null>(null)
  const [openingId, setOpeningId] = useState<number | null>(null)
  
  const viewerInfo = useMemo(() => {
    try {
      const authUserStr = localStorage.getItem('auth_user')
      if (authUserStr) {
        const user = JSON.parse(authUserStr)
        if (user && user.role) {
          return { type: 'rep' as const, id: user.id || null }
        }
      }
    } catch(e) {
      // Ignore
    }
    return { type: 'doctor' as const, id: null }
  }, [])

  const sessionQuery = useQuery({
    queryKey: ['public-visit', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const res = await api.get<ApiResponse<PublicVisitPayload>>(`/public/session/${token}`)
      return res.data
    },
  })

  const activeMaterial = useMemo(
    () => sessionQuery.data?.materials.find(item => item.id === activeMaterialId) ?? null,
    [activeMaterialId, sessionQuery.data?.materials],
  )

  const handleOpenMaterial = async (material: PublicMaterial, openInNewWindow = false) => {
    const pdfUrl = `/api/v1/public/material/${material.id}/resource?session_token=${encodeURIComponent(token)}`

    // Early handling for PDF to avoid popup blockers
    if (material.type === 'pdf') {
      setActiveMaterialId(material.id)
      setResource({ type: 'pdf', url: pdfUrl })
      
      if (openInNewWindow) {
        window.open(pdfUrl, '_blank', 'noopener,noreferrer')
      }

      // Record hit in background
      api.post(`/public/material/${material.id}/open`, {
        session_token: token,
        viewer_type: viewerInfo.type,
        viewer_id: viewerInfo.id,
      }).catch(err => console.error('Failed to record open:', err))
      
      return
    }

    // For other types, we need the resource details from API
    setOpeningId(material.id)
    try {
      // Record hit first for non-PDF
      await api.post(`/public/material/${material.id}/open`, {
        session_token: token,
        viewer_type: viewerInfo.type,
        viewer_id: viewerInfo.id,
      })

      const res = await api.get<ApiResponse<MaterialResource>>(
        `/public/material/${material.id}/resource?session_token=${encodeURIComponent(token)}`,
      )

      setActiveMaterialId(material.id)
      setResource(res.data)

      if (openInNewWindow || (res.data.type === 'link' && res.data.url)) {
        const targetUrl = res.data.type === 'link' ? res.data.url : res.data.embed_url || res.data.url
        if (targetUrl) {
          window.open(targetUrl, '_blank', 'noopener,noreferrer')
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo abrir el material.'
      toast.error(message)
    } finally {
      setOpeningId(null)
    }
  }

  if (sessionQuery.isLoading) {
    return <PublicVisitLoading />
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return <PublicVisitError />
  }

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      {/* Background Gradients */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,41,130,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(198,149,76,0.12),transparent_35%)]" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-700">
        <PublicVisitHeader 
          viewerType={viewerInfo.type}
          session={sessionQuery.data.session}
          materialCount={sessionQuery.data.material_count}
        />

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <PublicVisitSidebar 
            materials={sessionQuery.data.materials}
            activeMaterialId={activeMaterialId}
            openingId={openingId}
            onOpenMaterial={handleOpenMaterial}
          />

          <PublicVisitContentView 
            activeMaterial={activeMaterial}
            resource={resource}
          />
        </div>
      </div>
    </div>
  )
}
