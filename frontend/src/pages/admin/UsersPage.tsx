import { useState, FormEvent, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Users, Search, Link2 } from 'lucide-react'
import {
  useAdminUsers,
  useRoles,
  useCreateAdminUser,
  useUpdateAdminUser,
  useRepSubscriptions,
  useUpdateRepSubscriptions,
} from '@/hooks/useAdminUsers'
import { useOrganizations } from '@/hooks/useOrganizations'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Table, Thead, Th, Tbody, Tr, Td } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/useToast'
import { formatDateTime, getInitials } from '@/lib/utils'
import { User, Organization } from '@/types'

const ROLE_BADGE: Record<string, any> = {
  admin:   'admin',
  manager: 'manager',
  rep:     'rep',
}

const ROLE_LABEL: Record<string, string> = {
  admin:   'Administrador',
  manager: 'Gerente',
  rep:     'Visitador',
}

interface UserFormData {
  name: string;
  email: string;
  password?: string;
  organization_id: string;
  role_id: string;
  active: boolean;
}

const EMPTY_FORM: UserFormData = {
  name: '', email: '', password: '',
  organization_id: '', role_id: '', active: true,
}

interface UserFormProps {
  initial?: UserFormData;
  onSubmit: (data: UserFormData) => void;
  loading: boolean;
  organizations?: Organization[];
  roles?: { id: number; name: string }[];
}

function UserForm({ initial, onSubmit, loading, organizations, roles }: UserFormProps) {
  const [form, setForm]     = useState<UserFormData>(initial ?? EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (field: keyof UserFormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const isEditing = !!initial

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())            e.name            = 'El nombre es requerido.'
    if (!form.email.trim())           e.email           = 'El correo es requerido.'
    if (!isEditing && !form.password) e.password        = 'La contraseña es requerida.'
    if (!form.organization_id)        e.organization_id = 'La organización es requerida.'
    if (!form.role_id)                e.role_id         = 'El rol es requerido.'
    if (form.password && form.password.length < 8)
      e.password = 'Mínimo 8 caracteres.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    // Don't send empty password on edit
    const payload = { ...form }
    if (isEditing && !payload.password) delete payload.password
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nombre completo"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Ana García"
          error={errors.name}
          autoFocus
          className="col-span-2"
        />
        <Input
          label="Correo electrónico"
          type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          placeholder="ana@empresa.com"
          error={errors.email}
        />
        <Input
          label={isEditing ? 'Nueva contraseña (opcional)' : 'Contraseña'}
          type="password"
          value={form.password}
          onChange={e => set('password', e.target.value)}
          placeholder={isEditing ? 'Dejar vacío para no cambiar' : '••••••••'}
          error={errors.password}
        />
        <Select
          label="Organización"
          value={form.organization_id}
          onChange={e => set('organization_id', e.target.value)}
          error={errors.organization_id}
        >
          <option value="">Seleccionar…</option>
          {(organizations ?? []).map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </Select>
        <Select
          label="Rol"
          value={form.role_id}
          onChange={e => set('role_id', e.target.value)}
          error={errors.role_id}
        >
          <option value="">Seleccionar…</option>
          {(roles ?? []).map(r => (
            <option key={r.id} value={r.id}>{ROLE_LABEL[r.name] ?? r.name}</option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="user-active"
          checked={form.active}
          onChange={e => set('active', e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
        <label htmlFor="user-active" className="text-sm text-slate-700">Usuario activo</label>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={loading}>
          {isEditing ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  )
}

interface SubscriptionsModalProps {
  rep: User | null;
  open: boolean;
  onClose: () => void;
}

function SubscriptionsModal({ rep, open, onClose }: SubscriptionsModalProps) {
  const toast    = useToast()
  const { data: subs } = useRepSubscriptions(rep?.id, { enabled: open })
  // For subscriptions modal we might want all managers of the organization
  const { data: managersResult } = useAdminUsers({ organization_id: rep?.organization_id, role: 'manager' })
  const updateMutation  = useUpdateRepSubscriptions()

  const [selected, setSelected] = useState<number[] | null>(null)

  if (!rep) return null

  const managers     = managersResult?.items ?? []
  const activeSubs   = (subs ?? []).filter(s => s.active).map(s => s.manager_id)

  const toggle = (managerId: number) => {
    const curr = selected ?? activeSubs
    setSelected(
      curr.includes(managerId)
        ? curr.filter(id => id !== managerId)
        : [...curr, managerId],
    )
  }

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ repId: rep.id, managerIds: selected ?? activeSubs })
      toast({ message: 'Suscripciones actualizadas.' })
      setSelected(null)
      onClose()
    } catch (err: any) {
      toast({ message: err.message, type: 'error' })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Suscripciones de ${rep.name}`}>
      <p className="mb-4 text-xs text-slate-500">
        Selecciona los gerentes a los que este visitador tiene acceso.
      </p>
      {managers.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">No hay gerentes en esta organización.</p>
      ) : (
        <div className="space-y-2 mb-5">
          {managers.map(m => {
            const isChecked = (selected ?? activeSubs).includes(m.id)
            return (
              <label key={m.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(m.id)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                  {getInitials(m.name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-400">{m.email}</p>
                </div>
              </label>
            )
          })}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} loading={updateMutation.isPending}>
          Guardar
        </Button>
      </div>
    </Modal>
  )
}

export default function UsersPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const role           = searchParams.get('role')            || ''
  const organizationId = searchParams.get('organization_id') || ''
  const q              = searchParams.get('q')               || ''
  const page           = Number(searchParams.get('page'))    || 1

  const { data, isLoading, error, isPlaceholderData } = useAdminUsers({
    role:            role || undefined,
    organization_id: organizationId || undefined,
    q:               q || undefined,
    page:            page,
  })

  const { data: rolesResult }         = useRoles()
  const { data: organizationsResult } = useOrganizations()
  const createMutation                = useCreateAdminUser()
  const updateMutation                = useUpdateAdminUser()

  const [searchInput, setSearchInput] = useState(q)
  const [creating, setCreating]       = useState(false)
  const [editing, setEditing]         = useState<User | null>(null)
  const [managingSubs, setManagingSubs] = useState<User | null>(null)

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

  const handleCreate = async (form: UserFormData) => {
    try {
      await createMutation.mutateAsync({
        ...form,
        organization_id: Number(form.organization_id),
        role_id: Number(form.role_id),
      })
      setCreating(false)
      toast({ message: 'Usuario creado exitosamente.' })
    } catch (err: any) {
      toast({ message: err.message, type: 'error' })
    }
  }

  const handleUpdate = async (form: UserFormData) => {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        ...form,
        organization_id: Number(form.organization_id),
        role_id: Number(form.role_id),
      })
      setEditing(null)
      toast({ message: 'Usuario actualizado exitosamente.' })
    } catch (err: any) {
      toast({ message: err.message, type: 'error' })
    }
  }

  const result = data
  const items  = result?.items ?? []
  const roles  = rolesResult ?? []
  const organizations = organizationsResult?.items ?? []

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-50 text-teal-600">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Usuarios</h1>
            <p className="text-xs text-slate-500">
              {isLoading ? '...' : `${result?.total ?? 0} usuarios registrados`}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nuevo usuario
        </Button>
      </div>

      {/* Filters bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar usuario…"
            className="h-8 w-52 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </form>

        <select
          value={role}
          onChange={e => updateFilters({ role: e.target.value })}
          className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        >
          <option value="">Todos los roles</option>
          {roles.map(r => (
            <option key={r.id} value={r.name}>{ROLE_LABEL[r.name] ?? r.name}</option>
          ))}
        </select>

        <select
          value={organizationId}
          onChange={e => updateFilters({ organization_id: e.target.value })}
          className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        >
          <option value="">Todas las organizaciones</option>
          {organizations.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">Cargando…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 text-sm text-red-500">Error al cargar usuarios.</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Users className="h-8 w-8 opacity-30" />
            {q ? 'Sin resultados para tu búsqueda.' : 'Aún no hay usuarios.'}
          </div>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Usuario</Th>
                  <Th>Rol</Th>
                  <Th>Organización</Th>
                  <Th>Último acceso</Th>
                  <Th>Estado</Th>
                  <Th className="w-20" />
                </Tr>
              </Thead>
              <Tbody>
                {items.map(u => (
                  <Tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {getInitials(u.name)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 leading-none">{u.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant={ROLE_BADGE[u.role] ?? 'default'}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </Badge>
                    </Td>
                    <Td className="text-sm text-slate-600">{u.organization_name}</Td>
                    <Td className="text-xs text-slate-500">{formatDateTime(u.last_login_at)}</Td>
                    <Td>
                      <Badge variant={u.active ? 'active' : 'inactive'}>
                        {u.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        {u.role === 'rep' && (
                          <button
                            onClick={() => setManagingSubs(u)}
                            className="rounded p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Gestionar suscripciones"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(u)}
                          className="rounded p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo usuario" className="max-w-lg mx-4">
        <UserForm
          onSubmit={handleCreate}
          loading={createMutation.isPending}
          organizations={organizations}
          roles={roles}
        />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar usuario" className="max-w-lg mx-4">
        {editing && (
          <UserForm
            initial={{
              name:            editing.name,
              email:           editing.email,
              password:        '',
              organization_id: String(editing.organization_id),
              role_id:         String(editing.role_id),
              active:          editing.active,
            }}
            onSubmit={handleUpdate}
            loading={updateMutation.isPending}
            organizations={organizations}
            roles={roles}
          />
        )}
      </Modal>

      {/* Subscriptions modal */}
      <SubscriptionsModal
        rep={managingSubs}
        open={!!managingSubs}
        onClose={() => setManagingSubs(null)}
      />
    </div>
  )
}
