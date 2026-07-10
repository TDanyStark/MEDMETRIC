import { useEffect, useState } from 'react'
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
import { createDoctor } from '@/services/doctors'
import { Doctor, DoctorPayload } from '@/types/doctor'
import {
  CHILE_COUNTRIES,
  CHILE_REGIONS,
  getComunasByProvincia,
  getProvinciasByRegion,
} from '@/data/chileGeo'
import { useBrandOptions } from '@/hooks/useBrandOptions'

type GeoOption = { label: string; value: string }

interface CreateDoctorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (doctor: Doctor) => void
  initialName?: string
}

const EMPTY_FORM: DoctorPayload = {
  name: '',
  document: '',
  specialty: '',
  country: CHILE_COUNTRIES[0],
  region: '',
  provincia: '',
  comuna: '',
  institution: '',
  category: '',
  product: '',
  adoption_level: '',
  email: '',
  phone: '',
  mobile_phone: '',
  address: '',
}

export function CreateDoctorDialog({ open, onOpenChange, onCreated, initialName }: CreateDoctorDialogProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DoctorPayload>(EMPTY_FORM)
  const brandOptions = useBrandOptions()

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_FORM, name: initialName ?? '' })
    }
  }, [open, initialName])

  const createMutation = useMutation({
    mutationFn: () => {
      const optionalEntries = Object.entries(form).filter(
        ([key, value]) => key !== 'name' && Boolean(value),
      )
      const payload: DoctorPayload = {
        ...(Object.fromEntries(optionalEntries) as Partial<DoctorPayload>),
        name: form.name.trim(),
      }
      return createDoctor(payload)
    },
    onSuccess: doctor => {
      toast.success('Médico registrado exitosamente.')
      void queryClient.invalidateQueries({ queryKey: ['doctors'] })
      onCreated(doctor)
      onOpenChange(false)
    },
    onError: error => {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el médico.'
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
          <DialogTitle>Registrar nuevo médico</DialogTitle>
          <DialogDescription>
            Solo el nombre es obligatorio. Puedes completar el resto de los datos ahora o más adelante.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={event => {
            event.preventDefault()
            if (!isNameValid) return
            void createMutation.mutateAsync()
          }}
          className="mt-2 space-y-5"
        >
          <Input
            label="Nombre *"
            value={form.name}
            onChange={handleChange('name')}
            placeholder="Dr. Juan Pérez"
            autoFocus
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Documento" value={form.document} onChange={handleChange('document')} placeholder="RUT / cédula" />
            <Input label="Especialidad" value={form.specialty} onChange={handleChange('specialty')} placeholder="Cardiología" />
            <Input label="Institución" value={form.institution} onChange={handleChange('institution')} placeholder="Clínica Las Condes" />
            <Input label="Categoría" value={form.category} onChange={handleChange('category')} placeholder="A / B / C" />
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
            <Input label="Nivel de adopción" value={form.adoption_level} onChange={handleChange('adoption_level')} placeholder="Alto / Medio / Bajo" />
            <Input label="Email" type="email" value={form.email} onChange={handleChange('email')} placeholder="doctor@correo.com" />
            <Input label="Teléfono" value={form.phone} onChange={handleChange('phone')} placeholder="+56 2 1234 5678" />
            <Input label="Celular" value={form.mobile_phone} onChange={handleChange('mobile_phone')} placeholder="+56 9 1234 5678" />
            <Input label="Dirección" value={form.address} onChange={handleChange('address')} placeholder="Av. Siempre Viva 123" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!isNameValid} loading={createMutation.isPending}>
              Registrar médico
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
