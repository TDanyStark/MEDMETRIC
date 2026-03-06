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
        const pdfUrl = `/api/v1/public/material/${material.id}/resource?session_token=${encodeURIComponent(token)}`
        setActiveMaterialId(material.id)
        setResource({ type: 'pdf', url: pdfUrl })
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
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      {/* Background Gradients */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,41,130,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(198,149,76,0.12),transparent_35%)]" />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-700">
        {/* Header Session Card */}
        <Card className="overflow-hidden border-none bg-background/60 shadow-xl shadow-purple-500/5 backdrop-blur-xl ring-1 ring-border/50">
          <CardContent className="grid gap-8 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div className="flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground ring-1 ring-accent/20">
                <Stethoscope className="h-3 w-3" />
                Acceso medico inmediato
              </div>
              <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-foreground lg:text-6xl">
                {sessionQuery.data?.session.doctor_name || 'Sesion medica'}
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground/80">
                Explora el contenido cientifico preparado especificamente para esta consulta medica.
              </p>
            </div>

            <div className="relative flex flex-col justify-between rounded-3xl border border-border/40 bg-card/40 p-8 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground/60 uppercase tracking-widest">
                  Sesion creada {formatDateTime(sessionQuery.data?.session.created_at ?? '')}
                </div>
                {sessionQuery.data?.session.notes ? (
                  <p className="text-sm leading-relaxed text-muted-foreground italic">
                    "{sessionQuery.data.session.notes}"
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/40">Sin notas adicionales para esta sesion.</p>
                )}
              </div>
              <div className="mt-8 flex items-center gap-3">
                <Badge variant="outline" className="rounded-full px-4 py-1.5 bg-background shadow-sm border-border/50">
                  {sessionQuery.data?.material_count} materiales seleccionados
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          {/* List Side */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">Materiales de la visita</h2>
            </div>
            
            <div className="space-y-4">
              {sessionQuery.data?.materials && sessionQuery.data.materials.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-border bg-background p-6 text-sm leading-7 text-muted-foreground">
                  Esta sesion no tiene materiales aprobados disponibles.
                </div>
              ) : (
                sessionQuery.data?.materials.map(material => (
                  <div 
                    key={material.id} 
                    className="group relative cursor-pointer overflow-hidden rounded-[28px] border border-border bg-background transition-all hover:border-primary/50 hover:shadow-sm"
                    onClick={() => handleOpenMaterial(material)}
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* Cover Image Side */}
                      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-muted sm:h-auto sm:w-32">
                        {material.cover_path ? (
                          <img 
                            src={`/api/v1/public/material/${material.id}/cover`} 
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                            alt={material.title} 
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center opacity-20">
                             <FileText className="h-8 w-8" />
                          </div>
                        )}
                      </div>

                      {/* Content Side */}
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <MaterialTypeBadge type={material.type} />
                          <Button
                            type="button"
                            size="sm"
                            variant={activeMaterialId === material.id ? 'secondary' : 'outline'}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenMaterial(material);
                            }}
                            loading={openingId === material.id}
                          >
                            Abrir material
                          </Button>
                        </div>
                        <h2 className="mt-4 text-base font-semibold text-foreground">{material.title}</h2>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {material.description || 'Material listo para la visita.'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active View Side */}
          <div className="relative">
            <div className="sticky top-8 space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Vista activa</h2>
              </div>

              {!activeMaterial && (
                <div className="flex min-h-[500px] flex-col items-center justify-center rounded-[40px] border border-dashed border-border bg-background/40 backdrop-blur-sm px-10 text-center transition-all duration-500">
                  <div className="rounded-full bg-primary/5 p-8 mb-6 ring-1 ring-primary/20">
                    <Share2 className="h-10 w-10 text-primary animate-pulse" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">Listo para comenzar</h3>
                  <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground/70">
                    Selecciona un material de la lista izquierda para iniciar la experiencia interactiva de la visita médica.
                  </p>
                </div>
              )}

              {activeMaterial && resource?.type === 'pdf' && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="aspect-video overflow-hidden rounded-[40px] border border-border bg-muted shadow-2xl">
                    <iframe
                      title={activeMaterial.title}
                      src={`${resource.url}#toolbar=0`}
                      className="h-full w-full"
                    />
                  </div>
                  <Card className="rounded-[32px] border-none bg-background/40 backdrop-blur-md">
                    <CardContent className="p-8">
                       <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-2xl font-bold text-foreground">{activeMaterial.title}</h3>
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {activeMaterial.description || 'Documento disponible para visualizar.'}
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
              )}

              {activeMaterial && resource?.type === 'link' && (
                <div className="flex min-h-[500px] flex-col items-center justify-center rounded-[40px] border border-border bg-background shadow-2xl shadow-purple-500/5 px-10 text-center animate-in zoom-in-95 duration-500">
                  <div className="rounded-full bg-amber-500/10 p-8 mb-6 ring-1 ring-amber-500/20">
                    <ExternalLink className="h-12 w-12 text-amber-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">{activeMaterial.title}</h3>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
                    El enlace externo se ha abierto en una ventana independiente manteniendo su sesión activa.
                  </p>
                </div>
              )}

              {activeMaterial && resource?.type === 'video' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="aspect-video overflow-hidden rounded-[40px] border border-border bg-black shadow-2xl">
                    <iframe
                      title={resource?.title || activeMaterial?.title}
                      src={resource?.embed_url ?? resource?.url}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <Card className="rounded-[32px] border-none bg-background/40 backdrop-blur-md">
                    <CardContent className="p-8">
                      <h3 className="text-2xl font-bold text-foreground">{resource?.title || activeMaterial?.title}</h3>
                      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                        {resource?.description || activeMaterial?.description || 'Contenido audiovisual disponible.'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
