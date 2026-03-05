import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { ApiResponse, Organization } from '../types'

const QUERY_KEY = ['organizations']

export function useOrganizations() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<ApiResponse<Organization[]>>('/admin/organizations')
      return res.data
    },
  })
}

export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Organization>) => api.post<ApiResponse<Organization>>('/admin/organizations', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export function useUpdateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Organization> & { id: number }) => 
      api.put<ApiResponse<Organization>>(`/admin/organizations/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}
