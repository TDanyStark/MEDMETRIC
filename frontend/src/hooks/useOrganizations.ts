import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

const QUERY_KEY = ['organizations']

export function useOrganizations() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.get('/admin/organizations')
      return res.data
    },
  })
}

export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => api.post('/admin/organizations', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/admin/organizations/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
