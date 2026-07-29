import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import api from '@/services/api'
import { getPublicComments } from '@/services/comments'
import { ApiResponse, PublicMaterial, PublicStudy, PublicVisitPayload } from '@/types'

// Sub-components
import { PublicVisitLoading } from './components/PublicVisitLoading'
import { PublicVisitError } from './components/PublicVisitError'
import { PublicVisitHeader } from './components/PublicVisitHeader'
import { PublicVisitSidebar } from './components/PublicVisitSidebar'
import { PublicCommentDialog } from './components/PublicCommentDialog'
import { PublicOwnComments } from './components/PublicOwnComments'
import { RepCommentDialog } from './components/RepCommentDialog'

export default function PublicVisitPage() {
  const { token = '' } = useParams()
  
  const viewerInfo = useMemo(() => {
    try {
      const authUserStr = localStorage.getItem('auth_user')
      if (authUserStr) {
        const user = JSON.parse(authUserStr)
        if (user && user.role) {
          // If we have a rep session, we are ALWAYS a rep, even if the URL says otherwise.
          // This ensures metric integrity for the representative's PC.
          return { type: 'rep' as const }
        }
      }
    } catch(e) {
      // Ignore
    }
    
    // Only use 'doctor' if we are not logged in, but check if the URL explicitly says 'doctor' 
    // or if it's the default (if not logged in, it's always doctor or public)
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

  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [isRepComposerOpen, setIsRepComposerOpen] = useState(false)

  const ownCommentsQuery = useQuery({
    queryKey: ['public-comments', token],
    enabled: Boolean(token) && viewerInfo.type === 'doctor',
    queryFn: () => getPublicComments(token),
  })

  const getMaterialHref = (material: PublicMaterial) => {
    const baseUrl = `/api/v1/public/material/${material.id}/resource`
    const params = new URLSearchParams({
      session_token: token,
      viewer_type: viewerInfo.type
    })
    
    return `${baseUrl}?${params.toString()}`
  }

  const getStudyHref = (study: PublicStudy) => {
    const baseUrl = `/api/v1/public/study/${study.id}/resource`
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
      viewer_type: 'doctor',
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
          onOpenComposer={viewerInfo.type === 'doctor' ? () => setIsComposerOpen(true) : undefined}
          onOpenRepComposer={viewerInfo.type === 'rep' ? () => setIsRepComposerOpen(true) : undefined}
        />

        <PublicVisitSidebar 
          materials={sessionQuery.data.materials}
          activeMaterialId={null}
          getHref={getMaterialHref}
          isModeVisitador={viewerInfo.type === 'rep'}
          session={sessionQuery.data.session}
          getShareUrl={getShareUrl}
          getStudyHref={getStudyHref}
        />

        {viewerInfo.type === 'doctor' && (
          <PublicOwnComments
            comments={ownCommentsQuery.data ?? []}
            isLoading={ownCommentsQuery.isLoading}
            isError={ownCommentsQuery.isError}
            organizationTimezone={sessionQuery.data.session.organization_timezone}
          />
        )}
      </div>

      {viewerInfo.type === 'doctor' && (
        <PublicCommentDialog
          open={isComposerOpen}
          onOpenChange={setIsComposerOpen}
          token={token}
          materials={sessionQuery.data.materials}
        />
      )}

      {viewerInfo.type === 'rep' && (
        <RepCommentDialog
          open={isRepComposerOpen}
          onOpenChange={setIsRepComposerOpen}
          session={sessionQuery.data.session}
          materials={sessionQuery.data.materials}
        />
      )}
    </div>
  )
}
