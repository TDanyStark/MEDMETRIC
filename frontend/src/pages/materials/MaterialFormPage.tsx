import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Info, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { SegmentedControl } from '@/components/backoffice/Workbench'
import { StudiesSection } from '@/components/backoffice/StudiesSection'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useAuth } from '@/contexts/useAuth'
import { useDidDepsChange } from '@/hooks/useDidDepsChange'
import { buildPendingStudyFormData } from '@/lib/pendingStudies'
import { routePath } from '@/lib/routes'
import type { Role } from '@/types'
import {
  Brand,
  ManagerOption,
  Material,
  MaterialStudy,
  MaterialType,
  PaginatedData,
  PendingStudy,
} from '@/types/backoffice'
import {
  createManagerMaterial,
  createManagerMaterialStudy,
  createOrgMaterial,
  createOrgMaterialStudy,
  deleteManagerMaterialStudy,
  deleteOrgMaterialStudy,
  getOrgBrandManagers,
  getManagerMaterial,
  getOrgMaterial,
  listManagerBrands,
  listManagerMaterialStudies,
  listOrgBrands,
  listOrgMaterialStudies,
  updateManagerMaterial,
  updateManagerMaterialStudy,
  updateOrgMaterial,
  updateOrgMaterialStudy,
} from '@/services/backoffice'

import { LoadingState } from '../org-admin/components/LoadingState'
import { ErrorState } from '../org-admin/components/ErrorState'

export type MaterialFormScope = 'org-admin' | 'manager'

/**
 * `/materials/new` and `/materials/:id/edit` are a single mount point for
 * both `org_admin` and `manager` (route-role-prefix-removal, Fase 4) — no
 * more `scope="org-admin"` / `scope="manager"` prop fixed per route.
 * `ProtectedRoute` already restricts this route to `['org_admin','manager']`
 * before this component ever mounts, so `role` here is always one of those
 * two in practice. `null` is still handled explicitly (never silently
 * defaults to a scope the user isn't) for the same "no ambient authority"
 * reason as the `/metrics`, `/brands`, `/materials` dispatchers.
 */
function scopeFromRole(role: Role | undefined): MaterialFormScope | null {
  if (role === 'org_admin') return 'org-admin'
  if (role === 'manager') return 'manager'
  return null
}

interface MaterialFormState {
  title: string
  description: string
  brand_id: number | null
  manager_id: number | null
  type: MaterialType
  external_url: string
  file: File | null
  cover_file: File | null
}

const emptyForm: MaterialFormState = {
  title: '',
  description: '',
  brand_id: null,
  manager_id: null,
  type: 'pdf',
  external_url: '',
  file: null,
  cover_file: null,
}

interface ScopeConfig {
  getMaterial: (id: number) => Promise<Material>
  createMaterial: (payload: FormData) => Promise<Material>
  updateMaterial: (id: number, payload: FormData) => Promise<Material>
  listBrands: () => Promise<PaginatedData<Brand>>
  listStudies: (materialId: number) => Promise<PaginatedData<MaterialStudy>>
  createStudy: (materialId: number, payload: FormData) => Promise<MaterialStudy>
  updateStudy: (studyId: number, payload: FormData) => Promise<MaterialStudy>
  deleteStudy: (studyId: number) => Promise<{ message: string }>
  /** org-admin only: conditional manager selector w/ needs_selection/needs_sync auto-assign logic. */
  showManagerField: boolean
  /** org-admin only: append manager_id to the payload when set. */
  appendsManagerId: boolean
  /** org-admin: searchable, rich label (manager count). manager: plain name, no search. */
  brandSearchable: boolean
  /** manager only: material.status === 'approved' locks the form (backend already 422s this — UX nicety). */
  lockApprovedEdit: boolean
}

// `/materials` and `/materials/:id/edit` are the SAME neutral path for both
// scopes now (route-role-prefix-removal, Fase 4) — no more per-scope
// `backListPath`/`editPathPrefix` literals; navigation uses `routePath()`
// directly (see `handleBackToList`/`saveMutation.onSuccess` below).

// Role differences are resolved here, ONCE, instead of scattered
// `if (scope === ...)` branches throughout the JSX/handlers below.
const SCOPE_CONFIG: Record<MaterialFormScope, ScopeConfig> = {
  'org-admin': {
    getMaterial: getOrgMaterial,
    createMaterial: createOrgMaterial,
    updateMaterial: updateOrgMaterial,
    listBrands: () => listOrgBrands({ all: true }),
    listStudies: listOrgMaterialStudies,
    createStudy: createOrgMaterialStudy,
    updateStudy: updateOrgMaterialStudy,
    deleteStudy: deleteOrgMaterialStudy,
    showManagerField: true,
    appendsManagerId: true,
    brandSearchable: true,
    lockApprovedEdit: false,
  },
  manager: {
    getMaterial: getManagerMaterial,
    createMaterial: createManagerMaterial,
    updateMaterial: updateManagerMaterial,
    listBrands: () => listManagerBrands({ page: 1 }),
    listStudies: listManagerMaterialStudies,
    createStudy: createManagerMaterialStudy,
    updateStudy: updateManagerMaterialStudy,
    deleteStudy: deleteManagerMaterialStudy,
    showManagerField: false,
    appendsManagerId: false,
    brandSearchable: false,
    lockApprovedEdit: true,
  },
}

export function MaterialFormPage() {
  const { user } = useAuth()
  const scope = scopeFromRole(user?.role)
  // Fallback to 'manager' (the more restrictive scope) ONLY to keep the
  // Hooks call order stable when `scope` is null — every hook below still
  // runs (React requires it), but the queries are `enabled: scope !== null`
  // so nothing actually fetches. The real guard is the `if (!scope) return
  // null` further down, after all hooks. In practice `scope` is never null
  // here: `ProtectedRoute` already restricts this route to
  // `['org_admin','manager']` before this component mounts.
  const cfg = SCOPE_CONFIG[scope ?? 'manager']
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams<{ id?: string }>()
  const materialId = params.id ? Number(params.id) : null
  const isEditing = materialId !== null

  const [form, setForm] = useState<MaterialFormState>(emptyForm)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Studies added while the material doesn't exist yet (create flow). Flushed
  // sequentially against the real material_id once creation succeeds.
  const [pendingStudies, setPendingStudies] = useState<PendingStudy[]>([])
  // Stable per "create attempt" key: reused across retries on this page
  // instance so the backend can recognize a resubmission and avoid creating
  // a duplicate material (see idempotency_key handling in CreateMaterialAction).
  const createIdempotencyKeyRef = useRef<string>(crypto.randomUUID())

  const brandsQuery = useQuery({
    queryKey: [scope, 'brands', 'material-form'],
    queryFn: cfg.listBrands,
    enabled: scope !== null,
  })

  const materialQuery = useQuery({
    queryKey: [scope, 'materials', materialId, 'detail'],
    queryFn: () => cfg.getMaterial(materialId!),
    enabled: isEditing && scope !== null,
  })

  // Wrapped in useMemo per exhaustive-deps: without it, `?? []` mints a new
  // array reference every render, which would make useDidDepsChange below
  // (and any effect depending on `brands`) fire on every render.
  const brands = useMemo(() => brandsQuery.data?.items ?? [], [brandsQuery.data])
  const material = materialQuery.data

  const isLocked = cfg.lockApprovedEdit && isEditing && material?.status === 'approved'

  // Edit mode: hydrate the form from the fetched material. Adjusted during
  // render, not in an effect — this page stays mounted while the query
  // resolves, and it must also hydrate on the very first render when the
  // material comes straight out of the TanStack cache (warm revisit).
  // Keyed on `material` alone on purpose: `brands` resolving in parallel
  // must NOT re-run this, or it would wipe whatever the user already typed.
  if (useDidDepsChange([material]) && isEditing && material) {
    setForm({
      title: material.title,
      description: material.description ?? '',
      brand_id: material.brand_id,
      manager_id: material.manager_id,
      type: material.type,
      external_url: material.external_url ?? '',
      file: null,
      cover_file: null,
    })
  }

  // Create mode: preselect a default brand once the brand list loads, only
  // if the user hasn't picked one yet.
  if (useDidDepsChange([brands]) && !isEditing) {
    setForm((current) => ({ ...current, brand_id: current.brand_id ?? brands[0]?.id ?? null }))
  }

  // Genuine effect: creates a browser object URL (external resource) that
  // must be revoked on cleanup — not derivable during render.
  useEffect(() => {
    if (form.cover_file) {
      const url = URL.createObjectURL(form.cover_file)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pairs an external resource (createObjectURL) with its cleanup (revokeObjectURL); the setState here is not extractable to render.
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [form.cover_file])

  // Brand managers (org-admin only, and only relevant when creating)
  const brandManagersQuery = useQuery({
    queryKey: ['org-admin', 'brand-managers', form.brand_id],
    queryFn: () => getOrgBrandManagers(form.brand_id!),
    enabled: cfg.showManagerField && !isEditing && !!form.brand_id && scope !== null,
  })

  const brandManagers = brandManagersQuery.data
  const needsManagerSelection =
    cfg.showManagerField && !isEditing && brandManagers?.needs_selection === true
  const needsSync = brandManagers?.needs_sync === true
  const managerOptions: ManagerOption[] = needsSync
    ? brandManagers?.org_managers ?? []
    : brandManagers?.brand_managers ?? []

  // Reset manager when brand changes (create flow, org-admin only).
  // Adjusted during render, not in an effect.
  if (useDidDepsChange([form.brand_id, isEditing, cfg.showManagerField]) && cfg.showManagerField && !isEditing) {
    setForm((current) => ({ ...current, manager_id: null }))
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = new FormData()
      payload.append('title', form.title)
      payload.append('description', form.description)
      payload.append('brand_id', String(form.brand_id ?? ''))
      if (cfg.appendsManagerId && form.manager_id) payload.append('manager_id', String(form.manager_id))
      if (!isEditing) payload.append('type', form.type)
      if (form.type === 'pdf' && form.file) {
        payload.append('file', form.file)
      } else if (form.type !== 'pdf') {
        payload.append('external_url', form.external_url)
      }
      if (form.cover_file) payload.append('cover_image', form.cover_file)
      if (!isEditing) payload.append('idempotency_key', createIdempotencyKeyRef.current)

      return isEditing ? cfg.updateMaterial(materialId!, payload) : cfg.createMaterial(payload)
    },
    onSuccess: async (savedMaterial) => {
      void queryClient.invalidateQueries({ queryKey: [scope, 'materials'] })
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'brand-managers'] })

      if (!isEditing && pendingStudies.length > 0) {
        const failedTitles: string[] = []

        // Sequential on purpose: keeps error attribution per-study and avoids
        // firing N simultaneous PDF-compression spawns on the backend.
        for (const study of pendingStudies) {
          try {
            await cfg.createStudy(savedMaterial.id, buildPendingStudyFormData(study))
          } catch {
            failedTitles.push(study.title)
          }
        }

        if (failedTitles.length === 0) {
          toast.success(`Material creado con ${pendingStudies.length} estudio(s) agregado(s).`)
          navigate(routePath('/materials'))
          return
        }

        toast.warning(
          `Material creado, pero no se pudo agregar: ${failedTitles.join(', ')}. Puedes reintentar desde la sección Estudios.`,
        )
        navigate(routePath('/materials/:id/edit', { id: savedMaterial.id }))
        return
      }

      toast.success(isEditing ? 'Material actualizado.' : 'Material creado.')
      navigate(routePath('/materials'))
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar.'
      toast.error(message)
    },
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (isLocked) return
    if (!form.brand_id) return
    if (needsManagerSelection && !form.manager_id) return
    void saveMutation.mutateAsync()
  }

  const effectiveType = isEditing ? material?.type ?? form.type : form.type

  const currentCoverUrl = form.cover_file
    ? previewUrl
    : material?.cover_url ||
      (material?.cover_path ? `/api/v1/public/material/${material.id}/cover` : null)

  if (!scope) {
    return null
  }

  if (isEditing && materialQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingState message="Cargando material..." />
      </div>
    )
  }

  if (isEditing && materialQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <ErrorState message="No se pudo cargar el material." />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => navigate(routePath('/materials'))}
          className="flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a materiales
        </button>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
          {isEditing ? 'Editar Material' : 'Nuevo Material'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isEditing
            ? 'Actualiza los datos del material.'
            : 'Crea un material y asígnalo a una marca de la organización.'}
        </p>
      </div>

      {isLocked && (
        <div className="flex items-start gap-2 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Este material ya fue aprobado y no puede editarse.</span>
        </div>
      )}

      <fieldset disabled={isLocked} className="contents">
        <form
          className="flex flex-col gap-6 rounded-3xl border border-border/50 bg-background/50 p-6 shadow-sm sm:p-8"
          onSubmit={handleSubmit}
        >
          <Input
            label="Título"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />

          <Textarea
            label="Descripción"
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
          />

          <CustomSelect
            label="Marca"
            placeholder={cfg.brandSearchable ? 'Busca y selecciona una marca' : 'Selecciona una marca'}
            value={brands.find((b) => b.id === form.brand_id) ?? null}
            onChange={(option) => {
              if (option) {
                setForm((current) => ({ ...current, brand_id: (option as Brand).id }))
              }
            }}
            options={brands}
            isLoading={brandsQuery.isLoading}
            isDisabled={isLocked}
            getOptionLabel={(option) => {
              const brand = option as Brand
              if (!cfg.brandSearchable) return brand.name
              const count = brand.managers?.length ?? 0
              if (count === 0) return `${brand.name} · sin gerente`
              if (count === 1) return `${brand.name} · ${brand.managers![0].name}`
              return `${brand.name} · ${count} gerentes`
            }}
            getOptionValue={(option) => String((option as Brand).id)}
            isSearchable={cfg.brandSearchable}
            required
          />

          {needsManagerSelection && (
            <div className="space-y-2">
              <CustomSelect
                label="Gerente responsable"
                placeholder="Selecciona un gerente"
                value={managerOptions.find((m) => m.id === form.manager_id) ?? null}
                onChange={(option) =>
                  setForm((current) => ({
                    ...current,
                    manager_id: option ? (option as ManagerOption).id : null,
                  }))
                }
                options={managerOptions}
                getOptionLabel={(option) => (option as ManagerOption).name}
                getOptionValue={(option) => String((option as ManagerOption).id)}
                isLoading={brandManagersQuery.isLoading}
                required
              />
              {needsSync && (
                <div className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-primary">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Esta marca aún no tiene gerente. Se vinculará al gerente seleccionado con este
                    primer material.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
            <div className="mb-2 flex items-end justify-between">
              <label className="block text-sm font-semibold text-foreground">Banner para el Feed</label>
              <span className="rounded-full border border-primary/10 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
                1200 x 675px
              </span>
            </div>
            <div className="flex items-center gap-4">
              {currentCoverUrl && (
                <div className="relative aspect-video w-28 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-background">
                  <img src={currentCoverUrl} className="h-full w-full object-cover" alt="Cover preview" />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={isLocked}
                className="block w-full text-sm text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:font-semibold file:text-primary hover:file:bg-primary/20"
                onChange={(event) =>
                  setForm((current) => ({ ...current, cover_file: event.target.files?.[0] ?? null }))
                }
              />
            </div>
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Tipo de material</label>
              <SegmentedControl
                value={form.type}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    type: value as MaterialType,
                    file: null,
                    external_url: '',
                  }))
                }
                options={[
                  { label: 'PDF', value: 'pdf' },
                  { label: 'Video', value: 'video' },
                  { label: 'Link', value: 'link' },
                ]}
              />
            </div>
          )}

          {effectiveType === 'pdf' && (
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
              <label className="mb-2 block text-sm font-semibold text-foreground">Archivo PDF</label>
              <input
                type="file"
                accept="application/pdf"
                disabled={isLocked}
                className="block w-full text-sm text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:font-semibold file:text-primary hover:file:bg-primary/20"
                onChange={(event) =>
                  setForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))
                }
              />
              {isEditing && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Deja vacío para conservar el archivo actual.
                </p>
              )}
            </div>
          )}

          {effectiveType !== 'pdf' && (
            <Input
              label={effectiveType === 'video' ? 'URL de YouTube' : 'URL externa'}
              value={form.external_url}
              onChange={(event) =>
                setForm((current) => ({ ...current, external_url: event.target.value }))
              }
              placeholder="https://..."
              required
            />
          )}

          <div className="flex justify-end gap-3 border-t border-border/50 pt-6">
            <Button type="button" variant="outline" onClick={() => navigate(routePath('/materials'))}>
              Cancelar
            </Button>
            <Button type="submit" loading={saveMutation.isPending} disabled={isLocked}>
              {isEditing ? 'Guardar Cambios' : 'Crear Material'}
            </Button>
          </div>
        </form>
      </fieldset>

      {isEditing && materialId ? (
        <StudiesSection
          materialId={materialId}
          scope={scope}
          listFn={cfg.listStudies}
          createFn={cfg.createStudy}
          updateFn={cfg.updateStudy}
          deleteFn={cfg.deleteStudy}
        />
      ) : (
        <StudiesSection mode="pending" value={pendingStudies} onChange={setPendingStudies} />
      )}
    </div>
  )
}
