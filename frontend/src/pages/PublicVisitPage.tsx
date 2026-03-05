import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, FileText, PlayCircle, Share2, Stethoscope } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import api from '@/services/api'
import { formatDateTime } from '@/lib/utils'
import { ApiResponse, MaterialResource, PublicMaterial, PublicVisitPayload } from '@/types'

function MaterialTypeBadge({ type }: { type: PublicMaterial['type'] }) {
  const config = {
    pdf: { label: 'PDF', variant: 'outline' as const, icon: FileText },
    video: { label: 'Video', variant: 'accent' as const, icon: PlayCircle },
    link: { label: 'Link', variant: 'warm' as const, icon: ExternalLink },
  }

  const current = config[type]
  const Icon = current.icon

  return (
    <Badge variant={current.variant} className="gap-2">
      <Icon className="h-3.5 w-3.5" />
      {current.label}
    </Badge>
  )
}

export default function PublicVisitPage() {
  const { token = '' } = useParams()
  const [activeMaterialId, setActiveMaterialId] = useState<number | null>(null)
  const [resource, setResource] = useState<MaterialResource | null>(null)
  const [openingId, setOpeningId] = useState<number | null>(null)

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

  const handleOpenMaterial = async (material: PublicMaterial) => {
    setOpeningId(material.id)

    try {
      await api.post(`/public/material/${material.id}/open`, {
        session_token: token,
        viewer_type: 'doctor',
      })

      if (material.type === 'pdf') {
        window.open(`/api/v1/public/material/${material.id}/resource?session_token=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer')
        setActiveMaterialId(material.id)
        setResource({ type: 'pdf' })
        return
      }

      const res = await api.get<ApiResponse<MaterialResource>>(
        `/public/material/${material.id}/resource?session_token=${encodeURIComponent(token)}`,
      )

      setActiveMaterialId(material.id)
      setResource(res.data)

      if (res.data.type === 'link' && res.data.url) {
        window.open(res.data.url, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo abrir el material.'
      toast.error(message)
    } finally {
      setOpeningId(null)
    }
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <Skeleton className="h-48 w-full" />
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <Skeleton className="h-[32rem] w-full" />
            <Skeleton className="h-[32rem] w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Badge variant="warm">Acceso publico</Badge>
            <CardTitle>Esta visita ya no esta disponible</CardTitle>
            <CardDescription>
              Revisa el enlace compartido por el visitador medico. Si el problema continua, solicita una nueva sesion.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
            <div>
              <Badge variant="accent">Acceso medico inmediato</Badge>
              <h1 className="mt-5 font-display text-4xl leading-tight text-foreground lg:text-5xl">
                {sessionQuery.data.session.doctor_name || 'Sesion medica'}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">
                Los materiales fueron preparados para esta visita. Puedes abrirlos sin iniciar sesion y el sistema registrara la interaccion base.
              </p>
            </div>

            <div className="rounded-[32px] border border-border/70 bg-background/80 p-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Stethoscope className="h-4 w-4 text-primary" />
                Sesion creada el {formatDateTime(sessionQuery.data.session.created_at)}
              </div>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                {sessionQuery.data.session.notes || 'No hay notas adicionales para esta sesion.'}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Badge variant="outline">{sessionQuery.data.material_count} materiales</Badge>
                <Badge variant="success">Trazabilidad activa</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Materiales de la visita</CardTitle>
              <CardDescription>Selecciona una pieza para abrirla o verla aqui mismo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessionQuery.data.materials.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-border bg-background/80 p-6 text-sm leading-7 text-muted-foreground">
                  Esta sesion no tiene materiales aprobados disponibles.
                </div>
              ) : (
                sessionQuery.data.materials.map(material => (
                  <div key={material.id} className="rounded-[28px] border border-border/70 bg-background/82 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <MaterialTypeBadge type={material.type} />
                      <Button
                        type="button"
                        variant={activeMaterialId === material.id ? 'secondary' : 'outline'}
                        onClick={() => handleOpenMaterial(material)}
                        loading={openingId === material.id}
                      >
                        Abrir material
                      </Button>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-foreground">{material.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {material.description || 'Material listo para ser presentado durante la visita.'}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vista activa</CardTitle>
              <CardDescription>El contenido se muestra aqui cuando aplica. PDFs y links tambien pueden abrirse en una nueva pestaña.</CardDescription>
            </CardHeader>
            <CardContent>
              {!activeMaterial && (
                <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-[28px] border border-dashed border-border bg-background/80 px-6 text-center">
                  <Share2 className="h-8 w-8 text-primary/70" />
                  <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground">
                    Elige un material del panel izquierdo para iniciar la experiencia de la visita.
                  </p>
                </div>
              )}

              {activeMaterial && resource?.type === 'pdf' && (
                <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-[28px] border border-border/70 bg-background/80 px-6 text-center">
                  <FileText className="h-10 w-10 text-primary" />
                  <h3 className="mt-5 text-xl font-semibold text-foreground">{activeMaterial.title}</h3>
                  <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                    El PDF se abrio en una nueva pestaña para lectura comoda durante la visita.
                  </p>
                </div>
              )}

              {activeMaterial && resource?.type === 'link' && (
                <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-[28px] border border-border/70 bg-background/80 px-6 text-center">
                  <ExternalLink className="h-10 w-10 text-primary" />
                  <h3 className="mt-5 text-xl font-semibold text-foreground">{activeMaterial.title}</h3>
                  <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                    El enlace externo se abrio en una nueva pestaña manteniendo el registro de apertura en la sesion.
                  </p>
                </div>
              )}

              {activeMaterial && resource?.type === 'video' && (
                <div className="space-y-4">
                  <div className="aspect-video overflow-hidden rounded-[28px] border border-border/70 bg-background/90">
                    <iframe
                      title={resource.title || activeMaterial.title}
                      src={resource.embed_url ?? resource.url}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="rounded-[24px] border border-border/70 bg-background/80 p-4">
                    <h3 className="text-lg font-semibold text-foreground">{resource.title || activeMaterial.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {resource.description || activeMaterial.description || 'Video listo para reproduccion embebida.'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
