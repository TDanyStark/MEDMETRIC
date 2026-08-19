import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { RepAssignSelect } from '@/components/ui/RepAssignSelect'
import { updateDoctor } from '@/services/doctors'
import { Doctor, DoctorPayload } from '@/types/doctor'
import {
  CHILE_COUNTRIES,
  CHILE_REGIONS,
  getComunasByProvincia,
  getProvinciasByRegion,
} from '@/data/chileGeo'
import { useBrandOptions } from '@/hooks/useBrandOptions'
import { useDidDepsChange } from '@/hooks/useDidDepsChange'
import { useAuth } from '@/contexts/useAuth'

type GeoOption = { label: string; value: string }

interface EditDoctorDialogProps {
  doctor: Doctor | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function toFormState(doctor: Doctor | null): DoctorPayload {
  return {
    name: doctor?.name ?? '',
    document: doctor?.document ?? '',
    specialty: doctor?.specialty ?? '',
    country: doctor?.country ?? CHILE_COUNTRIES[0],
    region: doctor?.region ?? '',
    provincia: doctor?.provincia ?? '',
    comuna: doctor?.comuna ?? '',
    institution: doctor?.institution ?? '',
    category: doctor?.category ?? '',
    product: doctor?.product ?? '',
    adoption_level: doctor?.adoption_level ?? '',
    email: doctor?.email ?? '',
    phone: doctor?.phone ?? '',
    mobile_phone: doctor?.mobile_phone ?? '',
    address: doctor?.address ?? '',
    assigned_rep_id: doctor?.assigned_rep_id ?? null,
  }
}

export function EditDoctorDialog({ doctor, open, onOpenChange }: EditDoctorDialogProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DoctorPayload>(toFormState(doctor))
  const brandOptions = useBrandOptions()
  const { user } = useAuth()
  // Representatives never assign/reassign doctors — the field is hidden for
  // them entirely (backend also hardens this by stripping assigned_rep_id
  // from a rep's payload regardless of what the client sends).
  const canAssignRep = user?.role !== 'rep'

  // Reset the form whenever the dialog opens. Adjusted during render, not in
  // an effect — this component stays mounted across open/close.
  if (useDidDepsChange([open, doctor]) && open) {
    setForm(toFormState(doctor))
  }

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!doctor) throw new Error('Médico no encontrado.')
      const optionalEntries = Object.entries(form).filter(([key]) => key !== 'name')
      const payload: Partial<DoctorPayload> = {
        ...(Object.fromEntries(optionalEntries) as Partial<DoctorPayload>),
        name: form.name.trim(),
      }
      return updateDoctor(doctor.id, payload)
    },
    onSuccess: () => {
      toast.success('Médico actualizado exitosamente.')
      void queryClient.invalidateQueries({ queryKey: ['doctors'] })
      onOpenChange(false)
    },
    onError: error => {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el médico.'
      toast.error(message)
    },
  })

  const handleChange = (key: keyof DoctorPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(current => ({ ...current, [key]: event.target.value }))
  }

  const isNameValid = form.name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar médico</DialogTitle>
          <DialogDescription>Actualiza los datos de {doctor?.name}.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={event => {
            event.preventDefault()
            if (!isNameValid) return
            void updateMutation.mutateAsync()
          }}
          className="mt-2 space-y-5"
        >
          <Input label="Nombre *" value={form.name} onChange={handleChange('name')} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Documento" value={form.document} onChange={handleChange('document')} />
            <Input label="Especialidad" value={form.specialty} onChange={handleChange('specialty')} />
            <Input label="Institución" value={form.institution} onChange={handleChange('institution')} />
            <Input label="Categoría" value={form.category} onChange={handleChange('category')} />
            <CustomSelect<GeoOption>
              label="País"
              value={{ label: form.country || CHILE_COUNTRIES[0], value: form.country || CHILE_COUNTRIES[0] }}
              onChange={option => setForm(current => ({ ...current, country: option?.value ?? CHILE_COUNTRIES[0] }))}
              options={CHILE_COUNTRIES.map(country => ({ label: country, value: country }))}
              isSearchable={false}
              isDisabled
            />
            <CustomSelect<GeoOption>
              label="Región"
              placeholder="Selecciona una región"
              value={form.region ? { label: form.region, value: form.region } : null}
              onChange={option =>
                setForm(current => ({ ...current, region: option?.value ?? '', provincia: '', comuna: '' }))
              }
              options={CHILE_REGIONS.map(region => ({ label: region.name, value: region.name }))}
              isSearchable
              isClearable
            />
            <CustomSelect<GeoOption>
              label="Provincia"
              placeholder="Selecciona una provincia"
              value={form.provincia ? { label: form.provincia, value: form.provincia } : null}
              onChange={option =>
                setForm(current => ({ ...current, provincia: option?.value ?? '', comuna: '' }))
              }
              options={getProvinciasByRegion(form.region).map(provincia => ({ label: provincia, value: provincia }))}
              isDisabled={!form.region}
              isSearchable
              isClearable
            />
            <CustomSelect<GeoOption>
              label="Comuna"
              placeholder="Selecciona una comuna"
              value={form.comuna ? { label: form.comuna, value: form.comuna } : null}
              onChange={option => setForm(current => ({ ...current, comuna: option?.value ?? '' }))}
              options={getComunasByProvincia(form.region, form.provincia).map(comuna => ({ label: comuna, value: comuna }))}
              isDisabled={!form.provincia}
              isSearchable
              isClearable
            />
            <CustomSelect<GeoOption>
              label="Producto"
              placeholder="Selecciona un producto"
              value={form.product ? { label: form.product, value: form.product } : null}
              onChange={option => setForm(current => ({ ...current, product: option?.value ?? '' }))}
              options={brandOptions.options}
              isLoading={brandOptions.isLoading}
              isSearchable
              isClearable
            />
            <Input label="Nivel de adopción" value={form.adoption_level} onChange={handleChange('adoption_level')} />
            <Input label="Email" type="email" value={form.email} onChange={handleChange('email')} />
            <Input label="Teléfono" value={form.phone} onChange={handleChange('phone')} />
            <Input label="Celular" value={form.mobile_phone} onChange={handleChange('mobile_phone')} />
            <Input label="Dirección" value={form.address} onChange={handleChange('address')} />
            {canAssignRep && (
              <RepAssignSelect
                label="Representante asignado"
                placeholder="Buscar representante..."
                value={form.assigned_rep_id ?? null}
                initialLabel={doctor?.assigned_rep_name}
                onChange={repId => setForm(current => ({ ...current, assigned_rep_id: repId }))}
                instanceId="edit-doctor-rep-select"
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isNameValid} loading={updateMutation.isPending}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
