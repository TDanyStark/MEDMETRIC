import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { SegmentedControl } from '@/components/backoffice/Workbench'
import { Material, MaterialType, Brand } from '@/types/backoffice'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface MaterialFormState {
  title: string
  description: string
  brand_id: number | null
  type: MaterialType
  external_url: string
  file: File | null
  cover_file: File | null
}

const emptyMaterialForm: MaterialFormState = {
  title: '',
  description: '',
  brand_id: null,
  type: 'pdf',
  external_url: '',
  file: null,
  cover_file: null,
}

function buildMaterialPayload(form: MaterialFormState, editingMaterial: Material | null) {
  const payload = new FormData()
  payload.append('title', form.title)
  payload.append('description', form.description)
  payload.append('brand_id', String(form.brand_id ?? ''))
  
  if (!editingMaterial) {
    payload.append('type', form.type)
  }

  if (form.type === 'pdf' && form.file) {
    payload.append('file', form.file)
  } else if (form.type !== 'pdf') {
    payload.append('external_url', form.external_url)
  }

  if (form.cover_file) {
    payload.append('cover_image', form.cover_file)
  }

  return payload
}

interface MaterialDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  editingMaterial: Material | null
  brands: Brand[]
  onSave: (payload: FormData) => Promise<void>
  isSaving: boolean
}

export function MaterialDialog({
  isOpen,
  onOpenChange,
  editingMaterial,
  brands,
  onSave,
  isSaving,
}: MaterialDialogProps) {
  const [form, setForm] = useState<MaterialFormState>(emptyMaterialForm)

  useEffect(() => {
    if (!isOpen) return

    if (!editingMaterial) {
      setForm({ ...emptyMaterialForm, brand_id: brands[0]?.id ?? null })
      return
    }

    setForm({
      title: editingMaterial.title,
      description: editingMaterial.description ?? '',
      brand_id: editingMaterial.brand_id,
      type: editingMaterial.type,
      external_url: editingMaterial.external_url ?? '',
      file: null,
      cover_file: null,
    })
  }, [isOpen, editingMaterial, brands])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.brand_id) return
    const payload = buildMaterialPayload(form, editingMaterial)
    void onSave(payload)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editingMaterial ? 'Editar Material' : 'Nuevo Material'}</DialogTitle>
          <DialogDescription>
            {editingMaterial ? 'Edita los datos del material.' : 'Crea un nuevo material para tus visitadores.'}
          </DialogDescription>
        </DialogHeader>
        <form className="mt-2 space-y-5" onSubmit={handleSubmit}>
          <Input
            label="Título"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
          <Textarea
            label="Descripción"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />

<CustomSelect
  label="Marca"
  placeholder="Selecciona una marca"
  value={brands.find((b) => b.id === form.brand_id)}
  onChange={(option) => {
    if (option) {
      setForm((current) => ({ ...current, brand_id: (option as Brand).id }))
    }
  }}
  options={brands}
  getOptionLabel={(option) => (option as Brand).name}
  getOptionValue={(option) => String((option as Brand).id)}
  required
/>

          <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
            <div className="flex justify-between items-end mb-2">
              <label className="text-sm font-semibold text-foreground block">
                Banner para el Feed
              </label>
              <span className="text-[11px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                1200 x 675px
              </span>
            </div>
            <div className="flex items-center gap-4">
              {editingMaterial?.cover_path && !form.cover_file && (
                <img
                  src={`/api/v1/public/material/${editingMaterial.id}/cover`}
                  className="h-16 w-16 rounded-xl object-cover bg-background border border-border"
                  alt="Current cover"
                />
              )}
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:text-primary file:px-4 file:py-2 file:font-semibold hover:file:bg-primary/20 transition-colors"
                onChange={(event) =>
                  setForm((current) => ({ ...current, cover_file: event.target.files?.[0] ?? null }))
                }
              />
            </div>
          </div>

          {!editingMaterial && (
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

          {(editingMaterial?.type ?? form.type) === 'pdf' && (
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
              <label className="text-sm font-semibold text-foreground mb-2 block">Archivo PDF</label>
              <input
                type="file"
                accept="application/pdf"
                className="block w-full text-sm text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary/10 file:text-primary file:px-4 file:py-2 file:font-semibold hover:file:bg-primary/20 transition-colors"
                onChange={(event) =>
                  setForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))
                }
              />
            </div>
          )}

          {(editingMaterial?.type ?? form.type) !== 'pdf' && (
            <Input
              label={(editingMaterial?.type ?? form.type) === 'video' ? 'URL de YouTube' : 'URL externa'}
              value={form.external_url}
              onChange={(event) =>
                setForm((current) => ({ ...current, external_url: event.target.value }))
              }
              placeholder="https://..."
              required
            />
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/50 sticky bottom-0 bg-background/95 backdrop-blur-sm -mx-6 px-6 py-4 mt-8 -mb-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSaving}>
              {editingMaterial ? 'Guardar Cambios' : 'Crear Material'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
