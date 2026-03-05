import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const USERS_KEY  = ['admin-users']
const ROLES_KEY  = ['roles']

export function useAdminUsers(filters = {}) {
  const params = new URLSearchParams()
  if (filters.role)            params.set('role',            filters.role)
  if (filters.organization_id) params.set('organization_id', filters.organization_id)
  const qs = params.toString() ? `?${params}` : ''

  return useQuery({
    queryKey: [...USERS_KEY, filters],
    queryFn: async () => {
      const res = await api.get(`/admin/users${qs}`)
      return res.data
    },
  })
}

export function useRoles() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async () => {
      const res = await api.get('/admin/roles')
      return res.data
    },
  })
}

export function useCreateAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/admin/users', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useUpdateAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/admin/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useRepSubscriptions(repId, options = {}) {
  return useQuery({
    queryKey: ['rep-subscriptions', repId],
    queryFn: async () => {
      const res = await api.get(`/admin/users/${repId}/subscriptions`)
      return res.data
    },
    enabled: !!repId && options.enabled !== false,
  })
}

export function useUpdateRepSubscriptions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ repId, managerIds }) =>
      api.put(`/admin/users/${repId}/subscriptions`, { manager_ids: managerIds }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['rep-subscriptions', vars.repId] })
      qc.invalidateQueries({ queryKey: USERS_KEY })
    },
  })
}
