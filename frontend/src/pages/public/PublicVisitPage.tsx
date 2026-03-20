import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import api from '@/services/api'
import { ApiResponse, PublicMaterial, PublicVisitPayload } from '@/types'

// Sub-components
import { PublicVisitLoading } from './components/PublicVisitLoading'
import { PublicVisitError } from './components/PublicVisitError'
import { PublicVisitHeader } from './components/PublicVisitHeader'
import { PublicVisitSidebar } from './components/PublicVisitSidebar'

export default function PublicVisitPage() {
  const { token = '' } = useParams()
  
  const viewerInfo = useMemo(() => {
    try {
      const authUserStr = localStorage.getItem('auth_user')
      if (authUserStr) {
        const user = JSON.parse(authUserStr)
        if (user && user.role) {
          return { type: 'rep' as const }
        }
      }
    } catch(e) {
      // Ignore
    }
    return { type: 'doctor' as const }
  }, [])

  const sessionQuery = useQuery({
    queryKey: ['public-visit', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const res = await api.get<ApiResponse<PublicVisitPayload>>(`/public/session/${token}`)
      return res.data
    },
  })

  const getMaterialHref = (material: PublicMaterial) => {
    const baseUrl = `/api/v1/public/material/${material.id}/resource`
    const params = new URLSearchParams({
      session_token: token,
      viewer_type: viewerInfo.type
    })
    
    return `${baseUrl}?${params.toString()}`
  }

  const getShareUrl = (material: PublicMaterial) => {
    const baseUrl = `/api/v1/public/material/${material.id}/resource`
    const params = new URLSearchParams({
      session_token: token,
      viewer_type: 'doctor'
    })
    
    return `${window.location.origin}${baseUrl}?${params.toString()}`
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

        <PublicVisitSidebar 
          materials={sessionQuery.data.materials}
          activeMaterialId={null}
          getHref={getMaterialHref}
          isModeVisitador={viewerInfo.type === 'rep'}
          getShareUrl={getShareUrl}
        />
      </div>
    </div>
  )
}
