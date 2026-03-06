import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  EmptyState,
  MetricGrid,
  PageIntro,
  PaginationBar,
  SearchToolbar,
  SegmentedControl,
  ToggleField,
  WorkPanel,
  Workspace,
} from '@/components/backoffice/Workbench'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getNullableNumberParam, getNumberParam, getStringParam, updateSearchParams } from '@/lib/search'
import { formatDateTime } from '@/lib/utils'
import {
  createOrgAdmin,
  createOrganization,
  listOrgAdmins,
  listOrganizations,
  updateOrgAdmin,
  updateOrganization,
} from '@/services/backoffice'
import { AdminUser, Organization } from '@/types/backoffice'
import { useSearchParams } from 'react-router-dom'

function LoadingState({ message }: { message: string }) {
  return <div className="rounded-3xl border border-border/80 bg-background/70 px-4 py-5 text-sm text-muted-foreground">{message}</div>
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-3xl border border-destructive/20 bg-destructive/5 px-4 py-5 text-sm text-destructive">{message}</div>
}

interface OrganizationFormState {
  name: string
  slug: string
  active: boolean
}

const emptyOrganizationForm: OrganizationFormState = {
  name: '',
  slug: '',
  active: true,
}

function OrganizationCard({ item, onEdit }: { item: Organization; onEdit: (organization: Organization) => void }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(item)}
      className="w-full rounded-[28px] border border-border/80 bg-background/75 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{item.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">/{item.slug}</p>
        </div>
        <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activa' : 'Inactiva'}</Badge>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">Actualizada {formatDateTime(item.updated_at)}</p>
    </button>
  )
}

export function SuperAdminOrganizationsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingOrganization, setEditingOrganization] = useState<Organization | null>(null)
  const [form, setForm] = useState<OrganizationFormState>(emptyOrganizationForm)

  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')

  const organizationsQuery = useQuery({
    queryKey: ['superadmin', 'organizations', q, page],
    queryFn: () => listOrganizations({ q, page }),
  })

  useEffect(() => {
    if (!editingOrganization) {
      setForm(emptyOrganizationForm)
      return
    }

    setForm({
      name: editingOrganization.name,
      slug: editingOrganization.slug,
      active: editingOrganization.active,
    })
  }, [editingOrganization])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingOrganization) {
        return updateOrganization(editingOrganization.id, form)
      }

      return createOrganization(form)
    },
    onSuccess: () => {
      toast.success(editingOrganization ? 'Organizacion actualizada.' : 'Organizacion creada.')
      setEditingOrganization(null)
      setForm(emptyOrganizationForm)
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'organizations'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la organizacion.'
      toast.error(message)
    },
  })

  const metrics = useMemo(() => {
    const result = organizationsQuery.data
    const items = result?.items ?? []
    const activeCount = items.filter(item => item.active).length

    return [
      { label: 'Clientes', value: result?.total ?? 0, detail: 'Organizaciones cargadas en el sistema.' },
      { label: 'Activas visibles', value: activeCount, detail: 'Cobertura operativa en la pagina actual.' },
      { label: 'Pagina', value: `${page}/${result?.last_page ?? 1}`, detail: 'Paginacion estable con filtros en URL.' },
      { label: 'Busqueda', value: q ? 'Filtrada' : 'Completa', detail: q ? `Consulta activa: ${q}` : 'Sin filtro de texto activo.' },
    ]
  }, [organizationsQuery.data, page, q])

  const handleSearchChange = (value: string) => {
    setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))
  }

  const handlePageChange = (nextPage: number) => {
    setSearchParams(current => updateSearchParams(current, { page: nextPage }))
  }

  const resetForm = () => {
    setEditingOrganization(null)
    setForm(emptyOrganizationForm)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <PageIntro
        eyebrow="Cobertura multi-organizacion"
        title="Organizaciones listas para crecer sin salir del tablero."
        description="La consola prioriza alta, edicion y estado operativo en una misma vista para que el super admin mantenga el mapa de clientes siempre visible."
        badge="Fase 9 operativa"
        actions={<Button type="button" variant="outline" onClick={resetForm}>Nueva organizacion</Button>}
      />

      <MetricGrid items={metrics} />

      <Workspace
        primary={(
          <WorkPanel title="Directorio de organizaciones" description="Cada tarjeta funciona como ficha viva del cliente y conserva filtros en la URL.">
            <SearchToolbar value={q} onChange={handleSearchChange} placeholder="Buscar por nombre o slug" />

            {organizationsQuery.isLoading && <LoadingState message="Cargando organizaciones..." />}
            {organizationsQuery.isError && <ErrorState message="No se pudo cargar la lista de organizaciones." />}

            {!organizationsQuery.isLoading && !organizationsQuery.isError && organizationsQuery.data?.items.length === 0 && (
              <EmptyState title="Sin resultados" description="Ajusta el filtro o crea la primera organizacion desde el panel lateral." />
            )}

            <div className="space-y-3">
              {organizationsQuery.data?.items.map(item => (
                <OrganizationCard key={item.id} item={item} onEdit={setEditingOrganization} />
              ))}
            </div>

            <PaginationBar
              page={organizationsQuery.data?.page ?? page}
              lastPage={organizationsQuery.data?.last_page ?? 1}
              total={organizationsQuery.data?.total ?? 0}
              onPageChange={handlePageChange}
            />
          </WorkPanel>
        )}
        secondary={(
          <WorkPanel
            title={editingOrganization ? 'Editar organizacion' : 'Crear organizacion'}
            description="Nombre, slug y estado quedan juntos para resolver alta o ajuste en pocos clics."
            aside={editingOrganization ? <Badge variant="warm">Edicion</Badge> : <Badge variant="outline">Alta</Badge>}
          >
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault()
                void saveMutation.mutateAsync()
              }}
            >
              <Input label="Nombre" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required />
              <Input
                label="Slug"
                value={form.slug}
                onChange={event => setForm(current => ({ ...current, slug: event.target.value }))}
                placeholder="Se genera automaticamente si lo dejas vacio"
              />
              <ToggleField
                checked={form.active}
                onChange={active => setForm(current => ({ ...current, active }))}
                label="Organizacion activa"
                hint="Define si el cliente queda habilitado para operar inmediatamente."
              />

              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={saveMutation.isPending}>{editingOrganization ? 'Guardar cambios' : 'Crear organizacion'}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Limpiar</Button>
              </div>
            </form>
          </WorkPanel>
        )}
      />
    </div>
  )
}

interface OrgAdminFormState {
  name: string
  email: string
  password: string
  organization_id: number | null
  active: boolean
}

const emptyOrgAdminForm: OrgAdminFormState = {
  name: '',
  email: '',
  password: '',
  organization_id: null,
  active: true,
}

function OrgAdminCard({ item, onEdit }: { item: AdminUser; onEdit: (user: AdminUser) => void }) {
  return (
    <button
      type="button"
      onClick={() => onEdit(item)}
      className="w-full rounded-[28px] border border-border/80 bg-background/75 p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{item.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.email}</p>
        </div>
        <Badge variant={item.active ? 'success' : 'outline'}>{item.active ? 'Activo' : 'Inactivo'}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{item.organization_name}</Badge>
        <span>Ultimo acceso {formatDateTime(item.last_login_at)}</span>
      </div>
    </button>
  )
}

export function SuperAdminOrgAdminsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
  const [form, setForm] = useState<OrgAdminFormState>(emptyOrgAdminForm)

  const q = getStringParam(searchParams, 'q')
  const page = getNumberParam(searchParams, 'page')
  const organizationId = getNullableNumberParam(searchParams, 'organization_id')

  const [orgAdminsQuery, organizationsQuery] = useQueries({
    queries: [
      {
        queryKey: ['superadmin', 'org-admins', q, page, organizationId],
        queryFn: () => listOrgAdmins({ q, page, organization_id: organizationId }),
      },
      {
        queryKey: ['superadmin', 'organizations', 'form-options'],
        queryFn: () => listOrganizations({ page: 1 }),
      },
    ],
  })

  useEffect(() => {
    if (!editingAdmin) {
      setForm(emptyOrgAdminForm)
      return
    }

    setForm({
      name: editingAdmin.name,
      email: editingAdmin.email,
      password: '',
      organization_id: editingAdmin.organization_id,
      active: editingAdmin.active,
    })
  }, [editingAdmin])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.organization_id) {
        throw new Error('Selecciona una organizacion.')
      }

      if (editingAdmin) {
        return updateOrgAdmin(editingAdmin.id, {
          name: form.name,
          email: form.email,
          password: form.password || undefined,
          organization_id: form.organization_id,
          active: form.active,
        })
      }

      return createOrgAdmin({
        name: form.name,
        email: form.email,
        password: form.password,
        organization_id: form.organization_id,
        active: form.active,
      })
    },
    onSuccess: () => {
      toast.success(editingAdmin ? 'Admin de organizacion actualizado.' : 'Admin de organizacion creado.')
      setEditingAdmin(null)
      setForm(emptyOrgAdminForm)
      void queryClient.invalidateQueries({ queryKey: ['superadmin', 'org-admins'] })
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el administrador.'
      toast.error(message)
    },
  })

  const metrics = useMemo(() => {
    const items = orgAdminsQuery.data?.items ?? []
    const uniqueOrganizations = new Set(items.map(item => item.organization_id)).size

    return [
      { label: 'Admins visibles', value: orgAdminsQuery.data?.total ?? 0, detail: 'Responsables de organizacion registrados.' },
      { label: 'Cobertura visible', value: uniqueOrganizations, detail: 'Organizaciones representadas en la pagina actual.' },
      { label: 'Filtro org', value: organizationId ? `#${organizationId}` : 'Todas', detail: 'Scope compartible desde la URL.' },
      { label: 'Accesos activos', value: items.filter(item => item.active).length, detail: 'Estado operativo visible en la lista actual.' },
    ]
  }, [orgAdminsQuery.data, organizationId])

  const handlePageChange = (nextPage: number) => {
    setSearchParams(current => updateSearchParams(current, { page: nextPage }))
  }

  const resetForm = () => {
    setEditingAdmin(null)
    setForm(emptyOrgAdminForm)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <PageIntro
        eyebrow="Responsables por cliente"
        title="Admins de organizacion alineados con su cliente desde una sola mesa."
        description="La vista cruza busqueda, organizacion y alta rapida para mantener la jerarquia Super Admin -> Org Admin siempre ordenada."
        badge="Gobernanza interna"
        actions={<Button type="button" variant="outline" onClick={resetForm}>Nuevo admin</Button>}
      />

      <MetricGrid items={metrics} />

      <Workspace
        primary={(
          <WorkPanel title="Roster de admins" description="Cada registro deja visible su organizacion y ultimo acceso para detectar cobertura o huecos rapidamente.">
            <SearchToolbar
              value={q}
              onChange={value => setSearchParams(current => updateSearchParams(current, { q: value || null, page: 1 }))}
              placeholder="Buscar por nombre o correo"
              extra={(
                <SegmentedControl
                  value={organizationId ? String(organizationId) : 'all'}
                  onChange={value => setSearchParams(current => updateSearchParams(current, { organization_id: value === 'all' ? null : Number(value), page: 1 }))}
                  options={[
                    { label: 'Todas', value: 'all' },
                    ...(organizationsQuery.data?.items ?? []).map(item => ({ label: item.name, value: String(item.id) })),
                  ]}
                />
              )}
            />

            {orgAdminsQuery.isLoading && <LoadingState message="Cargando administradores..." />}
            {orgAdminsQuery.isError && <ErrorState message="No se pudo cargar la lista de administradores." />}

            {!orgAdminsQuery.isLoading && !orgAdminsQuery.isError && orgAdminsQuery.data?.items.length === 0 && (
              <EmptyState title="Sin administradores" description="Crea el primer responsable o ajusta los filtros aplicados." />
            )}

            <div className="space-y-3">
              {orgAdminsQuery.data?.items.map(item => (
                <OrgAdminCard key={item.id} item={item} onEdit={setEditingAdmin} />
              ))}
            </div>

            <PaginationBar
              page={orgAdminsQuery.data?.page ?? page}
              lastPage={orgAdminsQuery.data?.last_page ?? 1}
              total={orgAdminsQuery.data?.total ?? 0}
              onPageChange={handlePageChange}
            />
          </WorkPanel>
        )}
        secondary={(
          <WorkPanel
            title={editingAdmin ? 'Editar admin de organizacion' : 'Crear admin de organizacion'}
            description="La asignacion a cliente queda dentro del mismo panel para evitar pasos extra."
            aside={editingAdmin ? <Badge variant="warm">Edicion</Badge> : <Badge variant="outline">Alta</Badge>}
          >
            <form
              className="space-y-4"
              onSubmit={event => {
                event.preventDefault()
                void saveMutation.mutateAsync()
              }}
            >
              <Input label="Nombre" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required />
              <Input label="Correo" type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required />
              <Input
                label={editingAdmin ? 'Nueva contrasena (opcional)' : 'Contrasena'}
                type="password"
                value={form.password}
                onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                required={!editingAdmin}
              />
              <SegmentedControl
                value={form.organization_id ? String(form.organization_id) : 'none'}
                onChange={value => setForm(current => ({ ...current, organization_id: value === 'none' ? null : Number(value) }))}
                options={[
                  { label: 'Selecciona cliente', value: 'none' },
                  ...(organizationsQuery.data?.items ?? []).map(item => ({ label: item.name, value: String(item.id) })),
                ]}
              />
              <ToggleField
                checked={form.active}
                onChange={active => setForm(current => ({ ...current, active }))}
                label="Acceso habilitado"
                hint="El admin queda disponible para entrar y gestionar su organizacion."
              />

              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={saveMutation.isPending}>{editingAdmin ? 'Guardar cambios' : 'Crear admin'}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Limpiar</Button>
              </div>
            </form>
          </WorkPanel>
        )}
      />
    </div>
  )
}

export function SuperAdminMetricsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const organizationId = getNullableNumberParam(searchParams, 'organization_id')

  const [organizationsQuery, orgAdminsQuery] = useQueries({
    queries: [
      {
        queryKey: ['superadmin', 'metrics', 'organizations'],
        queryFn: () => listOrganizations({ page: 1 }),
      },
      {
        queryKey: ['superadmin', 'metrics', 'org-admins', organizationId],
        queryFn: () => listOrgAdmins({ page: 1, organization_id: organizationId }),
      },
    ],
  })

  const organizationMap = useMemo(() => {
    const counts = new Map<number, number>()

    ;(orgAdminsQuery.data?.items ?? []).forEach(item => {
      counts.set(item.organization_id, (counts.get(item.organization_id) ?? 0) + 1)
    })

    return counts
  }, [orgAdminsQuery.data])

  const metrics = useMemo(() => {
    const organizations = organizationsQuery.data?.items ?? []
    const coveredOrganizations = organizations.filter(item => (organizationMap.get(item.id) ?? 0) > 0).length

    return [
      { label: 'Organizaciones', value: organizationsQuery.data?.total ?? 0, detail: 'Clientes visibles en el tablero global.' },
      { label: 'Admins de org', value: orgAdminsQuery.data?.total ?? 0, detail: 'Responsables registrados en el filtro actual.' },
      { label: 'Cobertura', value: coveredOrganizations, detail: 'Organizaciones visibles con al menos un admin asignado.' },
      { label: 'Foco', value: organizationId ? `Org #${organizationId}` : 'Global', detail: 'Scope persistido como query param.' },
    ]
  }, [organizationId, organizationMap, orgAdminsQuery.data, organizationsQuery.data])

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <PageIntro
        eyebrow="Senales globales"
        title="Una lectura rapida del mapa operativo antes de abrir cada cliente."
        description="Esta vista resume cobertura de organizaciones y responsables con datos ya disponibles en la plataforma, sin adelantar los dashboards de consumo de la Fase 11."
        badge="Vista ejecutiva"
      />

      <MetricGrid items={metrics} />

      <Workspace
        primary={(
          <WorkPanel title="Cobertura por organizacion" description="Cada fila deja ver si el cliente ya tiene responsable asignado y cuando fue movido por ultima vez.">
            <SegmentedControl
              value={organizationId ? String(organizationId) : 'all'}
              onChange={value => setSearchParams(current => updateSearchParams(current, { organization_id: value === 'all' ? null : Number(value) }))}
              options={[
                { label: 'Vista global', value: 'all' },
                ...(organizationsQuery.data?.items ?? []).map(item => ({ label: item.name, value: String(item.id) })),
              ]}
            />

            {organizationsQuery.isLoading && <LoadingState message="Cargando mapa de organizaciones..." />}
            {organizationsQuery.isError && <ErrorState message="No se pudo cargar el panorama global." />}

            <div className="space-y-3">
              {(organizationsQuery.data?.items ?? []).map(item => {
                const adminCount = organizationMap.get(item.id) ?? 0

                return (
                  <div key={item.id} className="rounded-[28px] border border-border/80 bg-background/75 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{item.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Slug {item.slug}</p>
                      </div>
                      <Badge variant={adminCount > 0 ? 'success' : 'warm'}>{adminCount > 0 ? `${adminCount} admin` : 'Sin admin'}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={item.active ? 'outline' : 'warm'}>{item.active ? 'Cliente activo' : 'Cliente pausado'}</Badge>
                      <span>Movimiento {formatDateTime(item.updated_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </WorkPanel>
        )}
        secondary={(
          <WorkPanel title="Lectura operativa" description="Senales utiles para detectar rapido huecos de setup antes de pasar a la gestion puntual.">
            {orgAdminsQuery.isLoading && <LoadingState message="Calculando senales..." />}
            {orgAdminsQuery.isError && <ErrorState message="No se pudieron preparar las senales operativas." />}

            {!orgAdminsQuery.isLoading && !orgAdminsQuery.isError && (
              <div className="space-y-3">
                <div className="rounded-3xl border border-border/80 bg-background/75 p-4">
                  <div className="flex items-center gap-3 text-foreground">
                    <Building2 className="h-4 w-4 text-primary" />
                    <p className="font-semibold">Clientes visibles</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {organizationsQuery.data?.items.length ?? 0} organizaciones en el radar inmediato del super admin.
                  </p>
                </div>

                <div className="rounded-3xl border border-border/80 bg-background/75 p-4">
                  <div className="flex items-center gap-3 text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="font-semibold">Cobertura administrativa</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {(orgAdminsQuery.data?.items ?? []).filter(item => item.active).length} administradores activos visibles para responder sobre clientes.
                  </p>
                </div>

                <div className="rounded-3xl border border-border/80 bg-background/75 p-4 text-sm leading-6 text-muted-foreground">
                  Esta vista usa datos operativos existentes. Las metricas de adopcion y consumo de contenido se reservan para la Fase 11, como pide el plan.
                </div>
              </div>
            )}
          </WorkPanel>
        )}
      />
    </div>
  )
}
