import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { ApiResponse, User, PaginatedResult } from '../types'

const USERS_KEY  = ['admin-users']
const ROLES_KEY  = ['roles']

interface Filters {
  role?: string;
  organization_id?: string | number;
  q?: string;
  page?: number;
}

interface RoleData {
  id: number;
  name: string;
}

export function useAdminUsers(filters: Filters = {}) {
  const params = new URLSearchParams()
  if (filters.role)            params.set('role',            filters.role)
  if (filters.organization_id) params.set('organization_id', String(filters.organization_id))
  if (filters.q)               params.set('q',               filters.q)
  if (filters.page)            params.set('page',            String(filters.page))
  const qs = params.toString() ? `?${params}` : ''

  return useQuery({
    queryKey: [...USERS_KEY, filters],
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedResult<User>>>(`/admin/users${qs}`)
      return res.data
    },
  })
}

export function useRoles() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async () => {
      const res = await api.get<ApiResponse<RoleData[]>>('/admin/roles')
      return res.data
    },
  })
}

export function useCreateAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<User> & { password?: string; role_id?: number }) => api.post<ApiResponse<User>>('/admin/users', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useUpdateAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<User> & { id: number; password?: string; role_id?: number }) => 
      api.put<ApiResponse<User>>(`/admin/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useRepSubscriptions(repId: number | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['rep-subscriptions', repId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<any[]>>(`/admin/users/${repId}/subscriptions`)
      return res.data
    },
    enabled: !!repId && options.enabled !== false,
  })
}

export function useUpdateRepSubscriptions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ repId, managerIds }: { repId: number; managerIds: number[] }) =>
      api.put<ApiResponse<any>>(`/admin/users/${repId}/subscriptions`, { manager_ids: managerIds }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['rep-subscriptions', vars.repId] })
      qc.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}
