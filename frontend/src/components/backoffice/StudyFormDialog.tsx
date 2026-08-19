import { useState } from 'react'

import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/backoffice/Workbench'
import { useDidDepsChange } from '@/hooks/useDidDepsChange'
import { MaterialStudy, MaterialStudyType } from '@/types/backoffice'

interface StudyFormState {
  title: string
  type: MaterialStudyType
  external_url: string
  file: File | null
}

const emptyForm: StudyFormState = {
  title: '',
  type: 'pdf',
  external_url: '',
  file: null,
}

interface StudyFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  editingStudy: MaterialStudy | null
  onSave: (payload: FormData) => Promise<void>
  isSaving: boolean
}

export function StudyFormDialog({
  isOpen,
  onOpenChange,
  editingStudy,
  onSave,
  isSaving,
}: StudyFormDialogProps) {
  const [form, setForm] = useState<StudyFormState>(emptyForm)

  // Reset the form whenever the dialog opens (or the study being edited
  // changes while open). Adjusted during render, not in an effect — the
  // component stays mounted across open/close so a `useEffect` reset would
  // fire an extra post-mount render.
  if (useDidDepsChange([isOpen, editingStudy]) && isOpen) {
    setForm(
      editingStudy
        ? {
            title: editingStudy.title,
            type: editingStudy.type,
            external_url: editingStudy.external_url ?? '',
            file: null,
          }
        : emptyForm,
    )
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const payload = new FormData()
    payload.append('title', form.title)
    if (!editingStudy) payload.append('type', form.type)

    if (form.type === 'pdf') {
      if (form.file) payload.append('file', form.file)
    } else {
      payload.append('external_url', form.external_url)
    }

    void onSave(payload)
  }

  const effectiveType = editingStudy ? editingStudy.type : form.type

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingStudy ? 'Editar estudio' : 'Nuevo estudio'}</DialogTitle>
          <DialogDescription>
            {editingStudy
              ? 'Actualiza los datos del estudio.'
              : 'Agrega un estudio médico (PDF o enlace) como respaldo de este material.'}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <Input
            label="Título"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />

          {!editingStudy && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Tipo de estudio</label>
              <SegmentedControl
                value={form.type}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    type: value as MaterialStudyType,
                    file: null,
                    external_url: '',
                  }))
                }
                options={[
                  { label: 'PDF', value: 'pdf' },
                  { label: 'Link', value: 'link' },
                ]}
              />
            </div>
          )}

          {effectiveType === 'pdf' ? (
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
              {editingStudy && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Deja vacío para conservar el archivo actual.
                </p>
              )}
            </div>
          ) : (
            <Input
              label="URL externa"
              value={form.external_url}
              onChange={(event) =>
                setForm((current) => ({ ...current, external_url: event.target.value }))
              }
              placeholder="https://..."
              required
            />
          )}

          <div className="flex justify-end gap-3 border-t border-border/50 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSaving}>
              {editingStudy ? 'Guardar Cambios' : 'Agregar Estudio'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
