import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { SegmentedControl } from '@/components/backoffice/Workbench'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Brand, ManagerOption, MaterialType } from '@/types/backoffice'
import {
  createOrgMaterial,
  getOrgBrandManagers,
  getOrgMaterial,
  listOrgBrands,
  updateOrgMaterial,
} from '@/services/backoffice'

import { LoadingState } from './components/LoadingState'
import { ErrorState } from './components/ErrorState'

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

export function OrgAdminMaterialFormPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const params = useParams<{ id?: string }>()
  const materialId = params.id ? Number(params.id) : null
  const isEditing = materialId !== null

  const [form, setForm] = useState<MaterialFormState>(emptyForm)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const brandsQuery = useQuery({
    queryKey: ['org-admin', 'brands', 'material-form'],
    queryFn: () => listOrgBrands({ all: true }),
  })

  const materialQuery = useQuery({
    queryKey: ['org-admin', 'materials', materialId, 'detail'],
    queryFn: () => getOrgMaterial(materialId!),
    enabled: isEditing,
  })

  const brands = brandsQuery.data?.items ?? []
  const material = materialQuery.data

  // Hydrate form
  useEffect(() => {
    if (isEditing) {
      if (!material) return
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
    } else {
      setForm((current) => ({ ...current, brand_id: current.brand_id ?? brands[0]?.id ?? null }))
    }
  }, [isEditing, material, brands])

  useEffect(() => {
    if (form.cover_file) {
      const url = URL.createObjectURL(form.cover_file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [form.cover_file])

  // Brand managers (only relevant when creating)
  const brandManagersQuery = useQuery({
    queryKey: ['org-admin', 'brand-managers', form.brand_id],
    queryFn: () => getOrgBrandManagers(form.brand_id!),
    enabled: !isEditing && !!form.brand_id,
  })

  const brandManagers = brandManagersQuery.data
  const needsManagerSelection = !isEditing && brandManagers?.needs_selection === true
  const needsSync = brandManagers?.needs_sync === true
  const managerOptions: ManagerOption[] = needsSync
    ? brandManagers?.org_managers ?? []
    : brandManagers?.brand_managers ?? []

  // Reset manager when brand changes (create flow)
  useEffect(() => {
    if (!isEditing) setForm((current) => ({ ...current, manager_id: null }))
  }, [form.brand_id, isEditing])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = new FormData()
      payload.append('title', form.title)
      payload.append('description', form.description)
      payload.append('brand_id', String(form.brand_id ?? ''))
      if (form.manager_id) payload.append('manager_id', String(form.manager_id))
      if (!isEditing) payload.append('type', form.type)
      if (form.type === 'pdf' && form.file) {
        payload.append('file', form.file)
      } else if (form.type !== 'pdf') {
        payload.append('external_url', form.external_url)
      }
      if (form.cover_file) payload.append('cover_image', form.cover_file)

      return isEditing ? updateOrgMaterial(materialId!, payload) : createOrgMaterial(payload)
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Material actualizado.' : 'Material creado.')
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'materials'] })
      void queryClient.invalidateQueries({ queryKey: ['org-admin', 'brand-managers'] })
      navigate('/org-admin/materials')
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo guardar.'
      toast.error(message)
    },
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.brand_id) return
    if (needsManagerSelection && !form.manager_id) return
    void saveMutation.mutateAsync()
  }

  const effectiveType = isEditing ? material?.type ?? form.type : form.type

  const currentCoverUrl = form.cover_file
    ? previewUrl
    : material?.cover_url ||
      (material?.cover_path ? `/api/v1/public/material/${material.id}/cover` : null)

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
          onClick={() => navigate('/org-admin/materials')}
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
          placeholder="Busca y selecciona una marca"
          value={brands.find((b) => b.id === form.brand_id) ?? null}
          onChange={(option) => {
            if (option) {
              setForm((current) => ({ ...current, brand_id: (option as Brand).id }))
            }
          }}
          options={brands}
          isLoading={brandsQuery.isLoading}
          getOptionLabel={(option) => {
            const brand = option as Brand
            const count = brand.managers?.length ?? 0
            if (count === 0) return `${brand.name} · sin gerente`
            if (count === 1) return `${brand.name} · ${brand.managers![0].name}`
            return `${brand.name} · ${count} gerentes`
          }}
          getOptionValue={(option) => String((option as Brand).id)}
          isSearchable
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
          <Button type="button" variant="outline" onClick={() => navigate('/org-admin/materials')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saveMutation.isPending}>
            {isEditing ? 'Guardar Cambios' : 'Crear Material'}
          </Button>
        </div>
      </form>
    </div>
  )
}
