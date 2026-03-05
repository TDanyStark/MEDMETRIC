import { useState, FormEvent, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Building2, Search } from 'lucide-react'
import { useOrganizations, useCreateOrganization, useUpdateOrganization } from '@/hooks/useOrganizations'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Table, Thead, Th, Tbody, Tr, Td } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/useToast'
import { formatDate } from '@/lib/utils'
import { Organization } from '@/types'

type OrgData = Pick<Organization, 'name' | 'slug' | 'active'>;

const EMPTY_FORM: OrgData = { name: '', slug: '', active: true }

interface OrgFormProps {
  initial?: OrgData;
  onSubmit: (data: OrgData) => void;
  loading: boolean;
}

function OrgForm({ initial, onSubmit, loading }: OrgFormProps) {
  const [form, setForm] = useState<OrgData>(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (field: keyof OrgData, value: string | boolean) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-generate slug from name when creating
      if (field === 'name' && !initial && typeof value === 'string') {
        next.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/[\s-]+/g, '-')
          .replace(/^-|-$/g, '')
      }
      return next
    })
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'El nombre es requerido.'
    if (!form.slug.trim()) e.slug = 'El slug es requerido.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nombre"
        value={form.name}
        onChange={e => set('name', e.target.value)}
        placeholder="Abbott Laboratories"
        error={errors.name}
        autoFocus
      />
      <Input
        label="Slug"
        value={form.slug}
        onChange={e => set('slug', e.target.value)}
        placeholder="abbott-laboratories"
        error={errors.slug}
      />
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          checked={form.active}
          onChange={e => set('active', e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        <label htmlFor="active" className="text-sm text-slate-700">Activa</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={loading}>
          {initial ? 'Guardar cambios' : 'Crear organización'}
        </Button>
      </div>
    </form>
  )
}

export default function OrganizationsPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const q    = searchParams.get('q')    || ''
  const page = Number(searchParams.get('page')) || 1

  const { data, isLoading, error, isPlaceholderData } = useOrganizations({ q, page })
  const createMutation = useCreateOrganization()
  const updateMutation = useUpdateOrganization()

  const [searchInput, setSearchInput] = useState(q)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing]   = useState<Organization | null>(null)

  useEffect(() => {
    setSearchInput(q)
  }, [q])

  const updateFilters = (newFilters: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(newFilters).forEach(([key, val]) => {
      if (val === null || val === '') next.delete(key)
      else next.set(key, String(val))
    })
    if (!('page' in newFilters)) {
      next.delete('page')
    }
    setSearchParams(next)
  }

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    updateFilters({ q: searchInput })
  }

  const handleCreate = async (form: OrgData) => {
    try {
      await createMutation.mutateAsync(form)
      setCreating(false)
      toast({ message: 'Organización creada exitosamente.' })
    } catch (err: any) {
      toast({ message: err.message, type: 'error' })
    }
  }

  const handleUpdate = async (form: OrgData) => {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({ id: editing.id, ...form })
      setEditing(null)
      toast({ message: 'Organización actualizada exitosamente.' })
    } catch (err: any) {
      toast({ message: err.message, type: 'error' })
    }
  }

  const result = data
  const items  = result?.items ?? []

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50 text-teal-600">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Organizaciones</h1>
            <p className="text-xs text-slate-500">
              {isLoading ? '...' : `${result?.total ?? 0} organizaciones registradas`}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nueva organización
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Buscar organización..."
          className="h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all shadow-sm"
        />
      </form>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            Cargando…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-sm text-red-500">
            Error al cargar organizaciones.
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Building2 className="h-8 w-8 opacity-30" />
            {q ? 'Sin resultados para tu búsqueda.' : 'Aún no hay organizaciones.'}
          </div>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Nombre</Th>
                  <Th>Slug</Th>
                  <Th>Estado</Th>
                  <Th>Creada</Th>
                  <Th className="w-12" />
                </Tr>
              </Thead>
              <Tbody>
                {items.map(org => (
                  <Tr key={org.id}>
                    <Td>
                      <span className="font-medium text-slate-900">{org.name}</span>
                    </Td>
                    <Td>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{org.slug}</code>
                    </Td>
                    <Td>
                      <Badge variant={org.active ? 'active' : 'inactive'}>
                        {org.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-slate-500">{formatDate(org.created_at)}</Td>
                    <Td>
                      <button
                        onClick={() => setEditing(org)}
                        className="rounded p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Pagination
              page={result!.page}
              lastPage={result!.last_page}
              total={result!.total}
              onPageChange={(p) => updateFilters({ page: p })}
              isLoading={isPlaceholderData}
            />
          </>
        )}
      </div>

      {/* Create modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva organización">
        <OrgForm onSubmit={handleCreate} loading={createMutation.isPending} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar organización">
        {editing && (
          <OrgForm
            initial={{ name: editing.name, slug: editing.slug, active: editing.active }}
            onSubmit={handleUpdate}
            loading={updateMutation.isPending}
          />
        )}
      </Modal>
    </div>
  )
}
